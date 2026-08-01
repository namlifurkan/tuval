-- Send board bytes as base64 instead of a hand-built bytea hex literal. Base64 is a third
-- larger than the binary update; hex was twice as large and required one JS string per byte.

create or replace function public.save_board_snapshot(
  room text,
  snapshot text,
  item_count integer,
  frame_count integer,
  thumbnail text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.board_snapshots (board_id, doc, items, frames, thumb, updated_at)
  values (room, decode(snapshot, 'base64'), item_count, frame_count, thumbnail, now())
  on conflict (board_id) do update
  set doc = excluded.doc,
      items = excluded.items,
      frames = excluded.frames,
      thumb = coalesce(excluded.thumb, board_snapshots.thumb),
      updated_at = excluded.updated_at;
$$;

revoke all on function public.save_board_snapshot(text, text, integer, integer, text)
  from public, anon;
grant execute on function public.save_board_snapshot(text, text, integer, integer, text)
  to authenticated, service_role;
