-- Live collaboration ------------------------------------------------------------------------
-- Yjs updates and cursors travel over a Supabase Realtime broadcast channel named
-- board:<room>. The channel is private, so realtime.messages needs its own policies: without
-- them anyone holding the anon key and a room id could read the live document and write to it,
-- which would walk straight around the table policies. RLS is already on for that table.

drop policy if exists board_channel_read  on realtime.messages;
drop policy if exists board_channel_write on realtime.messages;

create policy board_channel_read on realtime.messages for select to authenticated
  using (
    realtime.topic() like 'board:%'
    and (select public.can_read_board(substring(realtime.topic() from 7)))
  );

create policy board_channel_write on realtime.messages for insert to authenticated
  with check (
    realtime.topic() like 'board:%'
    and (select public.can_write_board(substring(realtime.topic() from 7)))
  );
