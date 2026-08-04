-- A board was write-only from outside. An agent could make one — create_board takes a brief and
-- the browser draws it — and then had no way to read what came back, because the document is a
-- CRDT and only a browser materialises it. So the loop that this product exists for, a canvas
-- becoming a brief and a brief becoming a canvas, ran in one direction.
--
-- The answer is the one already in use for pages: `records.markdown` is a flattened copy the
-- browser writes beside the real document so Postgres has something to index and the API has
-- something to serve. A board gets the same. Nothing decodes Yjs on the server, and the reading
-- that turns a canvas into prose stays in the one place it is written and tested.
--
-- It is a copy, so it is exactly as old as the last save by somebody with the board open. That is
-- the same bargain the page markdown makes, and it is written down rather than implied.

alter table public.board_snapshots add column if not exists markdown text;

create or replace function public.save_board_snapshot(
  room text,
  snapshot text,
  item_count integer,
  frame_count integer,
  thumbnail text default null,
  reading text default null
)
returns void
language sql
security invoker
set search_path = ''
as $$
  insert into public.board_snapshots (board_id, doc, items, frames, thumb, markdown, updated_at)
  values (room, decode(snapshot, 'base64'), item_count, frame_count, thumbnail, reading, now())
  on conflict (board_id) do update
  set doc = excluded.doc,
      items = excluded.items,
      frames = excluded.frames,
      thumb = coalesce(excluded.thumb, board_snapshots.thumb),
      markdown = coalesce(excluded.markdown, board_snapshots.markdown),
      updated_at = excluded.updated_at;
$$;

revoke all on function public.save_board_snapshot(text, text, integer, integer, text, text)
  from public, anon;
grant execute on function public.save_board_snapshot(text, text, integer, integer, text, text)
  to authenticated, service_role;

-- The five-argument shape is gone: every caller sends the reading, and two functions of the same
-- name would let a stale client keep writing snapshots that no reader can use.
drop function if exists public.save_board_snapshot(text, text, integer, integer, text);

-- The API holds the service key, so it asks the same question the client's own policies ask, on
-- behalf of the person whose key is being used. `can_read_board` reads auth.uid(); this one is
-- handed the reader, and that is the only difference between them.
--
-- The workspace half is asked through `workspace_seat`, which is where the answer to "is this
-- person in that workspace" already lives, rather than by joining `workspace_members` again here.
-- Two copies of an access rule agree until the day one of them is changed.
create or replace function public.can_read_board_as(who uuid, board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner = who
  ) or (
    not exists (
      select 1 from public.board_members m
      where m.board_id = board and m.user_id = who and m.role = 'blocked'
    ) and (
      exists (
        select 1 from public.board_members m
        where m.board_id = board and m.user_id = who
      ) or exists (
        select 1 from public.boards b
        where b.id = board
          and coalesce(public.workspace_seat(who, b.workspace_id), 'blocked') <> 'blocked'
      ) or (select public.board_is_public(board))
    )
  );
$$;

revoke all on function public.can_read_board_as(uuid, text) from public, authenticated, anon;
grant execute on function public.can_read_board_as(uuid, text) to service_role;
