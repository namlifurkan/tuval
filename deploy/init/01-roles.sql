-- The image ships the roles; nothing gives them a password ----------------------------------------
-- PostgREST, GoTrue and storage-api each sign in as a role of their own, and the image that
-- creates those roles leaves them without a password. Every one of the three then dies on
-- "password authentication failed" and the stack looks broken rather than unconfigured.
--
-- Runs once, on an empty data directory, like every other file in this folder.

\set pw `echo "$POSTGRES_PASSWORD"`

alter role authenticator            with login password :'pw';
alter role supabase_auth_admin      with login password :'pw';
alter role supabase_storage_admin   with login password :'pw';
alter role supabase_admin           with login password :'pw';

-- Realtime keeps its tenants here and creates the table itself; the schema has to exist first.
create schema if not exists _realtime;
alter schema _realtime owner to supabase_admin;
