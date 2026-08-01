-- Files hung off a row ---------------------------------------------------------------------------
-- Covers live in their own bucket because a cover is an image this product made: cropped,
-- re-encoded, size known. An attachment is whatever somebody had, so it gets its own bucket with
-- its own ceiling rather than being squeezed in beside them.
--
-- The path opens with the workspace id, which is the whole of the access rule: the same shape the
-- covers bucket uses, so there is one convention rather than two.

insert into storage.buckets (id, name, public, file_size_limit)
values ('attachments', 'attachments', false, 26214400)
on conflict (id) do update set public = false, file_size_limit = 26214400;

drop policy if exists attachments_read   on storage.objects;
drop policy if exists attachments_write  on storage.objects;
drop policy if exists attachments_update on storage.objects;
drop policy if exists attachments_delete on storage.objects;

create policy attachments_read on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (select public.in_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );

create policy attachments_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (select public.can_write_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );

create policy attachments_update on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (select public.can_write_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );

create policy attachments_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (select public.can_write_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );
