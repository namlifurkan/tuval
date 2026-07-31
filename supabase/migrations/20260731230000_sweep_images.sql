-- Removing an image ---------------------------------------------------------------------------
-- Deleting an item left its object behind for ever, and deleting a board left the whole folder.
-- Nothing could remove them either: the bucket had policies for reading and writing and none
-- for deleting, so every attempt was refused.
--
-- Whoever may write to a board may remove its images.

drop policy if exists images_delete on storage.objects;

create policy images_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'board-images'
    and (select public.can_write_board(split_part(name, '/', 1)))
  );
