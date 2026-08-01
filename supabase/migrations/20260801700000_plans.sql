-- What the hosted one costs -----------------------------------------------------------------------
-- The code is AGPL and stays that way: anybody may run this on their own machine, for nothing,
-- with everything switched on. What is being paid for here is somebody else running it — the
-- disks, the bandwidth and the answering.
--
-- So the limits are the things that actually cost money to serve, and nothing else. Not a feature
-- held back to make a plan look thin: seats, files, and the door that lets a robot in.
--
-- All of it is decided in the database. A limit checked in the browser of an open-source product
-- is a limit somebody deletes in an afternoon.

alter table public.workspaces
  add column if not exists plan         text not null default 'free',
  add column if not exists plan_until   timestamptz,
  add column if not exists customer_ref text;

alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces add constraint workspaces_plan_check
  check (plan in ('free', 'team'));

-- One place that says what a plan allows, so the screen that shows a limit and the trigger that
-- enforces it cannot disagree about what it is.
create or replace function public.plan_limits(plan text, seats_used int)
returns table (seats int, bytes bigint, api boolean)
language sql
immutable
set search_path = ''
as $$
  select
    case when plan = 'team' then 200 else 3 end,
    case when plan = 'team' then greatest(seats_used, 1)::bigint * 10 * 1024 * 1024 * 1024
         else 1024 * 1024 * 1024 end,
    plan = 'team';
$$;

-- A plan that has run out is the free plan again, rather than a workspace that stops working.
-- Nobody loses what they wrote because a card expired.
create or replace function public.plan_of(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when w.plan = 'team' and (w.plan_until is null or w.plan_until > now()) then 'team'
    else 'free'
  end
  from public.workspaces w where w.id = ws;
$$;

create or replace function public.workspace_bytes(ws uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum((o.metadata ->> 'size')::bigint), 0)
  from storage.objects o
  where o.name like ws::text || '/%';
$$;

create or replace function public.workspace_seats(ws uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  -- The owner, everybody not blocked, and everybody invited but not yet arrived: an invitation
  -- that has been sent is a seat that has been taken.
  select 1
    + (select count(*) from public.workspace_members m
       where m.workspace_id = ws and m.role <> 'blocked'
         and m.user_id <> (select w.owner from public.workspaces w where w.id = ws))
    + (select count(*) from public.workspace_invites i where i.workspace_id = ws);
$$;

-- What the settings screen shows. One question, one answer, and the same numbers the triggers use.
create or replace function public.workspace_usage(ws uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  held  text;
  seats int;
  cap   record;
begin
  if not public.in_workspace(ws) then
    return null;
  end if;

  held := public.plan_of(ws);
  seats := public.workspace_seats(ws);
  select * into cap from public.plan_limits(held, seats);

  return jsonb_build_object(
    'plan', held,
    'until', (select w.plan_until from public.workspaces w where w.id = ws),
    'seats', seats,
    'seat_limit', cap.seats,
    'bytes', public.workspace_bytes(ws),
    'byte_limit', cap.bytes,
    'api', cap.api,
    'records', (select count(*) from public.records r
                where r.workspace_id = ws and r.archived_at is null)
  );
end;
$$;

grant execute on function public.workspace_usage(uuid) to authenticated;

-- Seats -------------------------------------------------------------------------------------------
-- Checked where a seat is actually taken: somebody joining, and somebody being invited. Both, or
-- a workspace could invite its way past the limit and only find out when people arrived.

create or replace function public.check_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws  uuid := new.workspace_id;
  cap record;
begin
  select * into cap from public.plan_limits(public.plan_of(ws), public.workspace_seats(ws));
  if public.workspace_seats(ws) >= cap.seats then
    raise exception 'seat limit reached'
      using hint = 'This workspace is on a plan with ' || cap.seats || ' seats.';
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_members_seats on public.workspace_members;
create trigger workspace_members_seats before insert on public.workspace_members
  for each row execute function public.check_seats();

drop trigger if exists workspace_invites_seats on public.workspace_invites;
create trigger workspace_invites_seats before insert on public.workspace_invites
  for each row execute function public.check_seats();

-- Files -------------------------------------------------------------------------------------------
-- The path opens with the workspace id in every bucket here, which is what makes this one line.

create or replace function public.check_bytes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws  uuid;
  cap record;
  now_bytes bigint;
begin
  ws := nullif(split_part(new.name, '/', 1), '')::uuid;
  if ws is null then
    return new;
  end if;

  select * into cap from public.plan_limits(public.plan_of(ws), public.workspace_seats(ws));
  now_bytes := public.workspace_bytes(ws);

  if now_bytes + coalesce((new.metadata ->> 'size')::bigint, 0) > cap.bytes then
    raise exception 'storage limit reached'
      using hint = 'This workspace may hold ' || (cap.bytes / 1024 / 1024) || ' MB of files.';
  end if;
  return new;
exception when invalid_text_representation then
  -- A path that does not open with a workspace id belongs to something else entirely.
  return new;
end;
$$;

drop trigger if exists storage_objects_bytes on storage.objects;
create trigger storage_objects_bytes before insert on storage.objects
  for each row execute function public.check_bytes();

-- The door for robots ------------------------------------------------------------------------------
-- An API key belongs to a workspace, and a workspace on the free plan does not have one open.
-- Refused here rather than at the gateway, so it is refused however somebody arrives.

create or replace function public.workspace_for_key(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.api_keys;
begin
  select * into found from public.api_keys k
  where k.token_sha = encode(extensions.digest(token, 'sha256'), 'hex')
    and k.revoked_at is null;

  if found.id is null then
    return null;
  end if;

  if public.plan_of(found.workspace_id) <> 'team' then
    return null;
  end if;

  update public.api_keys set last_used_at = now() where id = found.id;
  return found.workspace_id;
end;
$$;

revoke all on function public.workspace_for_key(text) from public, authenticated, anon;
