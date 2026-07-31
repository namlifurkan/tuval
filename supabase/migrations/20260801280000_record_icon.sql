-- One character that tells twenty pages apart faster than reading twenty titles. It is on the
-- record rather than in the document because the sidebar, the breadcrumbs and the search results
-- all draw it, and none of those open a document.

alter table public.records add column if not exists icon text not null default '';
