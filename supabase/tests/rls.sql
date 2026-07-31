-- Who can read what -------------------------------------------------------------------------
-- Run against the real database, against the real policies:
--
--   npx supabase db query --linked -f supabase/tests/rls.sql
--
-- Two users are created, put through every combination access is meant to allow or refuse, and
-- rolled back at the end. Nothing survives the transaction, so it is safe to run on production
-- and it is the only way to be sure the policies say what we think they say.
--
-- This exists because a mistake here does not look like a bug. It looks like everything
-- working, while another company reads your boards.
--
-- The runner puts the migration under test in front of this file and wraps both in a
-- transaction it rolls back, so the schema being tested is the one that would be applied and
-- production is never touched.

set local role postgres;

-- Fixtures ------------------------------------------------------------------------------------

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'ann@rls.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('bbbbbbbb-0000-4000-8000-000000000002', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'bob@other.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

insert into public.workspaces (id, slug, name, owner)
values ('cccccccc-0000-4000-8000-000000000003', 'ann-rls-test', 'Ann', 'aaaaaaaa-0000-4000-8000-000000000001');

insert into public.boards (id, owner, name, workspace_id)
values ('rls-team-board', 'aaaaaaaa-0000-4000-8000-000000000001', 'Team', 'cccccccc-0000-4000-8000-000000000003');

insert into public.board_snapshots (board_id, doc, items, frames)
values ('rls-team-board', '\x00'::bytea, 3, 1);

create temporary table result (name text, expected boolean, actual boolean);
-- The checks run while impersonating a user, and that role has to be able to record them.
grant all on result to authenticated;

create or replace function pg_temp.becomes(who uuid, mail text) returns void
language plpgsql as $$
begin
  perform set_config('role', 'authenticated', true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', who, 'email', mail, 'role', 'authenticated')::text, true);
end $$;

create or replace function pg_temp.check(name text, expected boolean, actual boolean) returns void
language sql as $$ insert into result values (name, expected, coalesce(actual, false)) $$;

-- The owner ------------------------------------------------------------------------------------

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('owner reads own board',   true, public.can_read_board('rls-team-board'));
select pg_temp.check('owner writes own board',  true, public.can_write_board('rls-team-board'));
select pg_temp.check('owner sees the row',      true, exists(select 1 from public.boards where id = 'rls-team-board'));
select pg_temp.check('owner sees the snapshot', true, exists(select 1 from public.board_snapshots where board_id = 'rls-team-board'));

-- A stranger -------------------------------------------------------------------------------------

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('stranger cannot read',            false, public.can_read_board('rls-team-board'));
select pg_temp.check('stranger cannot write',           false, public.can_write_board('rls-team-board'));
select pg_temp.check('stranger sees no row',            false, exists(select 1 from public.boards where id = 'rls-team-board'));
select pg_temp.check('stranger sees no snapshot',       false, exists(select 1 from public.board_snapshots where board_id = 'rls-team-board'));
select pg_temp.check('stranger sees no workspace',      false, exists(select 1 from public.workspaces where id = 'cccccccc-0000-4000-8000-000000000003'));
select pg_temp.check('stranger is not in the workspace', false, public.in_workspace('cccccccc-0000-4000-8000-000000000003'));

-- A member of the workspace ----------------------------------------------------------------------

set local role postgres;
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('workspace member reads',      true, public.can_read_board('rls-team-board'));
select pg_temp.check('workspace member writes',     true, public.can_write_board('rls-team-board'));
select pg_temp.check('workspace member sees row',   true, exists(select 1 from public.boards where id = 'rls-team-board'));

-- A board grant overrides the workspace ------------------------------------------------------------

set local role postgres;
insert into public.board_members (board_id, user_id, role, email)
values ('rls-team-board', 'bbbbbbbb-0000-4000-8000-000000000002', 'viewer', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('viewer grant still reads',        true,  public.can_read_board('rls-team-board'));
select pg_temp.check('viewer grant cannot write',       false, public.can_write_board('rls-team-board'));

set local role postgres;
update public.board_members set role = 'blocked'
where board_id = 'rls-team-board' and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('blocked beats workspace membership', false, public.can_read_board('rls-team-board'));
select pg_temp.check('blocked cannot write either',        false, public.can_write_board('rls-team-board'));
select pg_temp.check('blocked sees no row',                false, exists(select 1 from public.boards where id = 'rls-team-board'));

-- Blocked at the workspace ---------------------------------------------------------------------

set local role postgres;
delete from public.board_members where board_id = 'rls-team-board';
update public.workspace_members set role = 'blocked'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('blocked in workspace cannot read', false, public.can_read_board('rls-team-board'));

-- The domain rule --------------------------------------------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
update public.boards set allowed_domain = 'other.test', domain_role = 'viewer' where id = 'rls-team-board';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('right domain reads',       true,  public.can_read_board('rls-team-board'));
select pg_temp.check('viewer domain cannot write', false, public.can_write_board('rls-team-board'));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@elsewhere.test');
select pg_temp.check('wrong domain cannot read', false, public.can_read_board('rls-team-board'));

-- What went wrong, if anything --------------------------------------------------------------------

set local role postgres;

select
  count(*) filter (where expected is distinct from actual) as failed,
  count(*) as checks
from result;

select name, expected, actual from result where expected is distinct from actual order by name;
