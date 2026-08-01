-- A collection is not a folder. A folder is a place a thing was put; a collection is a question
-- asked again every time you look at it — everything of mine that is late, everything tagged
-- decision — so nothing has to be filed into it and nothing falls out of it when it changes.
--
-- It is a record like any other, so it inherits the workspace, the sharing, the archiving and
-- the trash without any of them being written twice. The question itself lives in data: it is
-- read whole and written whole by one screen and never filtered on by the server.

alter table public.records drop constraint if exists records_kind_check;
alter table public.records add constraint records_kind_check check (
  kind in ('issue', 'doc', 'database', 'collection', 'person', 'company', 'project', 'event', 'file')
);
