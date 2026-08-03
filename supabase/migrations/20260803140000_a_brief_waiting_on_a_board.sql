-- A board somebody asked for from outside, before anybody has opened it.
--
-- The canvas is a CRDT this database cannot compose, so an agent cannot place a sticky here the
-- way it files an issue. What it can leave is the words: a brief waits in this column and the
-- first browser to open the board turns it into frames, stickies and connectors, then empties
-- the column. The same bargain `records.description` already makes for pages.
alter table public.boards add column if not exists pending_brief text;
