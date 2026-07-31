-- Everybody has a workspace ------------------------------------------------------------------
-- The migration that introduced workspaces gave one to every existing board owner. Someone
-- signing up after it has none, and a board with no workspace is a board outside the model.
--
-- Called on sign in. Security definer because creating the row and its membership are two
-- writes that must not be half done, and because the caller cannot yet see what is being made.

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

  select w.id into ws from public.workspaces w where w.owner = who limit 1;
  if ws is not null then return ws; end if;

  -- Being invited into somebody else's workspace is enough; no personal one is made.
  select m.workspace_id into ws
  from public.workspace_members m
  where m.user_id = who and m.role <> 'blocked'
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

-- Where a new board belongs. The client passes nothing: the board goes to the workspace the
-- person is in, which is the only one they could mean.
create or replace function public.my_workspace()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select w.id from public.workspaces w where w.owner = (select auth.uid()) limit 1),
    (select m.workspace_id from public.workspace_members m
     where m.user_id = (select auth.uid()) and m.role <> 'blocked' limit 1)
  );
$$;

revoke all on function public.my_workspace() from public;
grant execute on function public.my_workspace() to authenticated;

-- A board created without one lands in its owner's workspace rather than outside the model.
create or replace function public.boards_default_workspace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.workspace_id is null then
    new.workspace_id := public.my_workspace();
  end if;
  return new;
end;
$$;

drop trigger if exists boards_workspace_default on public.boards;
create trigger boards_workspace_default before insert on public.boards
  for each row execute function public.boards_default_workspace();
