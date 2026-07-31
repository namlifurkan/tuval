-- Search ------------------------------------------------------------------------------------
-- The palette could find a page by its name and not by anything written in it, which is the
-- half people actually use. The body is kept as plain text beside the record: the document
-- itself is a CRDT the server cannot read, so the text is written next to it on every save.
--
-- The configuration is 'simple' rather than a language. Postgres ships no Turkish dictionary,
-- and an English stemmer applied to Turkish words is worse than no stemmer at all: it would
-- match nothing and quietly. 'simple' folds case and splits on word boundaries, which finds
-- what was typed in either language.

alter table public.records add column if not exists body text not null default '';

alter table public.records drop column if exists search;
alter table public.records add column search tsvector
  generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(body, ''))
  ) stored;

create index if not exists records_search_idx on public.records using gin (search);
