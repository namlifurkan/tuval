-- What a key may do, and for how long -----------------------------------------------------------
-- A key used to be the whole workspace, forever, with no way to ask for less. Two things were
-- wrong with that. It could write when all it was ever meant to do was read, and it could read a
-- page the person who made it cannot open: the gateway filtered by workspace and nothing else, so
-- naming people on a page shut out the app and left the door standing open.
--
-- So a key carries a scope and an expiry, and it speaks for the person who made it. The gateway
-- holds the service key and can read anything, which is exactly why the question of what one page
-- allows has to be answered here, where the rest of access is written.

alter table public.api_keys
  add column if not exists scope      text not null default 'write',
  add column if not exists expires_at timestamptz;

alter table public.api_keys drop constraint if exists api_keys_scope_check;
alter table public.api_keys add constraint api_keys_scope_check check (scope in ('read', 'write'));

-- The gate, asked on behalf of somebody -----------------------------------------------------------
-- can_read_record() reads auth.uid(), and behind an API key there is no auth.uid() to read. These
-- take the user instead, so the door asks the same question about the same page that the app asks.

create or replace function public.workspace_seat(who uuid, ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when who is null or ws is null then null
    when exists (select 1 from public.workspaces w where w.id = ws and w.owner = who) then 'owner'
    else (
      select m.role from public.workspace_members m
      where m.workspace_id = ws and m.user_id = who
    )
  end;
$$;

-- Answered for a page of rows at once, because the door lists before it reads and asking once per
-- row would turn one listing into five hundred round trips.
create or replace function public.can_read_records_as(who uuid, ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(r.id), '{}'::uuid[])
  from public.records r
  cross join lateral (
    select public.workspace_seat(who, r.workspace_id) as seat,
           public.record_gate(r.id) as gate
  ) x
  where r.id = any (ids)
    and x.seat is not null
    and x.seat <> 'blocked'
    and (
      x.gate is null
      or x.seat = 'owner'
      or exists (
        select 1 from public.record_members m
        where m.record_id = x.gate and m.user_id = who and m.role <> 'blocked'
      )
    );
$$;

create or replace function public.can_write_record_as(who uuid, rec uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ws   uuid;
  seat text;
  gate uuid;
begin
  if rec is null then return true; end if;
  select r.workspace_id into ws from public.records r where r.id = rec;
  if ws is null then return true; end if;

  seat := public.workspace_seat(who, ws);
  if seat is null or seat not in ('owner', 'admin', 'member') then return false; end if;

  gate := public.record_gate(rec);
  if gate is null or seat = 'owner' then return true; end if;

  return exists (
    select 1 from public.record_members m
    where m.record_id = gate and m.user_id = who and m.role = 'editor'
  );
end;
$$;

-- What the gateway asks ---------------------------------------------------------------------------
-- One question, three answers: which workspace, whose eyes, and whether it may write. The uuid it
-- used to return could say none of the last two, so it is replaced rather than kept beside.
--
-- A key is never more than the person holding it. Taking them out of the workspace closes their
-- key with them, and a guest's key reads however it was written, because the alternative is a way
-- to keep a seat after losing one.

drop function if exists public.workspace_for_key(text);

create or replace function public.workspace_for_key(token text)
returns table (workspace_id uuid, acting uuid, scope text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.api_keys;
  seat  text;
begin
  select * into found from public.api_keys k
  where k.token_sha = encode(extensions.digest(token, 'sha256'), 'hex')
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now());

  -- A key with nobody behind it cannot be asked what that person may open, so it opens nothing.
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

  update public.api_keys set last_used_at = now() where id = found.id;

  workspace_id := found.workspace_id;
  acting       := found.created_by;
  scope        := case
    when found.scope = 'write' and seat in ('owner', 'admin', 'member') then 'write'
    else 'read'
  end;
  return next;
end;
$$;

revoke all on function public.workspace_for_key(text)              from public, authenticated, anon;
revoke all on function public.workspace_seat(uuid, uuid)           from public, authenticated, anon;
revoke all on function public.can_read_records_as(uuid, uuid[])    from public, authenticated, anon;
revoke all on function public.can_write_record_as(uuid, uuid)      from public, authenticated, anon;

grant execute on function public.workspace_for_key(text)           to service_role;
grant execute on function public.can_read_records_as(uuid, uuid[]) to service_role;
grant execute on function public.can_write_record_as(uuid, uuid)   to service_role;
