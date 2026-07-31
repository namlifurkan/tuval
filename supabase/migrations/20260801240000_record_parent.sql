-- A page inside a page. Notion's spine is the tree, and the tree is one column: a record points
-- at the record it sits under. An adjacency list rather than a path, because a workspace holds
-- hundreds of pages, not millions, and the whole set is already loaded to draw the sidebar.
--
-- Cascade on delete matches what the column means: a page is not a place its children can stay
-- once it is gone. Archiving, which is what the product actually does, leaves them alone.

alter table public.records
  add column if not exists parent_id uuid references public.records on delete cascade;

create index if not exists records_parent_idx on public.records (parent_id)
  where archived_at is null;
