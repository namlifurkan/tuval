-- Trash -------------------------------------------------------------------------------------
-- Deleting a board removed the row, and everything hanging off it went with the cascade:
-- snapshot, members, invites. There was no way back from a misplaced click on a board someone
-- had spent a day on.
--
-- A board is now marked instead of removed. It stops appearing in the list, keeps working if
-- you restore it, and is only really deleted on purpose or once it has sat in the trash long
-- enough that nobody is coming back for it.

alter table public.boards add column if not exists deleted_at timestamptz;

create index if not exists boards_deleted_idx on public.boards (deleted_at)
  where deleted_at is not null;
