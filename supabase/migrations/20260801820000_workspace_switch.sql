-- Reaching a second workspace ------------------------------------------------------------------
-- Both of these functions picked a row with `limit 1` and no order at all. Somebody who owns two
-- workspaces, or owns one and was invited into another, got an arbitrary one — and an arbitrary
-- one is free to be a different one tomorrow, which moves their work without anybody touching it.
--
-- Which workspace you are in is a choice the client now makes and keeps. These two are only what
-- happens when there is no choice yet, or the stored one has become unreachable. A fallback that
-- is not deterministic is a fallback that shuffles somebody's workspace between sessions, so both
-- now take the oldest, with the id as a tiebreak.
--
-- my_workspace() also backs the boards_workspace_default trigger. The client sends workspace_id
-- on every board it creates as of this change, so the trigger is no longer what decides where a
-- board lands; it stays as the backstop for a row inserted without one.
--
-- Nothing about access changes here. in_workspace() already admits a non-blocked member, which is
-- exactly the set the switcher offers, so the owner and membership queries need no new policy.

create or replace function public.ensure_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  who   uuid := (select auth.uid());
  mail  text := (select auth.jwt() ->> 'email');
  ws    uuid;
begin
  if who is null then return null; end if;

  select w.id into ws from public.workspaces w
  where w.owner = who
  order by w.created_at, w.id
  limit 1;
  if ws is not null then return ws; end if;

  -- Being invited into somebody else's workspace is enough; no personal one is made.
  select m.workspace_id into ws
  from public.workspace_members m
  where m.user_id = who and m.role <> 'blocked'
  order by m.created_at, m.workspace_id
  limit 1;
  if ws is not null then return ws; end if;

  insert into public.workspaces (slug, name, owner)
  values (
    coalesce(nullif(split_part(mail, '@', 1), ''), 'workspace') || '-' || left(who::text, 8),
    coalesce(nullif(split_part(mail, '@', 1), ''), 'Workspace'),
    who
  )
  returning id into ws;

  return ws;
end;
$$;

revoke all on function public.ensure_workspace() from public;
grant execute on function public.ensure_workspace() to authenticated;

create or replace function public.my_workspace()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select w.id from public.workspaces w
     where w.owner = (select auth.uid())
     order by w.created_at, w.id limit 1),
    (select m.workspace_id from public.workspace_members m
     where m.user_id = (select auth.uid()) and m.role <> 'blocked'
     order by m.created_at, m.workspace_id limit 1)
  );
$$;

revoke all on function public.my_workspace() from public;
grant execute on function public.my_workspace() to authenticated;
