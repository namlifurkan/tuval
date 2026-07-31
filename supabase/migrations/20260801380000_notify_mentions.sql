-- Telling the people named in a page ------------------------------------------------------------
-- The client is the only thing that can read a document, so it is the one that knows who was
-- named in it. It cannot know who has already been told, because an inbox is not readable from
-- outside — so the deciding happens here, where the index can be consulted.
--
-- A page is saved every few seconds while somebody writes in it. Without the do-nothing this
-- would be the same news over and over.

create or replace function public.notify_mentions(record uuid, people uuid[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws uuid;
  me uuid := (select auth.uid());
begin
  select r.workspace_id into ws from public.records r where r.id = record;
  if ws is null or not public.can_write_workspace(ws) then
    return;
  end if;

  insert into public.notifications (workspace_id, user_id, actor, kind, record_id)
  select ws, person, me, 'mentioned', record
  from unnest(people) as person
  -- Only people who are actually in this workspace, so a hand-made call cannot post into the
  -- inbox of somebody who has never heard of it.
  where person is distinct from me
    and (
      exists (select 1 from public.workspaces w where w.id = ws and w.owner = person)
      or exists (
        select 1 from public.workspace_members m
        where m.workspace_id = ws and m.user_id = person and m.role <> 'blocked'
      )
    )
  on conflict (user_id, record_id) where kind = 'mentioned' do nothing;
end;
$$;

revoke all on function public.notify_mentions(uuid, uuid[]) from public;
grant execute on function public.notify_mentions(uuid, uuid[]) to authenticated;
