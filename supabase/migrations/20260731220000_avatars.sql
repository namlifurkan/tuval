-- Avatars -----------------------------------------------------------------------------------
-- Board images are private because a board is private. An avatar is the opposite: it exists to
-- be recognised by the people you share a board with, and working out who those people are on
-- every read would mean signing a url for a face. The bucket is public and the path carries a
-- uuid, so a link is unguessable but not secret.
--
-- Writing is another matter: objects live under <user id>/, and that is the only folder an
-- account may write to.

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = true;

drop policy if exists avatars_read   on storage.objects;
drop policy if exists avatars_write  on storage.objects;
drop policy if exists avatars_update on storage.objects;

create policy avatars_read on storage.objects for select to public
  using (bucket_id = 'avatars');

create policy avatars_write on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );

create policy avatars_update on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and split_part(name, '/', 1) = (select auth.uid())::text
  );
