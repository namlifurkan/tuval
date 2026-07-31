-- Records ------------------------------------------------------------------------------------
-- The thing three products share. An issue, a document, a person: one row, one identity, seen
-- through whichever view you happen to be in. A board can place one on a canvas and a list can
-- sort a thousand of them, and it is the same row.
--
-- Why a row and not a CRDT: "everything assigned to me" cannot be asked of a document the
-- server is unable to read, and in an installation several companies share, the server has to
-- be the one deciding who sees what.
--
-- The spine is columns. Fields that get queried are promoted to columns of their own, because a
-- board view groups by status and sorts by position, and doing that inside jsonb stops being
-- free at the first hundred rows. Everything else lives in data.

create table if not exists public.records (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  kind         text not null check (kind in ('issue', 'doc', 'person', 'company', 'project', 'event', 'file')),
  title        text not null default '',

  status       text check (status in ('todo', 'doing', 'blocked', 'done', 'cancelled')),
  assignee     uuid references auth.users on delete set null,
  priority     int check (priority between 0 and 3),
  due_at       timestamptz,
  -- Fractional, so a card dropped between two others is one write rather than a renumbering.
  position     double precision not null default 0,

  archived_at  timestamptz,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  data         jsonb not null default '{}'
);

create index if not exists records_workspace_idx on public.records (workspace_id, kind)
  where archived_at is null;
create index if not exists records_assignee_idx on public.records (assignee)
  where archived_at is null;
create index if not exists records_status_idx on public.records (workspace_id, status, position)
  where archived_at is null;

-- Relations are their own table and deliberately generic: issue belongs to project, document
-- mentions person, this one blocks that one. The same shape as a connector on the canvas, which
-- is what lets the whole thing be one graph rather than several.
create table if not exists public.record_links (
  from_id  uuid not null references public.records on delete cascade,
  to_id    uuid not null references public.records on delete cascade,
  kind     text not null default 'relates_to' check (kind in ('relates_to', 'belongs_to', 'blocks', 'mentions')),
  primary key (from_id, to_id, kind)
);

create index if not exists record_links_to_idx on public.record_links (to_id);

alter table public.records      enable row level security;
alter table public.record_links enable row level security;

-- A guest is in the workspace to look, not to change it.
create or replace function public.can_write_workspace(ws uuid)
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
      where m.workspace_id = ws and m.user_id = (select auth.uid())
        and m.role in ('admin', 'member')
    )
  );
$$;

drop policy if exists records_read  on public.records;
drop policy if exists records_write on public.records;
drop policy if exists links_read     on public.record_links;
drop policy if exists links_write    on public.record_links;

create policy records_read on public.records for select to authenticated
  using ((select public.in_workspace(workspace_id)));

create policy records_write on public.records for all to authenticated
  using ((select public.can_write_workspace(workspace_id)))
  with check ((select public.can_write_workspace(workspace_id)));

-- A link is readable and writable exactly when both ends are.
create policy links_read on public.record_links for select to authenticated
  using (
    exists (select 1 from public.records r where r.id = from_id and (select public.in_workspace(r.workspace_id)))
    and exists (select 1 from public.records r where r.id = to_id and (select public.in_workspace(r.workspace_id)))
  );

create policy links_write on public.record_links for all to authenticated
  using (
    exists (select 1 from public.records r where r.id = from_id and (select public.can_write_workspace(r.workspace_id)))
  )
  with check (
    exists (select 1 from public.records r where r.id = from_id and (select public.can_write_workspace(r.workspace_id)))
    and exists (select 1 from public.records r where r.id = to_id and (select public.can_write_workspace(r.workspace_id)))
  );

create or replace function public.records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists records_touched on public.records;
create trigger records_touched before update on public.records
  for each row execute function public.records_touch();
