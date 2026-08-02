-- A board's document lived in one row that every save overwrote, so two people saving meant the
-- last writer won and the other one's work was gone. Yjs updates are commutative, so nothing has
-- to be overwritten: append each update as its own row and let a reader apply them in order.
--
-- The snapshot stays. It stops being the document and becomes a starting point: load the snapshot,
-- then every update numbered above it. Compacting is folding those rows back into the snapshot and
-- deleting them, which compact_board_updates() below allows. Nothing calls it yet.

create table if not exists public.board_updates (
  board_id    text   not null references public.boards on delete cascade,
  seq         bigint not null,
  update      bytea  not null,
  created_at  timestamptz not null default now(),
  primary key (board_id, seq),
  constraint board_updates_size check (octet_length(update) between 1 and 1048576)
);

alter table public.board_updates enable row level security;

drop policy if exists board_updates_read  on public.board_updates;
drop policy if exists board_updates_write on public.board_updates;

create policy board_updates_read on public.board_updates for select to authenticated
  using ((select public.can_read_board(board_id)));

create policy board_updates_write on public.board_updates for all to authenticated
  using ((select public.can_write_board(board_id)))
  with check ((select public.can_write_board(board_id)));

-- Two people appending at the same instant must not be handed the same number, and a reader
-- asking for "everything above N" must not have a row appear below N after it has already read
-- past it. One lock per board answers both: it is taken before the last number is read and held
-- until the transaction ends, so numbers are handed out in the order the rows become visible.
-- 8102 is this lock's namespace, keeping it clear of any other advisory lock in the database.
--
-- Bytes arrive base64 for the same reason the snapshot does: a hex literal is twice the size and
-- costs one JS string per byte. Over the limit is refused, never quietly cut short — half a Yjs
-- update is not a smaller update, it is a corrupt one.
create or replace function public.append_board_update(room text, payload text)
returns bigint
language plpgsql
security invoker
set search_path = ''
as $$
declare
  bytes bytea := decode(payload, 'base64');
  written bigint;
begin
  if octet_length(bytes) = 0 then
    raise exception 'board update is empty';
  end if;
  if octet_length(bytes) > 1048576 then
    raise exception 'board update is % bytes, over the 1048576 byte limit', octet_length(bytes);
  end if;

  perform pg_advisory_xact_lock(8102, hashtext(room));

  insert into public.board_updates (board_id, seq, update)
  select room, coalesce(max(u.seq), 0) + 1, bytes
  from public.board_updates u
  where u.board_id = room
  returning seq into written;

  return written;
end;
$$;

revoke all on function public.append_board_update(text, text) from public, anon;
grant execute on function public.append_board_update(text, text) to authenticated, service_role;

-- The compaction half, so the schema is not the thing standing in the way when a snapshot job
-- wants it. Numbering carries on from the highest row left, so folding old updates into the
-- snapshot never renumbers what a reader is already holding.
create or replace function public.compact_board_updates(room text, through_seq bigint)
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  gone integer;
begin
  delete from public.board_updates u where u.board_id = room and u.seq <= through_seq;
  get diagnostics gone = row_count;
  return gone;
end;
$$;

revoke all on function public.compact_board_updates(text, bigint) from public, anon;
grant execute on function public.compact_board_updates(text, bigint) to authenticated, service_role;
