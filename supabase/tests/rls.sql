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

-- Refusing a write is an error, not an empty result, and an error at the top level would take the
-- whole run down. Run it in here and report whether it was refused.
create or replace function pg_temp.refused(statement text) returns boolean
language plpgsql as $$
begin
  execute statement;
  return false;
exception when others then
  return true;
end $$;

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

-- What you keep at hand is yours alone -------------------------------------------------------------

set local role postgres;
insert into public.record_favourites (user_id, record_id)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000004');

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('you see your own favourites', true,
  exists(select 1 from public.record_favourites));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('and nobody else sees them', false,
  exists(select 1 from public.record_favourites));

-- One cell at a time, and only for somebody who may write the row -----------------------------------

set local role postgres;
delete from public.record_members;
update public.records set data = '{"a": 1, "b": 2}'::jsonb
where id = 'dddddddd-0000-4000-8000-000000000004';
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

-- Two people, two cells, neither having seen the other's write.
select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select public.merge_cells('dddddddd-0000-4000-8000-000000000004', '{"a": 99}'::jsonb);
select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select public.merge_cells('dddddddd-0000-4000-8000-000000000004', '{"b": 88}'::jsonb);

set local role postgres;
select pg_temp.check('two people writing two cells keep both', true,
  (select data = '{"a": 99, "b": 88}'::jsonb from public.records
   where id = 'dddddddd-0000-4000-8000-000000000004'));

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select public.merge_cells('dddddddd-0000-4000-8000-000000000004', '{}'::jsonb, array['a']);
set local role postgres;
select pg_temp.check('clearing a cell leaves the others', true,
  (select data = '{"b": 88}'::jsonb from public.records
   where id = 'dddddddd-0000-4000-8000-000000000004'));

set local role postgres;
update public.workspace_members set role = 'guest'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select public.merge_cells('dddddddd-0000-4000-8000-000000000004', '{"c": 7}'::jsonb);
set local role postgres;
select pg_temp.check('a guest cannot write a cell either', false,
  (select data ? 'c' from public.records where id = 'dddddddd-0000-4000-8000-000000000004'));

-- An issue gets a number, and only an issue --------------------------------------------------------

set local role postgres;
delete from public.record_members;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
insert into public.records (workspace_id, kind, title, status)
values ('cccccccc-0000-4000-8000-000000000003', 'issue', 'First', 'todo'),
       ('cccccccc-0000-4000-8000-000000000003', 'issue', 'Second', 'todo'),
       ('cccccccc-0000-4000-8000-000000000003', 'doc', 'A page', null);

set local role postgres;
select pg_temp.check('every issue gets its own number', true,
  (select count(distinct seq) = count(*) from public.records
   where kind = 'issue' and workspace_id = 'cccccccc-0000-4000-8000-000000000003'));
select pg_temp.check('a page does not get one', true,
  (select seq is null from public.records where title = 'A page'));
select pg_temp.check('the workspace has a prefix to put in front of it', true,
  (select prefix ~ '^[A-Z]{1,5}$' from public.workspaces
   where id = 'cccccccc-0000-4000-8000-000000000003'));

-- Cycles and labels follow the workspace -------------------------------------------------------

set local role postgres;
insert into public.cycles (id, workspace_id, number, starts_on, ends_on)
values ('11111111-0000-4000-8000-000000000011', 'cccccccc-0000-4000-8000-000000000003',
        1, '2026-08-01', '2026-08-14');
insert into public.labels (id, workspace_id, name, tone)
values ('22222222-0000-4000-8000-000000000022', 'cccccccc-0000-4000-8000-000000000003', 'bug', '#C8664A');
insert into public.record_labels (record_id, label_id)
values ('dddddddd-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000022');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a stranger sees no cycles', false, exists(select 1 from public.cycles));
select pg_temp.check('a stranger sees no labels', false, exists(select 1 from public.labels));
select pg_temp.check('a stranger sees nothing labelled', false, exists(select 1 from public.record_labels));

set local role postgres;
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'guest', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a guest reads the cycles', true, exists(select 1 from public.cycles));
select pg_temp.check('a guest reads what is labelled', true, exists(select 1 from public.record_labels));
select pg_temp.check('a guest cannot make one', true, pg_temp.refused(
  $q$insert into public.labels (workspace_id, name)
     values ('cccccccc-0000-4000-8000-000000000003', 'sneaked')$q$));

-- A key and a hook are workspace administration -----------------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.api_keys (workspace_id, name, hint, token_sha)
values ('cccccccc-0000-4000-8000-000000000003', 'n8n', 'tuv_ab', 
        encode(extensions.digest('tuv_secret_token', 'sha256'), 'hex'));
insert into public.webhooks (id, workspace_id, url)
values ('33333333-0000-4000-8000-000000000033', 'cccccccc-0000-4000-8000-000000000003',
        'https://example.test/hook');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a stranger sees no keys', false, exists(select 1 from public.api_keys));
select pg_temp.check('a stranger sees no hooks', false, exists(select 1 from public.webhooks));

set local role postgres;
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'guest', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a guest of the workspace still sees no keys', false,
  exists(select 1 from public.api_keys));

set local role postgres;
update public.workspace_members set role = 'member'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('somebody who may write the workspace sees them', true,
  exists(select 1 from public.api_keys));

-- The token itself never opens anything by being guessed at ------------------------------------------

set local role postgres;
-- The door for robots is a paid one, so the workspace is put on that plan before it is asked to
-- open. That it stays shut on the free plan is checked further down.
update public.workspaces set plan = 'team', plan_until = now() + interval '30 days'
where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.check('a key names its workspace', true,
  public.workspace_for_key('tuv_secret_token') = 'cccccccc-0000-4000-8000-000000000003');
select pg_temp.check('a wrong token names nothing', true,
  public.workspace_for_key('tuv_not_the_token') is null);

update public.api_keys set revoked_at = now();
select pg_temp.check('a revoked key names nothing', true,
  public.workspace_for_key('tuv_secret_token') is null);

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('and nobody signed in may ask that question at all', true, pg_temp.refused(
  $q$select public.workspace_for_key('tuv_secret_token')$q$));

-- A webhook nobody can reach does not stop work being saved -----------------------------------------

set local role postgres;
update public.webhooks set active = true, url = 'https://127.0.0.1:9/nowhere'
where id = '33333333-0000-4000-8000-000000000033';

select pg_temp.check('a record still saves with a broken hook registered', true,
  not pg_temp.refused(
    $q$insert into public.records (workspace_id, kind, title)
       values ('cccccccc-0000-4000-8000-000000000003', 'issue', 'Saved anyway')$q$));
select pg_temp.check('and it is really there', true,
  exists(select 1 from public.records where title = 'Saved anyway'));

-- A form is answered by somebody with no account ----------------------------------------------------

set local role postgres;
delete from public.webhooks;
insert into public.records (id, workspace_id, kind, title, data)
values ('44444444-0000-4000-8000-000000000044', 'cccccccc-0000-4000-8000-000000000003',
        'database', 'Basvurular',
        '{"fields":[{"id":"f1","name":"Sayi","type":"number"},
                    {"id":"f2","name":"Not","type":"text"},
                    {"id":"f3","name":"Gizli","type":"text"}]}'::jsonb);
insert into public.forms (workspace_id, database_id, slug, asks)
values ('cccccccc-0000-4000-8000-000000000003', '44444444-0000-4000-8000-000000000044',
        'basvuru', array['__title__', 'f1', 'f2']);

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('a live form can be read without an account', true,
  exists(select 1 from public.forms where slug = 'basvuru'));
select pg_temp.check('but not the rows of what it writes into', false,
  exists(select 1 from public.records where id = '44444444-0000-4000-8000-000000000044'));

select pg_temp.check('the questions can be read without the answers', true,
  jsonb_array_length(public.form_questions('basvuru')) = 3);

select public.submit_form('basvuru',
  '{"__title__":"Ayse","f1":"12,5","f2":"merhaba","f3":"gizlice"}'::jsonb);

set local role postgres;
select pg_temp.check('the answer became a row', true,
  exists(select 1 from public.records
         where parent_id = '44444444-0000-4000-8000-000000000044' and title = 'Ayse'));
select pg_temp.check('a number arrived as a number', true,
  (select (data -> 'f1')::text = '12.5' from public.records
   where parent_id = '44444444-0000-4000-8000-000000000044' and title = 'Ayse'));
select pg_temp.check('a column the form did not ask for is dropped', true,
  (select not (data ? 'f3') from public.records
   where parent_id = '44444444-0000-4000-8000-000000000044' and title = 'Ayse'));

-- Filling the trap writes nothing, and says nothing about having been caught.
select set_config('request.jwt.claims', null, true);
set local role anon;
select public.submit_form('basvuru', '{"__title__":"Bot"}'::jsonb, 'i am a robot');

set local role postgres;
select pg_temp.check('what fills the trap does not become a row', false,
  exists(select 1 from public.records
         where parent_id = '44444444-0000-4000-8000-000000000044' and title = 'Bot'));

update public.forms set active = false where slug = 'basvuru';
select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('a closed form cannot be read', false,
  exists(select 1 from public.forms where slug = 'basvuru'));
select pg_temp.check('nor answered', true,
  public.submit_form('basvuru', '{"__title__":"Gec kalan"}'::jsonb) is null);
select pg_temp.check('and a closed form has no questions either', true,
  public.form_questions('basvuru') is null);

-- Hours are everybody's to read and only yours to write ---------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
insert into public.time_entries (workspace_id, record_id, user_id, minutes)
values ('cccccccc-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000004',
        'aaaaaaaa-0000-4000-8000-000000000001', 90);

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('the team can see where the hours went', true,
  exists(select 1 from public.time_entries));
select pg_temp.check('but cannot log hours in somebody else name', true, pg_temp.refused(
  $q$insert into public.time_entries (workspace_id, record_id, user_id, minutes)
     values ('cccccccc-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000004',
             'aaaaaaaa-0000-4000-8000-000000000001', 30)$q$));

update public.time_entries set minutes = 5;
set local role postgres;
select pg_temp.check('nor change what somebody else logged', true,
  (select minutes = 90 from public.time_entries limit 1));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a stint of no time at all is refused', true, pg_temp.refused(
  $q$insert into public.time_entries (workspace_id, record_id, user_id, minutes)
     values ('cccccccc-0000-4000-8000-000000000003', 'dddddddd-0000-4000-8000-000000000004',
             'bbbbbbbb-0000-4000-8000-000000000002', 0)$q$));

-- Work that comes back ------------------------------------------------------------------------------

set local role postgres;
delete from public.recurrences;
insert into public.recurrences (workspace_id, title, every, next_on, created_by)
values ('cccccccc-0000-4000-8000-000000000003', 'Standup notu', 'week',
        current_date - 21, 'aaaaaaaa-0000-4000-8000-000000000001');

select public.make_due_recurrences();
select pg_temp.check('the ones it owed were made', true,
  (select count(*) = 4 from public.records where title = 'Standup notu'));
select pg_temp.check('and the rule moved past today', true,
  (select next_on > current_date from public.recurrences limit 1));

-- Running it again the same day is not a second copy of the same day's work.
select public.make_due_recurrences();
select pg_temp.check('asking twice makes nothing twice', true,
  (select count(*) = 4 from public.records where title = 'Standup notu'));

set local role postgres;
delete from public.recurrences;
insert into public.recurrences (workspace_id, title, every, next_on)
values ('cccccccc-0000-4000-8000-000000000003', 'Gunluk', 'day', current_date - 400);
select public.make_due_recurrences();
select pg_temp.check('a rule left alone for a year does not make a year of rows', true,
  (select count(*) = 60 from public.records where title = 'Gunluk'));

-- Bob has been made a member further up, so he is put back outside before being asked.
set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a stranger sees no rules', false, exists(select 1 from public.recurrences));

-- Somebody outside picking a time --------------------------------------------------------------------

set local role postgres;
insert into public.booking_pages
  (workspace_id, owner, slug, title, minutes, weekdays, opens_at, closes_at, zone,
   notice_hours, horizon_days)
values ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
        'ann', 'Gorusme', 30, array[1,2,3,4,5], '09:00', '17:00', 'UTC', 0, 60);

-- The next Monday at 10:00 UTC, which is inside the hours and on an allowed day.
create or replace function pg_temp.next_monday_at(hhmm time) returns timestamptz
language sql as $$
  select ((current_date + ((8 - extract(isodow from current_date)::int) % 7 + 7)) + hhmm)
         at time zone 'UTC'
$$;

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('a live page can be read without an account', true,
  exists(select 1 from public.booking_pages where slug = 'ann'));
select pg_temp.check('nothing is taken to begin with', false,
  exists(select * from public.taken_slots('ann')));

select pg_temp.check('a time inside the hours is booked', true,
  public.book_slot('ann', pg_temp.next_monday_at('10:00'), 'Bob', 'bob@other.test') is not null);
select pg_temp.check('the same instant cannot be booked twice', true,
  public.book_slot('ann', pg_temp.next_monday_at('10:00'), 'Ceren', 'c@other.test') is null);
select pg_temp.check('and it now shows as taken', true,
  exists(select * from public.taken_slots('ann')));

select pg_temp.check('outside the hours is refused', true,
  public.book_slot('ann', pg_temp.next_monday_at('20:00'), 'Bob', 'b@other.test') is null);
select pg_temp.check('a time that does not land on a slot is refused', true,
  public.book_slot('ann', pg_temp.next_monday_at('10:07'), 'Bob', 'b@other.test') is null);
select pg_temp.check('a time in the past is refused', true,
  public.book_slot('ann', now() - interval '1 day', 'Bob', 'b@other.test') is null);

set local role postgres;
select pg_temp.check('a booking became an event in the workspace', true,
  exists(select 1 from public.records where kind = 'event' and title like 'Bob%'));

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('but who booked it is not readable from outside', false,
  exists(select 1 from public.bookings));

-- What the hosted one costs -------------------------------------------------------------------------

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
delete from public.workspace_invites where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
update public.workspaces set plan = 'free', plan_until = null
where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.check('a new workspace is on the free plan', true,
  public.plan_of('cccccccc-0000-4000-8000-000000000003') = 'free');
select pg_temp.check('the owner is the first seat', true,
  public.workspace_seats('cccccccc-0000-4000-8000-000000000003') = 1);

-- Three seats on free: the owner and two more.
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');
insert into public.workspace_invites (workspace_id, email, role, invited_by)
values ('cccccccc-0000-4000-8000-000000000003', 'third@other.test', 'member', 'aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.check('an invitation sent takes a seat', true,
  public.workspace_seats('cccccccc-0000-4000-8000-000000000003') = 3);
select pg_temp.check('the fourth is refused', true, pg_temp.refused(
  $q$insert into public.workspace_invites (workspace_id, email, role, invited_by)
     values ('cccccccc-0000-4000-8000-000000000003', 'fourth@other.test', 'member',
             'aaaaaaaa-0000-4000-8000-000000000001')$q$));

update public.workspaces set plan = 'team', plan_until = now() + interval '30 days'
where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.check('on the paid plan it is allowed', true, not pg_temp.refused(
  $q$insert into public.workspace_invites (workspace_id, email, role, invited_by)
     values ('cccccccc-0000-4000-8000-000000000003', 'fourth@other.test', 'member',
             'aaaaaaaa-0000-4000-8000-000000000001')$q$));

-- A plan that has run out is the free plan again, not a workspace that stops working.
update public.workspaces set plan_until = now() - interval '1 day'
where id = 'cccccccc-0000-4000-8000-000000000003';
select pg_temp.check('a lapsed plan reads as free', true,
  public.plan_of('cccccccc-0000-4000-8000-000000000003') = 'free');
select pg_temp.check('and what was written is all still there', true,
  exists(select 1 from public.records where workspace_id = 'cccccccc-0000-4000-8000-000000000003'));

-- The door for robots opens on the paid plan and not before.
delete from public.api_keys;
insert into public.api_keys (workspace_id, name, hint, token_sha)
values ('cccccccc-0000-4000-8000-000000000003', 'n8n', 'tuv_ab',
        encode(extensions.digest('tuv_plan_token', 'sha256'), 'hex'));

select pg_temp.check('a key on the free plan opens nothing', true,
  public.workspace_for_key('tuv_plan_token') is null);

update public.workspaces set plan = 'team', plan_until = now() + interval '30 days'
where id = 'cccccccc-0000-4000-8000-000000000003';
select pg_temp.check('and works again once it is paid for', true,
  public.workspace_for_key('tuv_plan_token') = 'cccccccc-0000-4000-8000-000000000003');

-- What the screen is told is what the triggers use.
select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('the usage answer says which plan and how many seats', true,
  (public.workspace_usage('cccccccc-0000-4000-8000-000000000003') ->> 'plan') = 'team');

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
delete from public.workspace_invites where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'nobody@elsewhere.test');
select pg_temp.check('and says nothing to somebody outside', true,
  public.workspace_usage('cccccccc-0000-4000-8000-000000000003') is null);

-- What went wrong, if anything --------------------------------------------------------------------

set local role postgres;

select
  count(*) filter (where expected is distinct from actual) as failed,
  count(*) as checks
from result;

select name, expected, actual from result where expected is distinct from actual order by name;
