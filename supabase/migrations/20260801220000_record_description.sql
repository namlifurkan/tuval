-- An issue without a body is a title, and a title is not a brief. This is a column rather than
-- a key in data because it is written on every keystroke and read on every open, and because
-- searching it later is a plain index rather than a jsonb expression.
--
-- Not a CRDT: a description is written by one person thinking, not two people typing at once.
-- The page editor is where shared writing lives.

alter table public.records add column if not exists description text not null default '';
