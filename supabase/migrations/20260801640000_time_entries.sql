-- Hours against work -------------------------------------------------------------------------------
-- An agency, a consultant and a lawyer are paid by the hour, and a tracker that cannot say where
-- the week went is a tracker they still have to keep a spreadsheet beside.
--
-- A row per stint rather than a running total on the issue: what the week looked like is a
-- question about days, and a single number cannot answer it. Minutes rather than hours, because
-- twenty minutes is a real amount of work and 0.33 is not a real number.

create table if not exists public.time_entries (
  id         uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  record_id  uuid not null references public.records on delete cascade,
  user_id    uuid not null references auth.users on delete cascade,
  minutes    int not null check (minutes > 0 and minutes <= 24 * 60),
  spent_on   date not null default current_date,
  note       text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists time_entries_record_idx on public.time_entries (record_id);
create index if not exists time_entries_week_idx on public.time_entries (workspace_id, spent_on desc);
create index if not exists time_entries_mine_idx on public.time_entries (user_id, spent_on desc);

alter table public.time_entries enable row level security;

drop policy if exists time_read   on public.time_entries;
drop policy if exists time_write  on public.time_entries;
drop policy if exists time_mine   on public.time_entries;

-- Everybody in the workspace can see where the hours went. That is the point of recording them:
-- a number only its author can read tells nobody anything.
create policy time_read on public.time_entries for select to authenticated
  using ((select public.in_workspace(workspace_id)));

-- You log your own. Somebody else's hours are not yours to write or to correct.
create policy time_write on public.time_entries for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (select public.can_write_record(record_id))
  );

create policy time_mine on public.time_entries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
