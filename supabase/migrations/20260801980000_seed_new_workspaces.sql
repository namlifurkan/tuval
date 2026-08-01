-- A new workspace should demonstrate the model instead of opening five empty rooms. The project
-- is the common spine: its board, issue and page appear together and can be renamed or deleted
-- like ordinary work. Existing workspaces are untouched.

-- Boards predate workspaces, and the original retrofit omitted its delete action. A workspace
-- cannot be removed while even its seeded board exists unless the relationship owns the board.
alter table public.boards drop constraint if exists boards_workspace_id_fkey;
alter table public.boards
  add constraint boards_workspace_id_fkey
  foreign key (workspace_id) references public.workspaces on delete cascade;

create or replace function public.ensure_workspace()
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  who      uuid := (select auth.uid());
  mail     text := (select auth.jwt() ->> 'email');
  ws       uuid;
  project  uuid;
begin
  if who is null then return null; end if;

  select w.id into ws from public.workspaces w
  where w.owner = who
  order by w.created_at, w.id
  limit 1;
  if ws is not null then return ws; end if;

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

  insert into public.records (workspace_id, kind, title, description, created_by)
  values (
    ws, 'project', 'Start here',
    'A small trail through Tuval: the board, issue and page below are the same piece of work.',
    who
  )
  returning id into project;

  insert into public.records
    (workspace_id, kind, title, description, status, project_id, created_by)
  values (
    ws, 'issue', 'Move one thing on the canvas',
    'Open the Start here board, move a card, then come back and mark this done.',
    'todo', project, who
  );

  insert into public.records
    (workspace_id, kind, title, description, project_id, created_by)
  values (
    ws, 'doc', 'How this workspace fits together',
    'Boards are the spatial view; issues and pages are records. This page and the first issue belong to Start here.',
    project, who
  );

  insert into public.boards (id, owner, name, workspace_id, project_id)
  values ('start-' || replace(left(ws::text, 18), '-', ''), who, 'Start here', ws, project);

  return ws;
end;
$$;

revoke all on function public.ensure_workspace() from public, anon;
grant execute on function public.ensure_workspace() to authenticated;
