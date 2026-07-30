-- Tuval — run this once in the Supabase SQL editor.
-- A board is identified by its room id, the same string that appears in the URL hash.

create table if not exists public.boards (
  id          text primary key,
  owner       uuid not null references auth.users on delete cascade,
  name        text not null default '',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.board_members (
  board_id  text not null references public.boards on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'editor' check (role in ('editor', 'viewer')),
  primary key (board_id, user_id)
);

-- One row per board. The document is a Yjs update, applied on open and rewritten on save.
create table if not exists public.board_snapshots (
  board_id    text primary key references public.boards on delete cascade,
  doc         bytea not null,
  items       int not null default 0,
  frames      int not null default 0,
  updated_at  timestamptz not null default now()
);

create index if not exists boards_owner_idx on public.boards (owner);
create index if not exists board_members_user_idx on public.board_members (user_id);

alter table public.boards           enable row level security;
alter table public.board_members    enable row level security;
alter table public.board_snapshots  enable row level security;

-- Membership is checked through a security definer function so the policies on boards and
-- board_members cannot recurse into each other.
create or replace function public.can_read_board(board text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner = auth.uid()
  ) or exists (
    select 1 from public.board_members m where m.board_id = board and m.user_id = auth.uid()
  );
$$;

create or replace function public.can_write_board(board text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner = auth.uid()
  ) or exists (
    select 1 from public.board_members m
    where m.board_id = board and m.user_id = auth.uid() and m.role = 'editor'
  );
$$;

drop policy if exists boards_read   on public.boards;
drop policy if exists boards_insert on public.boards;
drop policy if exists boards_update on public.boards;
drop policy if exists boards_delete on public.boards;

create policy boards_read   on public.boards for select using (public.can_read_board(id));
create policy boards_insert on public.boards for insert with check (owner = auth.uid());
create policy boards_update on public.boards for update using (public.can_write_board(id));
create policy boards_delete on public.boards for delete using (owner = auth.uid());

drop policy if exists members_read   on public.board_members;
drop policy if exists members_write  on public.board_members;

create policy members_read  on public.board_members for select using (public.can_read_board(board_id));
create policy members_write on public.board_members for all
  using (exists (select 1 from public.boards b where b.id = board_id and b.owner = auth.uid()))
  with check (exists (select 1 from public.boards b where b.id = board_id and b.owner = auth.uid()));

drop policy if exists snapshots_read  on public.board_snapshots;
drop policy if exists snapshots_write on public.board_snapshots;

create policy snapshots_read  on public.board_snapshots for select using (public.can_read_board(board_id));
create policy snapshots_write on public.board_snapshots for all
  using (public.can_write_board(board_id))
  with check (public.can_write_board(board_id));

-- Images referenced by items. Public read keeps <img> and canvas drawing simple; writes are
-- restricted to signed-in users.
insert into storage.buckets (id, name, public)
values ('board-images', 'board-images', true)
on conflict (id) do nothing;

drop policy if exists images_read   on storage.objects;
drop policy if exists images_insert on storage.objects;

create policy images_read on storage.objects for select
  using (bucket_id = 'board-images');

create policy images_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'board-images');
