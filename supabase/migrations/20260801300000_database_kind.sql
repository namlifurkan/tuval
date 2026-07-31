-- A database is a page whose children are its rows, so it needs no table of its own: the tree
-- already models "these records belong to that one". What it does need is a name for itself,
-- because the page tree draws a database as a leaf while a page shows what is under it.
--
-- Its columns and its views live in data, not in columns of their own. They are read whole and
-- written whole by one screen, never filtered on by the server, and every one of them would be
-- a migration if a person adding a column had to ask us first.

alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check check (
  kind in ('issue', 'doc', 'database', 'person', 'company', 'project', 'event', 'file')
);
