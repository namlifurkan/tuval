-- The write gate is told which workspace it is answering for ------------------------------------
-- can_write_record_as(who, rec) answered true for a null record before it looked at anything, so
-- "may this person write here?" with nothing named was a yes. Nothing reachable turned on it —
-- the door only ever asks about a parent, and a key with write scope already belongs to somebody
-- with a seat — but a function that is safe because of its caller is safe until the next caller.
--
-- So it takes the workspace too. A null record now means the top of that workspace, which is a
-- question about the seat and is answered as one, and a record belonging somewhere else is
-- refused rather than judged on its own terms.

drop function if exists public.can_write_record_as(uuid, uuid);

create or replace function public.can_write_record_as(who uuid, ws uuid, rec uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  holds uuid;
  seat  text;
  gate  uuid;
begin
  seat := public.workspace_seat(who, ws);
  if seat is null or seat not in ('owner', 'admin', 'member') then return false; end if;

  if rec is null then return true; end if;

  select r.workspace_id into holds from public.records r where r.id = rec;
  -- Nothing there is nothing to refuse; a row in another workspace is not this key's business.
  if holds is null then return true; end if;
  if holds <> ws then return false; end if;

  gate := public.record_gate(rec);
  if gate is null or seat = 'owner' then return true; end if;

  return exists (
    select 1 from public.record_members m
    where m.record_id = gate and m.user_id = who and m.role = 'editor'
  );
end;
$$;

revoke all on function public.can_write_record_as(uuid, uuid, uuid) from public, authenticated, anon;
grant execute on function public.can_write_record_as(uuid, uuid, uuid) to service_role;
