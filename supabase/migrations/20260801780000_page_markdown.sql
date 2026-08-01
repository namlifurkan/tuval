-- The page as an agent wants to read it -----------------------------------------------------------
-- The body kept beside a record is flattened text, which is what full-text search wants and is
-- nearly useless to anything trying to understand the page: no headings, no lists, no links.
--
-- Markdown is the form every agent already reads. It is written whenever somebody edits the
-- page, from the editor that is on screen at the time — the only moment the content can change
-- — so nothing has to re-render a document nobody is looking at.

alter table public.records add column if not exists markdown text;
