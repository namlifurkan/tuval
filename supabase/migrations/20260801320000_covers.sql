-- Covers ------------------------------------------------------------------------------------
-- A cover is the page, and a page is only for the workspace it is in, so unlike an avatar this
-- bucket is private and every read is signed. The first folder is the workspace, which is what
-- makes both questions answerable from the path alone: who may look, and who may write.

insert into storage.buckets (id, name, public)
values ('covers', 'covers', false)
on conflict (id) do update set public = false;

drop policy if exists covers_read   on storage.objects;
drop policy if exists covers_write  on storage.objects;
drop policy if exists covers_update on storage.objects;
drop policy if exists covers_delete on storage.objects;

create policy covers_read on storage.objects for select to authenticated
  using (
    bucket_id = 'covers'
    and (select public.in_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );

create policy covers_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (select public.can_write_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );

create policy covers_update on storage.objects for update to authenticated
  using (
    bucket_id = 'covers'
    and (select public.can_write_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );

create policy covers_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'covers'
    and (select public.can_write_workspace(nullif(split_part(name, '/', 1), '')::uuid))
  );

alter table public.records add column if not exists cover text not null default '';
