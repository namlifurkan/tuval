-- When you last looked ---------------------------------------------------------------------------
-- An agent can write forty records overnight and nothing in the product says where to look in the
-- morning. Every screen sorts by when a thing changed; none of them knows when you last saw it.
--
-- One timestamp per person per workspace is enough for that. It rides on the membership row
-- rather than earning a table, because it is exactly as long-lived as the membership is and dies
-- with it.
--
-- It is written by a function rather than by the client, because the write policy on this table
-- belongs to whoever administers the workspace: a member may say they have looked without being
-- able to say anything else about their seat.

alter table public.workspace_members add column if not exists seen_at timestamptz;

create or replace function public.mark_workspace_seen(ws uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  looked timestamptz := now();
begin
  update public.workspace_members m
  set seen_at = looked
  where m.workspace_id = ws
    and m.user_id = (select auth.uid())
    and m.role <> 'blocked';

  if not found then return null; end if;
  return looked;
end;
$$;

revoke all on function public.mark_workspace_seen(uuid) from public, anon;
grant execute on function public.mark_workspace_seen(uuid) to authenticated;
