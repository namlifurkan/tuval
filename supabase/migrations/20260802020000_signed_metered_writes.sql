-- What a robot leaves behind ----------------------------------------------------------------------
-- A key could already be told what it may do and whose pages it may open. What it could not do is
-- leave a mark. Three things were wrong with that, and all three are the same mistake seen from
-- different sides.
--
-- A write through the gateway left no version, so an agent that got a title wrong took the old one
-- with it. The trigger that stamps who touched a row reads auth.uid(), and behind the service key
-- there is no session to read, so the row kept whoever wrote it last — an agent's edit came out
-- signed with the name of the last person, and the screen that lists changes printed that name.
-- And nothing counted, so a loop that meant to write once could write all night.
--
-- So: every change to a record is written down before it is overwritten, the gateway says who and
-- what it is acting as, and a key spends an allowance to do it.

-- Whose hand, and through what ---------------------------------------------------------------------
-- Null when a person did it. The name of the key when something outside did, which is the only
-- thing that tells the two apart after the fact.

alter table public.records add column if not exists updated_via text;

create or replace function public.records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  sitting uuid := (select auth.uid());
begin
  new.updated_at := now();
  -- With a session, the session is the answer and nothing a caller sends can argue with it.
  -- Without one, the only writer that reaches here is the gateway, which holds the service key
  -- and has already been told on whose behalf it is acting.
  new.updated_by  := coalesce(sitting, new.updated_by, new.created_by);
  new.updated_via := case when sitting is null then new.updated_via end;
  return new;
end;
$$;

drop trigger if exists records_touched on public.records;
create trigger records_touched before update on public.records
  for each row execute function public.records_touch();

-- Versions ------------------------------------------------------------------------------------------
-- Its own table rather than another kind of record. A kind is loaded whole into the browser and
-- re-read whenever any row of it changes; a log of every edit is the one shape that must never be
-- treated that way.
--
-- What is kept is what a column was before, for the columns that actually moved. That is the
-- smallest thing that can put it back, and it is also the answer to "what did it change".

create table if not exists public.record_revisions (
  id           bigint generated always as identity primary key,
  record_id    uuid not null references public.records on delete cascade,
  workspace_id uuid not null references public.workspaces on delete cascade,
  at           timestamptz not null default now(),
  actor        uuid references auth.users on delete set null,
  -- The key's name, so an edit made by an agent says so instead of borrowing a person.
  via          text,
  changed      text[] not null default '{}',
  was          jsonb not null default '{}'
);

create index if not exists record_revisions_record_idx
  on public.record_revisions (record_id, id desc);

alter table public.record_revisions enable row level security;

-- Read by whoever is in the workspace, written by nobody. The only thing that inserts is the
-- trigger below, which is the whole point of a trail: it cannot be dressed up after the fact.
drop policy if exists record_revisions_read on public.record_revisions;
create policy record_revisions_read on public.record_revisions for select to authenticated
  using ((select public.in_workspace(workspace_id)));

create or replace function public.record_revised()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Position is left out on purpose: dragging a card past another one is not an edit, and
  -- keeping it would bury the changes that are.
  watched text[] := array['kind', 'title', 'description', 'status', 'assignee', 'priority',
                          'due_at', 'estimate', 'parent_id', 'project_id', 'cycle_id',
                          'archived_at', 'icon', 'cover', 'data'];
  moved   text[] := '{}';
begin
  if tg_op = 'UPDATE' then
    select coalesce(array_agg(k), '{}') into moved
    from unnest(watched) k
    where to_jsonb(new) -> k is distinct from to_jsonb(old) -> k;
    if moved = '{}' then return null; end if;
  end if;

  insert into public.record_revisions (record_id, workspace_id, actor, via, changed, was)
  values (
    new.id, new.workspace_id,
    coalesce(new.updated_by, new.created_by), new.updated_via, moved,
    coalesce((select jsonb_object_agg(k, to_jsonb(old) -> k) from unnest(moved) k), '{}'::jsonb)
  );

  -- Thirty is what somebody scrolls before they give up and ask a person. Trimmed here rather
  -- than by a nightly job, because a row that is never allowed to accumulate never needs one.
  delete from public.record_revisions r
  where r.record_id = new.id
    and r.id < (select v.id from public.record_revisions v
                where v.record_id = new.id order by v.id desc offset 30 limit 1);
  return null;
end;
$$;

-- PostgreSQL hands EXECUTE to PUBLIC on a new function. A trigger is fired by the table, not by
-- the caller, so nobody needs the grant and it is taken back.
revoke all on function public.record_revised() from public, authenticated, anon;

drop trigger if exists records_revised on public.records;
create trigger records_revised after insert or update on public.records
  for each row execute function public.record_revised();

-- An allowance --------------------------------------------------------------------------------------
-- Counted at the door and in the database, because a limit enforced in the caller is a limit the
-- caller can decline to enforce. A day at a time: long enough for a nightly sync, short enough
-- that a loop stops before morning.

alter table public.api_keys
  add column if not exists daily_writes int not null default 1000,
  add column if not exists writes_on    date,
  add column if not exists writes_today int not null default 0;

alter table public.api_keys drop constraint if exists api_keys_daily_writes_check;
alter table public.api_keys add constraint api_keys_daily_writes_check
  check (daily_writes between 0 and 100000);

-- The gateway asks one question and gets everything it needs to write with: which workspace,
-- whose eyes, what name to sign with, whether it may write, and what is left of today.
drop function if exists public.workspace_for_key(text);
drop function if exists public.workspace_for_key(text, boolean);

create function public.workspace_for_key(token text, writing boolean default false)
returns table (workspace_id uuid, acting uuid, agent text, scope text, writes_left int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.api_keys;
  seat  text;
  may   text;
  spent int;
begin
  select * into found from public.api_keys k
  where k.token_sha = encode(extensions.digest(token, 'sha256'), 'hex')
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now());

  if found.id is null or found.created_by is null then
    return;
  end if;

  if public.plan_of(found.workspace_id) <> 'team' then
    return;
  end if;

  seat := public.workspace_seat(found.created_by, found.workspace_id);
  if seat is null or seat = 'blocked' then
    return;
  end if;

  may := case
    when found.scope = 'write' and seat in ('owner', 'admin', 'member') then 'write'
    else 'read'
  end;

  -- A count from another day is not this day's count, so it starts again rather than carrying.
  spent := case when found.writes_on = current_date then found.writes_today else 0 end;

  if writing and may = 'write' then
    if spent >= found.daily_writes then
      writes_left := -1;
    else
      spent := spent + 1;
    end if;
  end if;

  update public.api_keys
     set last_used_at = now(), writes_on = current_date, writes_today = spent
   where id = found.id;

  workspace_id := found.workspace_id;
  acting       := found.created_by;
  agent        := found.name;
  scope        := may;
  writes_left  := coalesce(writes_left, found.daily_writes - spent);
  return next;
end;
$$;

revoke all on function public.workspace_for_key(text, boolean) from public, authenticated, anon;
grant execute on function public.workspace_for_key(text, boolean) to service_role;
