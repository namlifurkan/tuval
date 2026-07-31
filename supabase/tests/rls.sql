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
-- Publishing is checked as a caller with no account at all, so anon needs it too.
grant all on result to authenticated, anon;

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

-- Everybody ends up in exactly one workspace ------------------------------------------------------

set local role postgres;
update public.boards set allowed_domain = null where id = 'rls-team-board';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a new account gets a workspace', true, public.ensure_workspace() is not null);
select pg_temp.check('asking twice does not make a second',
  true, public.ensure_workspace() = public.ensure_workspace());

set local role postgres;
delete from public.workspaces where owner = 'bbbbbbbb-0000-4000-8000-000000000002';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('an invited account joins rather than starting its own',
  true, public.ensure_workspace() = 'cccccccc-0000-4000-8000-000000000003');

-- A board created without a workspace lands in one --------------------------------------------------

set local role postgres;
insert into public.boards (id, owner) values ('rls-fresh-board', 'aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check('a new board is never left outside a workspace',
  true, (select workspace_id is not null from public.boards where id = 'rls-fresh-board'));

-- A team invitation turns into membership on sign in -----------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.workspace_invites (workspace_id, email, role)
values ('cccccccc-0000-4000-8000-000000000003', 'bob@other.test', 'member');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('invited but not yet claimed, no access',
  false, public.can_read_board('rls-team-board'));
select public.claim_invites();
select pg_temp.check('claiming the invite grants access',
  true, public.can_read_board('rls-team-board'));
select pg_temp.check('the invitation is spent',
  false, exists(select 1 from public.workspace_invites where email = 'bob@other.test'));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@elsewhere.test');
select pg_temp.check('an invitation is not usable by another address',
  false, exists(select 1 from public.workspace_invites));

-- Records belong to a workspace, and stay there ----------------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.records (id, workspace_id, kind, title, status, created_by)
values ('dddddddd-0000-4000-8000-000000000004', 'cccccccc-0000-4000-8000-000000000003',
        'issue', 'Ship the thing', 'todo', 'aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('owner sees the record',  true, exists(select 1 from public.records));
select pg_temp.check('owner may write records', true, public.can_write_workspace('cccccccc-0000-4000-8000-000000000003'));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a stranger sees no records', false, exists(select 1 from public.records));
select pg_temp.check('a stranger may not write',   false, public.can_write_workspace('cccccccc-0000-4000-8000-000000000003'));

set local role postgres;
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'guest', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a guest reads records',      true,  exists(select 1 from public.records));
select pg_temp.check('a guest cannot write them',  false, public.can_write_workspace('cccccccc-0000-4000-8000-000000000003'));

set local role postgres;
update public.workspace_members set role = 'member'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a member may write records', true, public.can_write_workspace('cccccccc-0000-4000-8000-000000000003'));

-- The body of a record follows the record -----------------------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.record_docs (record_id, doc)
values ('dddddddd-0000-4000-8000-000000000004', '\x00'::bytea);

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('owner reads the body', true, exists(select 1 from public.record_docs));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a stranger cannot read the body', false, exists(select 1 from public.record_docs));

set local role postgres;
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'guest', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a guest reads the body', true, exists(select 1 from public.record_docs));

-- An inbox is yours alone --------------------------------------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.notifications (workspace_id, user_id, actor, kind, record_id)
values ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
        'bbbbbbbb-0000-4000-8000-000000000002', 'assigned', 'dddddddd-0000-4000-8000-000000000004');

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('you read your own notification', true,
  exists(select 1 from public.notifications));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('the sender cannot read the inbox they wrote to', false,
  exists(select 1 from public.notifications));

set local role postgres;
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a member of the workspace still cannot read another inbox', false,
  exists(select 1 from public.notifications));

-- Assigning writes to the assignee's inbox, and assigning to yourself does not ----------------------

set local role postgres;
delete from public.notifications;

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
update public.records set assignee = 'aaaaaaaa-0000-4000-8000-000000000001'
where id = 'dddddddd-0000-4000-8000-000000000004';

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('being assigned something reaches you', true,
  exists(select 1 from public.notifications where kind = 'assigned'));

set local role postgres;
delete from public.notifications;
-- Cleared first, so that assigning below is a real change and not a no-op that would pass this
-- check without the trigger ever having a decision to make.
update public.records set assignee = null where id = 'dddddddd-0000-4000-8000-000000000004';

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
update public.records set assignee = 'aaaaaaaa-0000-4000-8000-000000000001'
where id = 'dddddddd-0000-4000-8000-000000000004';
select pg_temp.check('assigning to yourself is not news', false,
  exists(select 1 from public.notifications));

-- Being named in a page tells you once, and only if you are in the workspace ----------------------

set local role postgres;
delete from public.notifications;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select public.notify_mentions('dddddddd-0000-4000-8000-000000000004',
  array['aaaaaaaa-0000-4000-8000-000000000001']::uuid[]);
select public.notify_mentions('dddddddd-0000-4000-8000-000000000004',
  array['aaaaaaaa-0000-4000-8000-000000000001']::uuid[]);

set local role postgres;
select pg_temp.check('being named in a page tells you exactly once', true,
  (select count(*) = 1 from public.notifications where kind = 'mentioned'));

set local role postgres;
delete from public.notifications;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select public.notify_mentions('dddddddd-0000-4000-8000-000000000004',
  array['aaaaaaaa-0000-4000-8000-000000000001']::uuid[]);

set local role postgres;
select pg_temp.check('somebody outside the workspace cannot post into an inbox', false,
  exists(select 1 from public.notifications));

-- Naming people on a page shuts everybody else out of it ------------------------------------------

set local role postgres;
delete from public.notifications;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

insert into public.records (id, workspace_id, kind, title, created_by)
values ('eeeeeeee-0000-4000-8000-000000000005', 'cccccccc-0000-4000-8000-000000000003',
        'doc', 'Quiet page', 'aaaaaaaa-0000-4000-8000-000000000001'),
       ('ffffffff-0000-4000-8000-000000000006', 'cccccccc-0000-4000-8000-000000000003',
        'doc', 'Under it', 'aaaaaaaa-0000-4000-8000-000000000001');
update public.records set parent_id = 'eeeeeeee-0000-4000-8000-000000000005'
where id = 'ffffffff-0000-4000-8000-000000000006';
-- Written before the page is restricted, so that "and so does its body" is a body that was
-- really there and really became invisible.
insert into public.record_docs (record_id, doc)
values ('eeeeeeee-0000-4000-8000-000000000005', '\x00'::bytea);

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a member of the workspace reads an unrestricted page', true,
  public.can_read_record('eeeeeeee-0000-4000-8000-000000000005'));

set local role postgres;
insert into public.record_members (record_id, user_id, role, email)
values ('eeeeeeee-0000-4000-8000-000000000005', 'aaaaaaaa-0000-4000-8000-000000000001', 'editor', 'ann@rls.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('naming people shuts out the rest of the workspace', false,
  public.can_read_record('eeeeeeee-0000-4000-8000-000000000005'));
select pg_temp.check('and shuts them out of what is under it', false,
  public.can_read_record('ffffffff-0000-4000-8000-000000000006'));
select pg_temp.check('the row itself disappears', false,
  exists(select 1 from public.records where id = 'eeeeeeee-0000-4000-8000-000000000005'));
select pg_temp.check('and so does its body', false,
  exists(select 1 from public.record_docs where record_id = 'eeeeeeee-0000-4000-8000-000000000005'));

set local role postgres;
insert into public.record_members (record_id, user_id, role, email)
values ('eeeeeeee-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000002', 'viewer', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('being named on it lets you read it', true,
  public.can_read_record('eeeeeeee-0000-4000-8000-000000000005'));
select pg_temp.check('and read what is under it', true,
  public.can_read_record('ffffffff-0000-4000-8000-000000000006'));
select pg_temp.check('a viewer still cannot write it', false,
  public.can_write_record('eeeeeeee-0000-4000-8000-000000000005'));

set local role postgres;
update public.record_members set role = 'editor'
where record_id = 'eeeeeeee-0000-4000-8000-000000000005'
  and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('an editor writes it', true,
  public.can_write_record('eeeeeeee-0000-4000-8000-000000000005'));

set local role postgres;
update public.record_members set role = 'blocked'
where record_id = 'eeeeeeee-0000-4000-8000-000000000005'
  and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('blocked beats being named', false,
  public.can_read_record('eeeeeeee-0000-4000-8000-000000000005'));

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('the owner of the workspace is never shut out', true,
  public.can_read_record('eeeeeeee-0000-4000-8000-000000000005'));

-- Publishing is a hole in the wall, and only where it was made --------------------------------------

set local role postgres;
delete from public.record_members;
update public.records set published_at = now(), public_slug = 'quiet-page'
where id = 'eeeeeeee-0000-4000-8000-000000000005';

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('a stranger with no account reads a published page', true,
  exists(select 1 from public.records where public_slug = 'quiet-page'));
select pg_temp.check('and its body', true,
  exists(select 1 from public.record_docs where record_id = 'eeeeeeee-0000-4000-8000-000000000005'));
select pg_temp.check('but not the page under it', false,
  exists(select 1 from public.records where id = 'ffffffff-0000-4000-8000-000000000006'));

set local role postgres;
update public.records set published_at = null where id = 'eeeeeeee-0000-4000-8000-000000000005';

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('unpublishing closes it again', false,
  exists(select 1 from public.records where public_slug = 'quiet-page'));

-- What went wrong, if anything --------------------------------------------------------------------

set local role postgres;

select
  count(*) filter (where expected is distinct from actual) as failed,
  count(*) as checks
from result;

select name, expected, actual from result where expected is distinct from actual order by name;
