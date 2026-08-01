-- Work that comes back ------------------------------------------------------------------------
-- Every Monday there is a standup note. Every first of the month there is an invoice. Somebody
-- has to remember, and somebody forgets.
--
-- The rule is the whole definition — there is no template record to keep in step with it. Making
-- the due ones is idempotent and keyed on the date, so it can be run by a schedule, by the app
-- on the way in, or twice by both, and the answer is the same either way.

create table if not exists public.recurrences (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  title        text not null,
  every        text not null check (every in ('day', 'week', 'month')),
  -- 1 is Monday, the way a working week is counted here.
  weekday      int check (weekday between 1 and 7),
  monthday     int check (monthday between 1 and 28),
  assignee     uuid references auth.users on delete set null,
  estimate     int,
  project_id   uuid references public.records on delete set null,
  next_on      date not null default current_date,
  active       boolean not null default true,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists recurrences_due_idx on public.recurrences (next_on) where active;

alter table public.recurrences enable row level security;

drop policy if exists recurrences_read  on public.recurrences;
drop policy if exists recurrences_write on public.recurrences;

create policy recurrences_read on public.recurrences for select to authenticated
  using ((select public.in_workspace(workspace_id)));

create policy recurrences_write on public.recurrences for all to authenticated
  using ((select public.can_write_workspace(workspace_id)))
  with check ((select public.can_write_workspace(workspace_id)));

-- When the next one is due after this one. A month is the same day next month, which is why the
-- day of a monthly rule stops at 28: there is no 31st of February and nobody wants to argue
-- about what should happen instead.
create or replace function public.after_recurrence(rule public.recurrences, from_day date)
returns date
language sql
immutable
set search_path = ''
as $$
  select case rule.every
    when 'day' then from_day + 1
    when 'week' then from_day + 7
    else (from_day + interval '1 month')::date
  end;
$$;

create or replace function public.make_due_recurrences()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule public.recurrences;
  made int := 0;
  guard int;
begin
  for rule in
    select * from public.recurrences r where r.active and r.next_on <= current_date
  loop
    guard := 0;
    -- A rule left alone for a year should produce the ones it owes and then stop, not a year of
    -- rows in one go. Sixty is a season of dailies, which is as far back as is worth catching up.
    while rule.next_on <= current_date and guard < 60 loop
      insert into public.records
        (workspace_id, kind, title, status, assignee, estimate, project_id, due_at, created_by)
      values
        (rule.workspace_id, 'issue', rule.title, 'todo', rule.assignee, rule.estimate,
         rule.project_id, rule.next_on::timestamptz, rule.created_by);

      made := made + 1;
      guard := guard + 1;
      rule.next_on := public.after_recurrence(rule, rule.next_on);
    end loop;

    update public.recurrences set next_on = rule.next_on where id = rule.id;
  end loop;

  return made;
end;
$$;

revoke all on function public.make_due_recurrences() from public;
grant execute on function public.make_due_recurrences() to authenticated;

-- Best effort. If the schedule cannot be created here it is not a failure: the app asks for the
-- due ones on the way in as well, so a workspace somebody opens each morning keeps up either way.
do $$
begin
  create extension if not exists pg_cron;
  perform cron.unschedule('tuval-recurrences');
exception when others then
  null;
end $$;

do $$
begin
  perform cron.schedule('tuval-recurrences', '5 2 * * *', 'select public.make_due_recurrences()');
exception when others then
  raise notice 'no schedule: the app will ask for these itself';
end $$;
