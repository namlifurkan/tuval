-- Board images ------------------------------------------------------------------------------
-- The bucket was public and readable by anyone holding a link, so removing somebody from a
-- board left every image they had ever seen reachable for good. Writing was open too: any
-- signed-in account could upload into any board's folder.
--
-- Objects are stored as <board id>/<uuid>.<ext>, so the board an object belongs to is the
-- first path segment and the same access rules as the tables apply.

update storage.buckets set public = false where id = 'board-images';

drop policy if exists images_read   on storage.objects;
drop policy if exists images_insert on storage.objects;
drop policy if exists images_write  on storage.objects;

create policy images_read on storage.objects for select to authenticated
  using (
    bucket_id = 'board-images'
    and (select public.can_read_board(split_part(name, '/', 1)))
  );

create policy images_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'board-images'
    and (select public.can_write_board(split_part(name, '/', 1)))
  );
