-- A file follows the record it is attached to -----------------------------------------------------
-- New paths are workspace/record/random-name. Old paths had no record segment; they cannot be
-- safely attributed after the fact, so only the workspace owner may read or change them.

create or replace function public.storage_path_uuid(path text, part integer)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return nullif(split_part(path, '/', part), '')::uuid;
exception when invalid_text_representation then
  return null;
end;
$$;

create or replace function public.storage_record_path(path text)
returns uuid
language sql
stable
set search_path = ''
as $$
  select r.id
  from public.records r
  where r.id = public.storage_path_uuid(path, 2)
    and r.workspace_id = public.storage_path_uuid(path, 1);
$$;

revoke all on function public.storage_path_uuid(text, integer) from public, anon;
revoke all on function public.storage_record_path(text) from public, anon;
grant execute on function public.storage_path_uuid(text, integer) to authenticated, service_role;
grant execute on function public.storage_record_path(text) to authenticated, service_role;

drop policy if exists attachments_read   on storage.objects;
drop policy if exists attachments_write  on storage.objects;
drop policy if exists attachments_update on storage.objects;
drop policy if exists attachments_delete on storage.objects;

create policy attachments_read on storage.objects for select to authenticated
  using (
    bucket_id = 'attachments'
    and (select public.in_workspace(public.storage_path_uuid(name, 1)))
    and (
      (public.storage_record_path(name) is not null
       and (select public.can_read_record(public.storage_record_path(name))))
      or (public.storage_record_path(name) is null
          and (select public.owns_workspace(public.storage_path_uuid(name, 1))))
    )
  );

create policy attachments_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'attachments'
    and (select public.in_workspace(public.storage_path_uuid(name, 1)))
    and public.storage_record_path(name) is not null
    and (select public.can_write_record(public.storage_record_path(name)))
  );

create policy attachments_update on storage.objects for update to authenticated
  using (
    bucket_id = 'attachments'
    and (
      (public.storage_record_path(name) is not null
       and (select public.can_write_record(public.storage_record_path(name))))
      or (public.storage_record_path(name) is null
          and (select public.owns_workspace(public.storage_path_uuid(name, 1))))
    )
  )
  with check (
    bucket_id = 'attachments'
    and public.storage_record_path(name) is not null
    and (select public.can_write_record(public.storage_record_path(name)))
  );

create policy attachments_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'attachments'
    and (
      (public.storage_record_path(name) is not null
       and (select public.can_write_record(public.storage_record_path(name))))
      or (public.storage_record_path(name) is null
          and (select public.owns_workspace(public.storage_path_uuid(name, 1))))
    )
  );

drop policy if exists covers_read   on storage.objects;
drop policy if exists covers_write  on storage.objects;
drop policy if exists covers_update on storage.objects;
drop policy if exists covers_delete on storage.objects;

create policy covers_read on storage.objects for select to authenticated
  using (
    bucket_id = 'covers'
    and (select public.in_workspace(public.storage_path_uuid(name, 1)))
    and (
      (public.storage_record_path(name) is not null
       and (select public.can_read_record(public.storage_record_path(name))))
      or (public.storage_record_path(name) is null
          and (select public.owns_workspace(public.storage_path_uuid(name, 1))))
    )
  );

create policy covers_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'covers'
    and (select public.in_workspace(public.storage_path_uuid(name, 1)))
    and public.storage_record_path(name) is not null
    and (select public.can_write_record(public.storage_record_path(name)))
  );

create policy covers_update on storage.objects for update to authenticated
  using (
    bucket_id = 'covers'
    and (
      (public.storage_record_path(name) is not null
       and (select public.can_write_record(public.storage_record_path(name))))
      or (public.storage_record_path(name) is null
          and (select public.owns_workspace(public.storage_path_uuid(name, 1))))
    )
  )
  with check (
    bucket_id = 'covers'
    and public.storage_record_path(name) is not null
    and (select public.can_write_record(public.storage_record_path(name)))
  );

create policy covers_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'covers'
    and (
      (public.storage_record_path(name) is not null
       and (select public.can_write_record(public.storage_record_path(name))))
      or (public.storage_record_path(name) is null
          and (select public.owns_workspace(public.storage_path_uuid(name, 1))))
    )
  );
