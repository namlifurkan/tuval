-- A board with no id -------------------------------------------------------------------------
-- The landing page runs the real editor on a document with no room so that nothing it does is
-- stored. A save that ignored the empty room wrote that document to the cloud as a board whose
-- id is the empty string, which then showed up in everyone's board list. The client no longer
-- saves without a room; the database refuses one either way.

delete from public.boards where id = '';

alter table public.boards drop constraint if exists boards_id_not_blank;
alter table public.boards add constraint boards_id_not_blank check (id <> '');
