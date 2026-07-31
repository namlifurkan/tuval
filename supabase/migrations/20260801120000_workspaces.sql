-- Workspaces ---------------------------------------------------------------------------------
-- A board had no parent, so every question about access was asked of the board itself. That
-- works for one team sharing a handful of boards and not for a product where several companies
-- share an installation: there was nothing a board belonged to, and so nothing to isolate.
--
-- The workspace becomes the root. Membership of it is the default way in; the per-board grants
-- that exist today stay, as the exception for hiding a board from the team or opening one to a
-- guest. Nothing a user can see changes in this migration.

create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null default '',
  owner       uuid not null references auth.users on delete cascade,
  created_at  timestamptz not null default now()
);

create table if not exists public.workspace_members (
  workspace_id  uuid not null references public.workspaces on delete cascade,
  user_id       uuid not null references auth.users on delete cascade,
  role          text not null default 'member' check (role in ('admin', 'member', 'guest', 'blocked')),
  email         text,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, user_id)
);

create index if not exists workspace_members_user_idx on public.workspace_members (user_id);

alter table public.boards add column if not exists workspace_id uuid references public.workspaces;
create index if not exists boards_workspace_idx on public.boards (workspace_id);

alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;

-- Checked through a security definer function for the same reason boards are: policies on
-- workspaces and workspace_members would otherwise recurse into each other.
create or replace function public.in_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select ws is not null and (
    exists (select 1 from public.workspaces w where w.id = ws and w.owner = (select auth.uid()))
    or exists (
      select 1 from public.workspace_members m
      where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role <> 'blocked'
    )
  );
$$;

create or replace function public.owns_workspace(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.workspaces w where w.id = ws and w.owner = (select auth.uid())
  ) or exists (
    select 1 from public.workspace_members m
    where m.workspace_id = ws and m.user_id = (select auth.uid()) and m.role = 'admin'
  );
$$;

drop policy if exists workspaces_read   on public.workspaces;
drop policy if exists workspaces_insert on public.workspaces;
drop policy if exists workspaces_write  on public.workspaces;
drop policy if exists ws_members_read   on public.workspace_members;
drop policy if exists ws_members_write  on public.workspace_members;

create policy workspaces_read on public.workspaces for select to authenticated
  using ((select public.in_workspace(id)));

create policy workspaces_insert on public.workspaces for insert to authenticated
  with check (owner = (select auth.uid()));

create policy workspaces_write on public.workspaces for all to authenticated
  using ((select public.owns_workspace(id)))
  with check ((select public.owns_workspace(id)));

create policy ws_members_read on public.workspace_members for select to authenticated
  using ((select public.in_workspace(workspace_id)));

create policy ws_members_write on public.workspace_members for all to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

-- Existing boards have an owner and no workspace. Each owner gets one, named after the address
-- they sign in with, and their boards move into it. Runs twice without effect: a board that
-- already has a workspace is left alone.
do $$
declare
  person record;
  ws uuid;
begin
  for person in
    select distinct b.owner, (select u.email from auth.users u where u.id = b.owner) as email
    from public.boards b where b.workspace_id is null
  loop
    select w.id into ws from public.workspaces w where w.owner = person.owner limit 1;

    if ws is null then
      insert into public.workspaces (slug, name, owner)
      values (
        coalesce(split_part(person.email, '@', 1), 'workspace') || '-' || left(person.owner::text, 8),
        coalesce(split_part(person.email, '@', 1), 'Workspace'),
        person.owner
      )
      returning id into ws;
    end if;

    update public.boards set workspace_id = ws
    where owner = person.owner and workspace_id is null;
  end loop;
end
$$;

-- Reading a board: the workspace is now the default answer, the per-board grants remain the
-- exception, and being blocked at either level still wins over everything.
create or replace function public.can_read_board(board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner = (select auth.uid())
  ) or (
    not exists (
      select 1 from public.board_members m
      where m.board_id = board and m.user_id = (select auth.uid()) and m.role = 'blocked'
    ) and (
      exists (
        select 1 from public.board_members m
        where m.board_id = board and m.user_id = (select auth.uid())
      ) or exists (
        select 1 from public.boards b
        where b.id = board and (select public.in_workspace(b.workspace_id))
      ) or exists (
        select 1 from public.boards b
        where b.id = board and b.allowed_domain is not null
          and b.allowed_domain = public.email_domain((select auth.jwt() ->> 'email'))
      )
    )
  );
$$;

create or replace function public.can_write_board(board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner = (select auth.uid())
  ) or (
    not exists (
      select 1 from public.board_members m
      where m.board_id = board and m.user_id = (select auth.uid()) and m.role <> 'editor'
    ) and (
      exists (
        select 1 from public.board_members m
        where m.board_id = board and m.user_id = (select auth.uid()) and m.role = 'editor'
      ) or exists (
        select 1 from public.boards b
        where b.id = board and (select public.in_workspace(b.workspace_id))
      ) or exists (
        select 1 from public.boards b
        where b.id = board and b.allowed_domain is not null and b.domain_role = 'editor'
          and b.allowed_domain = public.email_domain((select auth.jwt() ->> 'email'))
      )
    )
  );
$$;
