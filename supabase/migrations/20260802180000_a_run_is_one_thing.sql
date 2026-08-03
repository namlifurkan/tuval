-- A run is one thing to review ----------------------------------------------------------------------
-- A write already says when it happened and which key made it. What it cannot say is that it was
-- part of the same run as eleven others, so an agent's night reads as forty unrelated changes and
-- the only way through it is one screen at a time.
--
-- The caller names its run and every write it makes carries the name. It is the caller's to
-- choose because only the caller knows where a run begins and ends; the gateway checks the shape
-- and nothing else. A person editing in the app has no run, and the trigger clears it for the
-- same reason it clears the key: with a session, the session is the answer.

alter table public.records          add column if not exists updated_run text;
alter table public.record_revisions add column if not exists run         text;

alter table public.records drop constraint if exists records_run_check;
alter table public.records add constraint records_run_check
  check (updated_run is null or updated_run ~ '^[A-Za-z0-9._-]{1,64}$');

-- Reading a run means asking for every revision carrying its name, newest first.
create index if not exists record_revisions_run_idx
  on public.record_revisions (workspace_id, run, id desc)
  where run is not null;

create or replace function public.records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  sitting uuid := (select auth.uid());
begin
  new.updated_at := now();
  new.updated_by  := coalesce(sitting, new.updated_by, new.created_by);
  new.updated_via := case when sitting is null then new.updated_via end;
  new.updated_run := case when sitting is null then new.updated_run end;
  return new;
end;
$$;

drop trigger if exists records_touched on public.records;
create trigger records_touched before update on public.records
  for each row execute function public.records_touch();

create or replace function public.record_revised()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
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

  insert into public.record_revisions (record_id, workspace_id, actor, via, run, changed, was)
  values (
    new.id, new.workspace_id,
    coalesce(new.updated_by, new.created_by), new.updated_via, new.updated_run, moved,
    coalesce((select jsonb_object_agg(k, to_jsonb(old) -> k) from unnest(moved) k), '{}'::jsonb)
  );

  delete from public.record_revisions r
  where r.record_id = new.id
    and r.id < (select v.id from public.record_revisions v
                where v.record_id = new.id order by v.id desc offset 30 limit 1);
  return null;
end;
$$;

drop trigger if exists records_revised on public.records;
create trigger records_revised after insert or update on public.records
  for each row execute function public.record_revised();

-- What there is to review, without reading every revision to find out. One row per run: who ran
-- it, when it started and stopped, and how many records it touched.
create or replace function public.agent_runs(ws uuid, since timestamptz default null)
returns table (run text, via text, started timestamptz, ended timestamptz, records bigint, writes bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select r.run,
         min(r.via)                     as via,
         min(r.at)                      as started,
         max(r.at)                      as ended,
         count(distinct r.record_id)    as records,
         count(*)                       as writes
  from public.record_revisions r
  where r.workspace_id = ws
    and r.run is not null
    and (select public.in_workspace(ws))
    and (since is null or r.at > since)
  group by r.run
  order by max(r.at) desc
  limit 100;
$$;

revoke all on function public.agent_runs(uuid, timestamptz) from public, anon;
grant execute on function public.agent_runs(uuid, timestamptz) to authenticated;
