-- Board thumbnails ---------------------------------------------------------------------------
-- The board list needs a picture of every board. Loading and decoding each document just to
-- draw one is expensive and needs read access to all of them, so an open board writes its own
-- thumbnail alongside its snapshot: a 384x240 WebP data URL, a few kilobytes.

alter table public.board_snapshots add column if not exists thumb text;
