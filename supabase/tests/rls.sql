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

insert into public.boards (id, owner, name, workspace_id, public_at)
values ('rls-public-board', 'aaaaaaaa-0000-4000-8000-000000000001', 'Published', 'cccccccc-0000-4000-8000-000000000003', now());

insert into public.board_snapshots (board_id, doc, items, frames)
values ('rls-public-board', '\x00'::bytea, 1, 0);

-- Published once and already past its end. The link is out there; the door is not.
insert into public.boards (id, owner, name, workspace_id, public_at, public_until)
values ('rls-expired-board', 'aaaaaaaa-0000-4000-8000-000000000001', 'Expired', 'cccccccc-0000-4000-8000-000000000003', now() - interval '2 days', now() - interval '1 day');

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
select public.save_board_snapshot('rls-team-board', 'AQID', 4, 2, null);
select pg_temp.check('owner saves compact base64 board bytes', true,
  (select doc = decode('AQID', 'base64') and items = 4 and frames = 2
   from public.board_snapshots where board_id = 'rls-team-board'));

-- A stranger -------------------------------------------------------------------------------------

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('stranger cannot read',            false, public.can_read_board('rls-team-board'));
select pg_temp.check('stranger cannot write',           false, public.can_write_board('rls-team-board'));
select pg_temp.check('stranger sees no row',            false, exists(select 1 from public.boards where id = 'rls-team-board'));
select pg_temp.check('stranger sees no snapshot',       false, exists(select 1 from public.board_snapshots where board_id = 'rls-team-board'));
select pg_temp.check('stranger sees no workspace',      false, exists(select 1 from public.workspaces where id = 'cccccccc-0000-4000-8000-000000000003'));
select pg_temp.check('stranger is not in the workspace', false, public.in_workspace('cccccccc-0000-4000-8000-000000000003'));

-- A published board is the one thing the same stranger may read. Reading only: publishing a board
-- hands out a copy, not a pen.
select pg_temp.check('signed-in stranger reads a public board',        true,  public.can_read_board('rls-public-board'));
select pg_temp.check('signed-in stranger sees the public row',         true,  exists(select 1 from public.boards where id = 'rls-public-board'));
select pg_temp.check('signed-in stranger sees the public snapshot',    true,  exists(select 1 from public.board_snapshots where board_id = 'rls-public-board'));
select pg_temp.check('signed-in stranger cannot write a public board', false, public.can_write_board('rls-public-board'));
select pg_temp.check('an expired board is closed again',               false, public.board_is_public('rls-expired-board'));
select pg_temp.check('an expired board refuses the same reader',       false, public.can_read_board('rls-expired-board'));
select pg_temp.check('an expired board hides its row',                 false, exists(select 1 from public.boards where id = 'rls-expired-board'));

-- Realtime broadcast has its own table and must enforce the same board gate.
set local role postgres;
insert into realtime.messages (topic, extension, event, private, payload)
values ('board:rls-team-board', 'broadcast', 'y', true, '{}'::jsonb);

select set_config('realtime.topic', 'board:rls-team-board', true);
select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('board owner reads its private realtime channel', true,
  exists(select 1 from realtime.messages where topic = 'board:rls-team-board'));
select pg_temp.check('board owner writes its private realtime channel', false, pg_temp.refused(
  $q$insert into realtime.messages (topic, extension, event, private, payload)
     values ('board:rls-team-board', 'broadcast', 'y', true, '{}'::jsonb)$q$));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('stranger cannot read a private realtime channel', false,
  exists(select 1 from realtime.messages where topic = 'board:rls-team-board'));
select pg_temp.check('stranger cannot write a private realtime channel', true, pg_temp.refused(
  $q$insert into realtime.messages (topic, extension, event, private, payload)
     values ('board:rls-team-board', 'broadcast', 'y', true, '{}'::jsonb)$q$));

-- A member of the workspace ----------------------------------------------------------------------

set local role postgres;
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('workspace member reads',      true, public.can_read_board('rls-team-board'));
select pg_temp.check('workspace member writes',     true, public.can_write_board('rls-team-board'));
select pg_temp.check('workspace member sees row',   true, exists(select 1 from public.boards where id = 'rls-team-board'));

set local role postgres;
update public.workspace_members set role = 'guest'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003'
  and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('workspace guest reads', true, public.can_read_board('rls-team-board'));
select pg_temp.check('workspace guest cannot write', false, public.can_write_board('rls-team-board'));

set local role postgres;
update public.workspace_members set role = 'member'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003'
  and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

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
-- It belongs to the workspace, and it hands over everything a workspace holds. It writes a
-- membership row rather than answering from the address every time, which is what a removal can
-- then stand against: the rows go in when the rule is set, and again for whoever arrives later.

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('dddddddd-0000-4000-8000-000000000004', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'cara@rls.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}'),
  ('eeeeeeee-0000-4000-8000-000000000005', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'eve@gmail.com', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('a workspace cannot be opened to a domain you are not at', true,
  pg_temp.refused($q$update public.workspaces set allowed_domain = 'other.test'
                     where id = 'cccccccc-0000-4000-8000-000000000003'$q$));

set local role postgres;
insert into public.workspaces (id, slug, name, owner)
values ('ffffffff-0000-4000-8000-000000000006', 'eve-gmail', 'Eve', 'eeeeeeee-0000-4000-8000-000000000005');
select pg_temp.becomes('eeeeeeee-0000-4000-8000-000000000005', 'eve@gmail.com');
select pg_temp.check('a mailbox provider does not stand for a company', true,
  pg_temp.refused($q$update public.workspaces set allowed_domain = 'gmail.com'
                     where id = 'ffffffff-0000-4000-8000-000000000006'$q$));

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('and is opened to the one you are at', true,
  not pg_temp.refused($q$update public.workspaces
                        set allowed_domain = 'rls.test', domain_role = 'guest'
                        where id = 'cccccccc-0000-4000-8000-000000000003'$q$));

-- Nobody signs in for this: cara had an account before the switch was flipped, and the whole
-- complaint about the first version was that she stayed invisible until she next opened the app.
select pg_temp.becomes('dddddddd-0000-4000-8000-000000000004', 'cara@rls.test');
select pg_temp.check('the rule reaches somebody who was already here', true,
  public.can_read_board('rls-team-board'));
select pg_temp.check('and it is a guest, who cannot write', false, public.can_write_board('rls-team-board'));
select pg_temp.check('a guest of the rule takes no seat', true,
  public.workspace_seats('cccccccc-0000-4000-8000-000000000003') = 1);

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('and the admin sees her on the list', true,
  exists(select 1 from public.workspace_members m
         where m.workspace_id = 'cccccccc-0000-4000-8000-000000000003'
           and m.user_id = 'dddddddd-0000-4000-8000-000000000004' and m.via_domain));

-- An account made after the switch was flipped has no row yet, and claims it on arrival.
set local role postgres;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password,
                        email_confirmed_at, created_at, updated_at,
                        raw_app_meta_data, raw_user_meta_data)
values
  ('11111111-0000-4000-8000-000000000007', '00000000-0000-0000-0000-000000000000',
   'authenticated', 'authenticated', 'dan@rls.test', '', now(), now(), now(),
   '{"provider":"email","providers":["email"]}', '{}');

select pg_temp.becomes('11111111-0000-4000-8000-000000000007', 'dan@rls.test');
select pg_temp.check('somebody who signs up later is not in yet', false,
  public.can_read_board('rls-team-board'));
select public.claim_invites();
select pg_temp.check('and joins the first time they arrive', true, public.can_read_board('rls-team-board'));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select public.claim_invites();
select pg_temp.check('another domain stays out', false, public.can_read_board('rls-team-board'));

-- Switching it off takes back what it gave, and only that.
set local role postgres;
update public.workspaces set allowed_domain = null
where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('11111111-0000-4000-8000-000000000007', 'dan@rls.test');
select pg_temp.check('turning the rule off puts them back out', false,
  public.can_read_board('rls-team-board'));

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
update public.workspaces set allowed_domain = 'rls.test', domain_role = 'guest'
where id = 'cccccccc-0000-4000-8000-000000000003';

set local role postgres;
update public.workspace_members set role = 'blocked'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003'
  and user_id = 'dddddddd-0000-4000-8000-000000000004';

select pg_temp.becomes('dddddddd-0000-4000-8000-000000000004', 'cara@rls.test');
select public.claim_invites();
select pg_temp.check('a removal survives the rule', false, public.can_read_board('rls-team-board'));

-- And survives the switch being flipped twice, which is the cheapest way to undo a removal by
-- accident: off deletes the rows the rule wrote, on writes them again, and hers is neither.
select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
update public.workspaces set allowed_domain = null
where id = 'cccccccc-0000-4000-8000-000000000003';
update public.workspaces set allowed_domain = 'rls.test'
where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('dddddddd-0000-4000-8000-000000000004', 'cara@rls.test');
select pg_temp.check('and survives the rule being switched off and on', false,
  public.can_read_board('rls-team-board'));

-- Everybody ends up in exactly one workspace ------------------------------------------------------

set local role postgres;
update public.workspaces set allowed_domain = null
where id = 'cccccccc-0000-4000-8000-000000000003';
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a new account gets a workspace', true, public.ensure_workspace() is not null);
select pg_temp.check('asking twice does not make a second',
  true, public.ensure_workspace() = public.ensure_workspace());
select pg_temp.check('a new workspace starts with one board', true,
  (select count(*) = 1 from public.boards
   where workspace_id = public.ensure_workspace() and name = 'Start here'));
select pg_temp.check('its first project ties together an issue and a page', true,
  exists (
    select 1 from public.records p
    where p.workspace_id = public.ensure_workspace() and p.kind = 'project'
      and exists(select 1 from public.records i where i.project_id = p.id and i.kind = 'issue')
      and exists(select 1 from public.records d where d.project_id = p.id and d.kind = 'doc')
  ));

set local role postgres;
delete from public.workspaces where owner = 'bbbbbbbb-0000-4000-8000-000000000002';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'member', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('an invited account joins rather than starting its own',
  true, public.ensure_workspace() = 'cccccccc-0000-4000-8000-000000000003');

-- Reaching a second workspace ----------------------------------------------------------------------
-- The switcher asks once for owned workspaces and once for non-blocked memberships. These prove
-- the policies admit both halves without any new access, then pin the fallback down: two owned
-- workspaces used to mean an arbitrary one, and arbitrary is free to change between sessions.

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a member reads the workspace row itself', true,
  exists(select 1 from public.workspaces where id = 'cccccccc-0000-4000-8000-000000000003'));
select pg_temp.check('and it is the only one he is offered', true,
  (select count(*) from public.workspaces) = 1);

set local role postgres;
insert into public.workspaces (id, slug, name, owner, created_at) values
  ('dddddddd-0000-4000-8000-000000000004', 'bob-older', 'Bob older',
   'bbbbbbbb-0000-4000-8000-000000000002', now() - interval '2 days'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'bob-newer', 'Bob newer',
   'bbbbbbbb-0000-4000-8000-000000000002', now() - interval '1 day');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('both of his own and the one he was invited into', true,
  (select count(*) from public.workspaces) = 3);
select pg_temp.check('a stranger workspace is still not on the list', false,
  exists(select 1 from public.workspaces
         where owner = 'aaaaaaaa-0000-4000-8000-000000000001'
           and id <> 'cccccccc-0000-4000-8000-000000000003'));
select pg_temp.check('the fallback takes the oldest owned one', true,
  public.ensure_workspace() = 'dddddddd-0000-4000-8000-000000000004');
select pg_temp.check('and the board default agrees with it', true,
  public.my_workspace() = 'dddddddd-0000-4000-8000-000000000004');
select pg_temp.check('owning two does not move it between calls', true,
  public.ensure_workspace() = public.ensure_workspace());

set local role postgres;
update public.workspace_members set role = 'blocked'
where user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('blocked at the workspace takes it off the list', true,
  (select count(*) from public.workspaces) = 2);

set local role postgres;
delete from public.workspaces where owner = 'bbbbbbbb-0000-4000-8000-000000000002';
update public.workspace_members set role = 'member'
where user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

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

set local role postgres;
insert into storage.objects (bucket_id, name, owner)
values
  ('attachments', 'cccccccc-0000-4000-8000-000000000003/eeeeeeee-0000-4000-8000-000000000005/secret.txt',
   'aaaaaaaa-0000-4000-8000-000000000001'),
  ('attachments', 'cccccccc-0000-4000-8000-000000000003/dddddddd-0000-4000-8000-000000000004/open.txt',
   'aaaaaaaa-0000-4000-8000-000000000001'),
  ('attachments', 'cccccccc-0000-4000-8000-000000000003/legacy.txt',
   'aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a blocked member cannot read a restricted attachment', false,
  exists(select 1 from storage.objects where name like '%/secret.txt'));
select pg_temp.check('the same member can read an unrestricted attachment', true,
  exists(select 1 from storage.objects where name like '%/open.txt'));
select pg_temp.check('a blocked member cannot upload to a restricted record', true, pg_temp.refused(
  $q$insert into storage.objects (bucket_id, name, owner)
     values ('attachments',
       'cccccccc-0000-4000-8000-000000000003/eeeeeeee-0000-4000-8000-000000000005/nope.txt',
       'bbbbbbbb-0000-4000-8000-000000000002')$q$));
select pg_temp.check('legacy unscoped files fail closed for members', false,
  exists(select 1 from storage.objects where name like '%/legacy.txt'));

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('the owner of the workspace is never shut out', true,
  public.can_read_record('eeeeeeee-0000-4000-8000-000000000005'));
select pg_temp.check('the owner can recover a legacy unscoped file', true,
  exists(select 1 from storage.objects where name like '%/legacy.txt'));

-- A project is a gate too, and hours do not go round the back --------------------------------------
-- An issue does not sit under its project in the tree; it points at it. Restricting the project
-- has to reach the issue anyway, or "restricted project" is a word for something that is not
-- happening. And an hour logged against a record nobody may read said, until now, that the
-- record was there and who spent the afternoon on it.

set local role postgres;
delete from public.record_members;
insert into public.records (id, workspace_id, kind, title, created_by)
values
  ('1c1c1c1c-0000-4000-8000-0000000000c1', 'cccccccc-0000-4000-8000-000000000003',
   'project', 'Quiet project', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('1c1c1c1c-0000-4000-8000-0000000000c2', 'cccccccc-0000-4000-8000-000000000003',
   'issue', 'Work inside it', 'aaaaaaaa-0000-4000-8000-000000000001'),
  ('1c1c1c1c-0000-4000-8000-0000000000c3', 'cccccccc-0000-4000-8000-000000000003',
   'issue', 'Work in the open', 'aaaaaaaa-0000-4000-8000-000000000001');
update public.records set project_id = '1c1c1c1c-0000-4000-8000-0000000000c1'
where id = '1c1c1c1c-0000-4000-8000-0000000000c2';
insert into public.time_entries (workspace_id, record_id, user_id, minutes)
values
  ('cccccccc-0000-4000-8000-000000000003', '1c1c1c1c-0000-4000-8000-0000000000c2',
   'aaaaaaaa-0000-4000-8000-000000000001', 90),
  ('cccccccc-0000-4000-8000-000000000003', '1c1c1c1c-0000-4000-8000-0000000000c3',
   'aaaaaaaa-0000-4000-8000-000000000001', 30);

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('an issue in an unrestricted project is read by the workspace', true,
  public.can_read_record('1c1c1c1c-0000-4000-8000-0000000000c2'));

set local role postgres;
insert into public.record_members (record_id, user_id, role, email)
values ('1c1c1c1c-0000-4000-8000-0000000000c1', 'aaaaaaaa-0000-4000-8000-000000000001', 'editor', 'ann@rls.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('naming people on a project shuts the rest out of the project', false,
  public.can_read_record('1c1c1c1c-0000-4000-8000-0000000000c1'));
select pg_temp.check('and out of the issues that point at it', false,
  public.can_read_record('1c1c1c1c-0000-4000-8000-0000000000c2'));
select pg_temp.check('the issue row itself disappears', false,
  exists(select 1 from public.records where id = '1c1c1c1c-0000-4000-8000-0000000000c2'));
select pg_temp.check('an issue outside it is untouched', true,
  public.can_read_record('1c1c1c1c-0000-4000-8000-0000000000c3'));
select pg_temp.check('nor can the rest write it', false,
  public.can_write_record('1c1c1c1c-0000-4000-8000-0000000000c2'));
select pg_temp.check('the hours logged against it are gone as well', false,
  exists(select 1 from public.time_entries where record_id = '1c1c1c1c-0000-4000-8000-0000000000c2'));
select pg_temp.check('hours against an open record are still everybody''s to read', true,
  exists(select 1 from public.time_entries where record_id = '1c1c1c1c-0000-4000-8000-0000000000c3'));

set local role postgres;
insert into public.record_members (record_id, user_id, role, email)
values ('1c1c1c1c-0000-4000-8000-0000000000c1', 'bbbbbbbb-0000-4000-8000-000000000002', 'viewer', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('being named on the project reaches its issues', true,
  public.can_read_record('1c1c1c1c-0000-4000-8000-0000000000c2'));
select pg_temp.check('and their hours', true,
  exists(select 1 from public.time_entries where record_id = '1c1c1c1c-0000-4000-8000-0000000000c2'));

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

-- Given an end that has passed, the same link closes itself without anybody remembering to.
set local role postgres;
update public.records set public_until = now() - interval '1 hour'
where id = 'eeeeeeee-0000-4000-8000-000000000005';

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('an expired page is closed again', false,
  exists(select 1 from public.records where public_slug = 'quiet-page'));
select pg_temp.check('and its body with it', false,
  exists(select 1 from public.record_docs where record_id = 'eeeeeeee-0000-4000-8000-000000000005'));

set local role postgres;
update public.records set public_until = null where id = 'eeeeeeee-0000-4000-8000-000000000005';

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('and opens again when the end is taken off', true,
  exists(select 1 from public.records where public_slug = 'quiet-page'));

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
insert into public.api_keys (workspace_id, name, hint, token_sha, created_by)
values ('cccccccc-0000-4000-8000-000000000003', 'n8n', 'tuv_ab',
        encode(extensions.digest('tuv_secret_token', 'sha256'), 'hex'),
        'aaaaaaaa-0000-4000-8000-000000000001');
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
select pg_temp.check('a member cannot inspect workspace keys', false,
  exists(select 1 from public.api_keys));
select pg_temp.check('a member cannot inspect workspace hooks', false,
  exists(select 1 from public.webhooks));
select pg_temp.check('a member cannot mint a workspace key', true, pg_temp.refused(
  $q$insert into public.api_keys (workspace_id, name, hint, token_sha, created_by)
     values ('cccccccc-0000-4000-8000-000000000003', 'stolen', 'tuv_no', 'not-a-key',
             'bbbbbbbb-0000-4000-8000-000000000002')$q$));
select pg_temp.check('a member cannot attach a workspace webhook', true, pg_temp.refused(
  $q$insert into public.webhooks (workspace_id, url)
     values ('cccccccc-0000-4000-8000-000000000003', 'https://member.test/hook')$q$));

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('the owner can inspect workspace keys', true,
  exists(select 1 from public.api_keys));
select pg_temp.check('the owner can inspect workspace hooks', true,
  exists(select 1 from public.webhooks));

-- The token itself never opens anything by being guessed at ------------------------------------------

set local role postgres;
-- The door for robots is a paid one, so the workspace is put on that plan before it is asked to
-- open. That it stays shut on the free plan is checked further down.
update public.workspaces set plan = 'team', plan_until = now() + interval '30 days'
where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.check('a key names its workspace', true,
  (select k.workspace_id from public.workspace_for_key('tuv_secret_token') k)
    = 'cccccccc-0000-4000-8000-000000000003');
select pg_temp.check('a wrong token names nothing', false,
  exists(select 1 from public.workspace_for_key('tuv_not_the_token')));

update public.api_keys set revoked_at = now();
select pg_temp.check('a revoked key names nothing', false,
  exists(select 1 from public.workspace_for_key('tuv_secret_token')));

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('and nobody signed in may ask that question at all', true, pg_temp.refused(
  $q$select public.workspace_for_key('tuv_secret_token')$q$));

set local role postgres;
select pg_temp.check('security definer functions have no blanket execute grant', false,
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace,
         lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
    where n.nspname = 'public'
      and p.prosecdef
      and a.grantee = 0
      and a.privilege_type = 'EXECUTE'
  ));

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

insert into public.workspaces (id, slug, name, owner)
values ('eeeeeeee-0000-4000-8000-000000000005', 'bob-form-test', 'Bob form test',
        'bbbbbbbb-0000-4000-8000-000000000002');
insert into public.records (id, workspace_id, kind, title)
values ('55555555-0000-4000-8000-000000000055',
        'eeeeeeee-0000-4000-8000-000000000005', 'database', 'Foreign database');
select pg_temp.check('a form cannot point into another workspace', true, pg_temp.refused(
  $q$insert into public.forms (workspace_id, database_id, slug)
     values ('cccccccc-0000-4000-8000-000000000003',
             '55555555-0000-4000-8000-000000000055', 'crossed-form')$q$));

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('forms cannot be enumerated without an account', false,
  exists(select 1 from public.forms where slug = 'basvuru'));
select pg_temp.check('but not the rows of what it writes into', false,
  exists(select 1 from public.records where id = '44444444-0000-4000-8000-000000000044'));

select pg_temp.check('one addressed form can be read without an account', true,
  public.public_form('basvuru') -> 'form' ->> 'slug' = 'basvuru');
select pg_temp.check('the addressed form includes questions without answers', true,
  jsonb_array_length(public.public_form('basvuru') -> 'fields') = 3);
select pg_temp.check('the old columns-only endpoint is unavailable', true, pg_temp.refused(
  $q$select public.form_questions('basvuru')$q$));

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
select pg_temp.check('and its addressed endpoint returns nothing', true,
  public.public_form('basvuru') is null);

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

-- Booking links are dormant --------------------------------------------------------------------------

set local role postgres;
insert into public.booking_pages
  (workspace_id, owner, slug, title, minutes, weekdays, opens_at, closes_at, zone,
   notice_hours, horizon_days)
values ('cccccccc-0000-4000-8000-000000000003', 'aaaaaaaa-0000-4000-8000-000000000001',
        'ann', 'Gorusme', 30, array[1,2,3,4,5], '09:00', '17:00', 'UTC', 0, 60);

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('booking pages cannot be enumerated without an account', false,
  exists(select 1 from public.booking_pages where slug = 'ann'));
select pg_temp.check('taken slots are not exposed', true, pg_temp.refused(
  $q$select * from public.taken_slots('ann')$q$));
select pg_temp.check('a stranger cannot create a booking', true, pg_temp.refused(
  $q$select public.book_slot('ann', now() + interval '1 day', 'Bob', 'bob@other.test')$q$));

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
insert into public.api_keys (workspace_id, name, hint, token_sha, created_by)
values ('cccccccc-0000-4000-8000-000000000003', 'n8n', 'tuv_ab',
        encode(extensions.digest('tuv_plan_token', 'sha256'), 'hex'),
        'aaaaaaaa-0000-4000-8000-000000000001');

select pg_temp.check('a key on the free plan opens nothing', false,
  exists(select 1 from public.workspace_for_key('tuv_plan_token')));

update public.workspaces set plan = 'team', plan_until = now() + interval '30 days'
where id = 'cccccccc-0000-4000-8000-000000000003';
select pg_temp.check('and works again once it is paid for', true,
  (select k.workspace_id from public.workspace_for_key('tuv_plan_token') k)
    = 'cccccccc-0000-4000-8000-000000000003');

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
update public.workspaces set plan = 'free', plan_until = null, customer_ref = 'mine'
where id = 'cccccccc-0000-4000-8000-000000000003';
select pg_temp.check('an owner cannot grant their own paid plan', true,
  public.plan_of('cccccccc-0000-4000-8000-000000000003') = 'team'
  and (select customer_ref is null from public.workspaces
       where id = 'cccccccc-0000-4000-8000-000000000003'));

-- What the screen is told is what the triggers use.
select pg_temp.check('the usage answer says which plan and how many seats', true,
  (public.workspace_usage('cccccccc-0000-4000-8000-000000000003') ->> 'plan') = 'team');

set local role postgres;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
delete from public.workspace_invites where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'nobody@elsewhere.test');
select pg_temp.check('and says nothing to somebody outside', true,
  public.workspace_usage('cccccccc-0000-4000-8000-000000000003') is null);

-- A page of somebody's own, and a board anybody may read -------------------------------------------

set local role postgres;
insert into public.profiles (user_id, handle, name, bio)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'ann', 'Ann', 'Builds with agents');

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('a profile is readable by anybody', true,
  exists(select 1 from public.profiles where handle = 'ann'));

-- Somebody else's page is not somebody else's to write.
select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('but not writable by anybody', true,
  pg_temp.refused($$update public.profiles set bio = 'mine now' where handle = 'ann'$$)
  or (select bio from public.profiles where handle = 'ann') = 'Builds with agents');
select pg_temp.check('and a name the product answers to cannot be taken', true,
  pg_temp.refused($$insert into public.profiles (user_id, handle)
                    values ('bbbbbbbb-0000-4000-8000-000000000002', 'settings')$$));

-- The allow-list is the database's, not the browser's.
select pg_temp.check('a link to a place we do not link to is refused', true,
  pg_temp.refused($$insert into public.profiles (user_id, handle, links)
                    values ('bbbbbbbb-0000-4000-8000-000000000002', 'bob',
                            '[{"url":"https://pay-me-now.example/steal"}]'::jsonb)$$));
select pg_temp.check('and http is not https', true,
  pg_temp.refused($$insert into public.profiles (user_id, handle, links)
                    values ('bbbbbbbb-0000-4000-8000-000000000002', 'bob',
                            '[{"url":"http://patreon.com/ann"}]'::jsonb)$$));
select pg_temp.check('a real one goes in', true, public.allowed_link('https://buymeacoffee.com/ann'));
select pg_temp.check('and so does a subdomain of one', true, public.allowed_link('https://ann.github.io'));
select pg_temp.check('but not a host that merely ends the same way', false,
  public.allowed_link('https://evilgithub.io/ann'));

-- A private board stays private to somebody with no account, and opening it changes only that.
select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('a board nobody opened is unreadable without an account', false,
  exists(select 1 from public.boards where id = 'rls-team-board'));

set local role postgres;
update public.boards set public_at = now() where id = 'rls-team-board';

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('an opened board is readable without an account', true,
  exists(select 1 from public.boards where id = 'rls-team-board'));
select pg_temp.check('and so is what is drawn on it', true,
  exists(select 1 from public.board_snapshots where board_id = 'rls-team-board'));
-- Reading it is not writing it. A write with no policy behind it is not an error, it is a
-- statement that touches nothing, so what is checked is that nothing moved.
select pg_temp.refused($$update public.boards set name = 'mine' where id = 'rls-team-board'$$);
select pg_temp.check('but it is still not writable', false,
  exists(select 1 from public.boards where id = 'rls-team-board' and name = 'mine'));

-- A stranger with an account gains nothing they did not already have: the board being public is
-- about reading it, and can_read_board still answers about membership.
select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'nobody@elsewhere.test');
select pg_temp.check('a public board is not a board a stranger may write to', false,
  public.can_write_board('rls-team-board'));

set local role postgres;
update public.boards set public_at = null where id = 'rls-team-board';

select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('closing it shuts the door again', false,
  exists(select 1 from public.boards where id = 'rls-team-board'));

-- Somewhere for a thing to belong ------------------------------------------------------------------

set local role postgres;
insert into public.records (id, workspace_id, kind, title)
values ('11111111-0000-4000-8000-000000000011',
        'cccccccc-0000-4000-8000-000000000003', 'project', 'Rebuild');

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');

update public.boards set project_id = '11111111-0000-4000-8000-000000000011'
where id = 'rls-team-board';
select pg_temp.check('a board can belong to a project', true,
  exists(select 1 from public.boards
         where id = 'rls-team-board' and project_id = '11111111-0000-4000-8000-000000000011'));

select pg_temp.check('but not to something that is not one', true,
  pg_temp.refused($$update public.boards
                    set project_id = 'dddddddd-0000-4000-8000-000000000004'
                    where id = 'rls-team-board'$$));

select pg_temp.check('and a project is not inside itself', true,
  pg_temp.refused($$update public.records
                    set project_id = '11111111-0000-4000-8000-000000000011'
                    where id = '11111111-0000-4000-8000-000000000011'$$));

-- Belonging nowhere stays allowed: the quick note and the scratch board are why.
update public.boards set project_id = null where id = 'rls-team-board';
select pg_temp.check('and belonging nowhere is still allowed', true,
  exists(select 1 from public.boards where id = 'rls-team-board' and project_id is null));

set local role postgres;
select pg_temp.check('records has one update trigger', true,
  (select count(*) = 1 and bool_and(tgname = 'records_touched') from pg_trigger
   where tgrelid = 'public.records'::regclass
     and not tgisinternal
     and tgname in ('records_touch', 'records_touched')));

-- An install nobody is billing for -----------------------------------------------------------------

set local role postgres;
insert into public.api_keys (workspace_id, name, token_sha, created_by)
values ('cccccccc-0000-4000-8000-000000000003', 'self host',
        encode(extensions.digest('tuv_selfhost_token', 'sha256'), 'hex'),
        'aaaaaaaa-0000-4000-8000-000000000001')
on conflict do nothing;
update public.workspaces set plan = 'free', plan_until = null
where id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.check('a free workspace on the hosted install has no API', false,
  exists(select 1 from public.workspace_for_key('tuv_selfhost_token')));

update public.tuval_settings set self_hosted = true where id = 1;

select pg_temp.check('the same workspace self-hosted has one', true,
  (select k.workspace_id from public.workspace_for_key('tuv_selfhost_token') k)
    = 'cccccccc-0000-4000-8000-000000000003');
select pg_temp.check('and the plan reads as one nobody is billing', true,
  public.plan_of('cccccccc-0000-4000-8000-000000000003') = 'unlimited');
select pg_temp.check('seats stop being capped', true,
  (select seats from public.plan_limits(
     public.plan_of('cccccccc-0000-4000-8000-000000000003'), 1)) > 1000000);
select pg_temp.check('and so does storage', true,
  (select bytes from public.plan_limits(
     public.plan_of('cccccccc-0000-4000-8000-000000000003'), 1)) > 1000000000000::bigint);

set local role postgres;
update public.tuval_settings set self_hosted = false where id = 1;
select pg_temp.check('turning it off puts the limits back', true,
  (select seats from public.plan_limits(
     public.plan_of('cccccccc-0000-4000-8000-000000000003'), 1)) = 3);


-- A domain the operator carries ---------------------------------------------------------------------
-- The same arrangement one step smaller: a hosted install that is billing, deciding it is not
-- billing these people. It reads the owner's confirmed address and nobody else's.

update public.tuval_settings set unlimited_domains = array['RLS.test'] where id = 1;

select pg_temp.check('the owner of a carried domain is not billed', true,
  public.plan_of('cccccccc-0000-4000-8000-000000000003') = 'unlimited');
select pg_temp.check('and it is matched however the operator typed it', true,
  public.unlimited_owner('cccccccc-0000-4000-8000-000000000003'));
select pg_temp.check('a workspace owned from another domain is billed as before', false,
  public.plan_of('dddddddd-0000-4000-8000-000000000004') = 'unlimited');
select pg_temp.check('the carried workspace has the API without paying', true,
  (select k.workspace_id from public.workspace_for_key('tuv_selfhost_token') k)
    = 'cccccccc-0000-4000-8000-000000000003');

update auth.users set email_confirmed_at = null
where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select pg_temp.check('an address nobody confirmed is a claim, not an arrangement', false,
  public.unlimited_owner('cccccccc-0000-4000-8000-000000000003'));
update auth.users set email_confirmed_at = now()
where id = 'aaaaaaaa-0000-4000-8000-000000000001';

update public.tuval_settings set unlimited_domains = '{}' where id = 1;
select pg_temp.check('and taking the domain off puts the limits back', true,
  (select seats from public.plan_limits(
     public.plan_of('cccccccc-0000-4000-8000-000000000003'), 1)) = 3);

-- One workspace, carried by hand rather than by a rule about everybody at a domain. Its own row,
-- so it does not depend on what any earlier block left behind.
insert into public.workspaces (id, slug, name, owner)
values ('ffff0000-0000-4000-8000-00000000000f', 'carried', 'Carried',
        'bbbbbbbb-0000-4000-8000-000000000002');

select pg_temp.check('a workspace starts out billed like any other', true,
  public.plan_of('ffff0000-0000-4000-8000-00000000000f') = 'free');

update public.workspaces set plan = 'unlimited', plan_until = null
where id = 'ffff0000-0000-4000-8000-00000000000f';
select pg_temp.check('a workspace can be carried one at a time', true,
  public.plan_of('ffff0000-0000-4000-8000-00000000000f') = 'unlimited');
select pg_temp.check('and its seats stop being counted', true,
  (select seats from public.plan_limits(
     public.plan_of('ffff0000-0000-4000-8000-00000000000f'), 1)) > 1000000);
select pg_temp.check('while the one beside it is untouched', true,
  public.plan_of('cccccccc-0000-4000-8000-000000000003') = 'free');

update public.workspaces set plan_until = now() - interval '1 day'
where id = 'ffff0000-0000-4000-8000-00000000000f';
select pg_temp.check('a decision with a date on it ends when the date does', true,
  public.plan_of('ffff0000-0000-4000-8000-00000000000f') = 'free');

-- What one key opens ------------------------------------------------------------------------------
-- A key is not the workspace. It may only read, it may run out, and it sees exactly the pages the
-- person who made it sees — a page with people named on it stays shut whichever door you use.

set local role postgres;
update public.tuval_settings set self_hosted = false where id = 1;
update public.workspaces set plan = 'team', plan_until = null
where id = 'cccccccc-0000-4000-8000-000000000003';
delete from public.record_members;
delete from public.api_keys;
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002',
        'admin', 'bob@other.test');

insert into public.records (id, workspace_id, kind, title, created_by)
values ('a0a0a0a0-0000-4000-8000-00000000000a', 'cccccccc-0000-4000-8000-000000000003',
        'doc', 'Named page', 'aaaaaaaa-0000-4000-8000-000000000001'),
       ('b0b0b0b0-0000-4000-8000-00000000000b', 'cccccccc-0000-4000-8000-000000000003',
        'doc', 'Open page', 'aaaaaaaa-0000-4000-8000-000000000001')
on conflict (id) do nothing;
insert into public.record_members (record_id, user_id, role, email)
values ('a0a0a0a0-0000-4000-8000-00000000000a', 'aaaaaaaa-0000-4000-8000-000000000001',
        'editor', 'ann@rls.test')
on conflict do nothing;

insert into public.api_keys (workspace_id, name, token_sha, created_by, scope)
values
  ('cccccccc-0000-4000-8000-000000000003', 'reads only',
   encode(extensions.digest('tuv_read_only', 'sha256'), 'hex'),
   'bbbbbbbb-0000-4000-8000-000000000002', 'read'),
  ('cccccccc-0000-4000-8000-000000000003', 'reads and writes',
   encode(extensions.digest('tuv_read_write', 'sha256'), 'hex'),
   'bbbbbbbb-0000-4000-8000-000000000002', 'write'),
  ('cccccccc-0000-4000-8000-000000000003', 'long gone',
   encode(extensions.digest('tuv_expired', 'sha256'), 'hex'),
   'aaaaaaaa-0000-4000-8000-000000000001', 'write'),
  ('cccccccc-0000-4000-8000-000000000003', 'taken back',
   encode(extensions.digest('tuv_revoked', 'sha256'), 'hex'),
   'aaaaaaaa-0000-4000-8000-000000000001', 'write'),
  ('cccccccc-0000-4000-8000-000000000003', 'nobody behind it',
   encode(extensions.digest('tuv_orphan', 'sha256'), 'hex'), null, 'write')
on conflict do nothing;

update public.api_keys set expires_at = now() - interval '1 day'
where token_sha = encode(extensions.digest('tuv_expired', 'sha256'), 'hex');
update public.api_keys set revoked_at = now()
where token_sha = encode(extensions.digest('tuv_revoked', 'sha256'), 'hex');

select pg_temp.check('a key says which workspace it opens', true,
  (select k.workspace_id from public.workspace_for_key('tuv_read_write') k)
    = 'cccccccc-0000-4000-8000-000000000003');
select pg_temp.check('and whose eyes it reads with', true,
  (select k.acting from public.workspace_for_key('tuv_read_write') k)
    = 'bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.check('a read key never says it may write', true,
  (select k.scope from public.workspace_for_key('tuv_read_only') k) = 'read');
select pg_temp.check('a write key says it may', true,
  (select k.scope from public.workspace_for_key('tuv_read_write') k) = 'write');
select pg_temp.check('an expired key opens nothing at all', false,
  exists(select 1 from public.workspace_for_key('tuv_expired')));
select pg_temp.check('nor does a revoked one', false,
  exists(select 1 from public.workspace_for_key('tuv_revoked')));
select pg_temp.check('nor one with nobody behind it', false,
  exists(select 1 from public.workspace_for_key('tuv_orphan')));

select pg_temp.check('a key reads a page nobody was named on', true,
  'b0b0b0b0-0000-4000-8000-00000000000b' = any (public.can_read_records_as(
    'bbbbbbbb-0000-4000-8000-000000000002',
    array['a0a0a0a0-0000-4000-8000-00000000000a',
          'b0b0b0b0-0000-4000-8000-00000000000b']::uuid[])));
select pg_temp.check('but not a page it was left off', false,
  'a0a0a0a0-0000-4000-8000-00000000000a' = any (public.can_read_records_as(
    'bbbbbbbb-0000-4000-8000-000000000002',
    array['a0a0a0a0-0000-4000-8000-00000000000a',
          'b0b0b0b0-0000-4000-8000-00000000000b']::uuid[])));
select pg_temp.check('the person named on it still reads it', true,
  'a0a0a0a0-0000-4000-8000-00000000000a' = any (public.can_read_records_as(
    'aaaaaaaa-0000-4000-8000-000000000001',
    array['a0a0a0a0-0000-4000-8000-00000000000a']::uuid[])));
select pg_temp.check('a key held by nobody in the workspace reads nothing', true,
  public.can_read_records_as('99999999-0000-4000-8000-000000000009',
    array['b0b0b0b0-0000-4000-8000-00000000000b']::uuid[]) = '{}'::uuid[]);

select pg_temp.check('a key cannot write a page it was left off either', false,
  public.can_write_record_as('bbbbbbbb-0000-4000-8000-000000000002',
    'cccccccc-0000-4000-8000-000000000003',
    'a0a0a0a0-0000-4000-8000-00000000000a'));
select pg_temp.check('and can write an unrestricted one', true,
  public.can_write_record_as('bbbbbbbb-0000-4000-8000-000000000002',
    'cccccccc-0000-4000-8000-000000000003',
    'b0b0b0b0-0000-4000-8000-00000000000b'));
select pg_temp.check('somebody outside the workspace writes neither', false,
  public.can_write_record_as('99999999-0000-4000-8000-000000000009',
    'cccccccc-0000-4000-8000-000000000003',
    'b0b0b0b0-0000-4000-8000-00000000000b'));

-- Naming no record asks about the top of the workspace, which is a question about the seat.
select pg_temp.check('naming no record asks whether this person may write here at all', true,
  public.can_write_record_as('bbbbbbbb-0000-4000-8000-000000000002',
    'cccccccc-0000-4000-8000-000000000003', null));
select pg_temp.check('and a stranger naming no record is still refused', false,
  public.can_write_record_as('99999999-0000-4000-8000-000000000009',
    'cccccccc-0000-4000-8000-000000000003', null));
select pg_temp.check('a record belonging to another workspace is refused, not judged', false,
  public.can_write_record_as('bbbbbbbb-0000-4000-8000-000000000002',
    'dddddddd-0000-4000-8000-000000000004',
    'b0b0b0b0-0000-4000-8000-00000000000b'));

set local role postgres;
update public.workspace_members set role = 'blocked'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003'
  and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.check('taking the person off the workspace closes their key with them', true,
  public.can_read_records_as('bbbbbbbb-0000-4000-8000-000000000002',
    array['b0b0b0b0-0000-4000-8000-00000000000b']::uuid[]) = '{}'::uuid[]);
select pg_temp.check('and the door stops answering for it at all', false,
  exists(select 1 from public.workspace_for_key('tuv_read_write')));

set local role postgres;
update public.workspace_members set role = 'guest'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003'
  and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';

select pg_temp.check('a guest cannot hold a key that writes', true,
  (select k.scope from public.workspace_for_key('tuv_read_write') k) = 'read');

-- What a write leaves behind -----------------------------------------------------------------------
-- Behind a key there is no session to read, so the gateway says who it is acting for and what to
-- sign with. Every change is kept beside the record, nobody can tidy that up afterwards, and a
-- key runs out of writes before it can run all night.

set local role postgres;
update public.workspace_members set role = 'admin'
where workspace_id = 'cccccccc-0000-4000-8000-000000000003'
  and user_id = 'bbbbbbbb-0000-4000-8000-000000000002';
-- The gateway holds the service key and carries no session at all, which is the whole reason
-- auth.uid() could not answer this question.
select set_config('request.jwt.claims', '', true);

select pg_temp.check('a key says what name to sign with', true,
  (select k.agent from public.workspace_for_key('tuv_read_write') k) = 'reads and writes');

update public.records
   set title       = 'Renamed by a robot',
       updated_by  = 'bbbbbbbb-0000-4000-8000-000000000002',
       updated_via = 'reads and writes'
 where id = 'b0b0b0b0-0000-4000-8000-00000000000b';

select pg_temp.check('a write with no session is signed with whoever the key speaks for', true,
  (select r.updated_by from public.records r
   where r.id = 'b0b0b0b0-0000-4000-8000-00000000000b') = 'bbbbbbbb-0000-4000-8000-000000000002');
select pg_temp.check('and says which key made it', true,
  (select r.updated_via from public.records r
   where r.id = 'b0b0b0b0-0000-4000-8000-00000000000b') = 'reads and writes');
select pg_temp.check('the change is kept, with what the title was before it', true,
  exists(select 1 from public.record_revisions v
         where v.record_id = 'b0b0b0b0-0000-4000-8000-00000000000b'
           and v.changed = array['title'] and v.was ->> 'title' = 'Open page'
           and v.via = 'reads and writes'));

update public.records set position = 42
where id = 'b0b0b0b0-0000-4000-8000-00000000000b';
-- Two kept: the page being made, and the rename. The move is not one of them.
select pg_temp.check('but moving a card is not a change worth keeping', true,
  (select count(*) from public.record_revisions v
   where v.record_id = 'b0b0b0b0-0000-4000-8000-00000000000b') = 2);

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
update public.records set title = 'Renamed by a person'
where id = 'b0b0b0b0-0000-4000-8000-00000000000b';

select pg_temp.check('a person writing takes the key name back off', true,
  (select r.updated_via from public.records r
   where r.id = 'b0b0b0b0-0000-4000-8000-00000000000b') is null);
select pg_temp.check('and is the one signed for it', true,
  (select r.updated_by from public.records r
   where r.id = 'b0b0b0b0-0000-4000-8000-00000000000b') = 'aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check('the owner reads the trail', true,
  exists(select 1 from public.record_revisions
         where record_id = 'b0b0b0b0-0000-4000-8000-00000000000b'));
select pg_temp.check('but cannot write anything into it', true, pg_temp.refused(
  $q$insert into public.record_revisions (record_id, workspace_id, changed)
     values ('b0b0b0b0-0000-4000-8000-00000000000b',
             'cccccccc-0000-4000-8000-000000000003', '{}')$q$));

delete from public.record_revisions
where record_id = 'b0b0b0b0-0000-4000-8000-00000000000b';
select pg_temp.check('nor take anything out of it', true,
  exists(select 1 from public.record_revisions
         where record_id = 'b0b0b0b0-0000-4000-8000-00000000000b'));

select pg_temp.becomes('99999999-0000-4000-8000-000000000009', 'nobody@rls.test');
select pg_temp.check('somebody outside the workspace sees no trail at all', false,
  exists(select 1 from public.record_revisions
         where record_id = 'b0b0b0b0-0000-4000-8000-00000000000b'));

-- The allowance ------------------------------------------------------------------------------------

set local role postgres;
select set_config('request.jwt.claims', '', true);
update public.api_keys set daily_writes = 2, writes_on = null, writes_today = 0
where token_sha = encode(extensions.digest('tuv_read_write', 'sha256'), 'hex');

select pg_temp.check('the first write of the day spends one of two', true,
  (select k.writes_left from public.workspace_for_key('tuv_read_write', true) k) = 1);
select pg_temp.check('the second spends the last of it', true,
  (select k.writes_left from public.workspace_for_key('tuv_read_write', true) k) = 0);
select pg_temp.check('and the one after that is refused', true,
  (select k.writes_left from public.workspace_for_key('tuv_read_write', true) k) = -1);
select pg_temp.check('a key out of writes still reads', true,
  (select k.scope from public.workspace_for_key('tuv_read_write') k) = 'write');
select pg_temp.check('a key that only reads spends nothing', true,
  (select k.writes_left from public.workspace_for_key('tuv_read_only', true) k) = 1000);

update public.api_keys set writes_on = current_date - 1, writes_today = 2
where token_sha = encode(extensions.digest('tuv_read_write', 'sha256'), 'hex');
select pg_temp.check('and yesterday''s count is not today''s', true,
  (select k.writes_left from public.workspace_for_key('tuv_read_write', true) k) = 1);

-- The board's append log ---------------------------------------------------------------------------
-- The document was one row that every save overwrote, so two people saving meant the last writer
-- won and the other one's work went with it. Updates are appended instead: each gets its own row
-- and its own number, nobody's number can collide with anybody else's, and an update too big to
-- be one row is refused rather than stored half-written.

set local role postgres;
select set_config('request.jwt.claims', '', true);
delete from public.board_members where board_id = 'rls-team-board';
delete from public.workspace_members where workspace_id = 'cccccccc-0000-4000-8000-000000000003';

select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('the owner appends an update and is told its number', true,
  public.append_board_update('rls-team-board', 'AQID') = 1);
select pg_temp.check('the next one gets the next number', true,
  public.append_board_update('rls-team-board', 'BAUG') = 2);
select pg_temp.check('the bytes come back out as they went in', true,
  (select u.update = decode('AQID', 'base64') from public.board_updates u
   where u.board_id = 'rls-team-board' and u.seq = 1));
select pg_temp.check('and the owner reads the whole log', true,
  (select count(*) from public.board_updates where board_id = 'rls-team-board') = 2);

-- Two writers at the same instant cannot be handed the same number. The lock that keeps them
-- apart is taken before the last number is read and held to the end of the transaction, so the
-- second writer cannot even look until the first has committed. It is per board, so a busy board
-- does not hold up a quiet one.
select pg_temp.check('appending holds a lock of its own on that board', true,
  exists(select 1 from pg_locks
         where locktype = 'advisory' and classid = 8102 and objsubid = 2
           and objid = hashtext('rls-team-board')::oid));
select pg_temp.check('and holds nothing on any other board', false,
  exists(select 1 from pg_locks
         where locktype = 'advisory' and classid = 8102 and objsubid = 2
           and objid = hashtext('rls-other-board')::oid));
-- Whatever the lock does, the number is the primary key, so a repeat is refused by the table.
select pg_temp.check('the same number twice is refused outright', true, pg_temp.refused(
  $q$insert into public.board_updates (board_id, seq, update)
     values ('rls-team-board', 1, '\x01'::bytea)$q$));

-- 1,400,000 base64 characters is 1,050,000 bytes, just over the limit.
select pg_temp.check('an update over the size limit is refused, not cut short', true, pg_temp.refused(
  $q$select public.append_board_update('rls-team-board', repeat('A', 1400000))$q$));
select pg_temp.check('an empty update is refused too', true, pg_temp.refused(
  $q$select public.append_board_update('rls-team-board', '')$q$));
select pg_temp.check('and neither of them left a row behind', true,
  (select count(*) from public.board_updates where board_id = 'rls-team-board') = 2);

set local role postgres;
insert into public.board_members (board_id, user_id, role, email)
values ('rls-team-board', 'bbbbbbbb-0000-4000-8000-000000000002', 'viewer', 'bob@other.test');

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('a viewer reads the log', true,
  (select count(*) from public.board_updates where board_id = 'rls-team-board') = 2);
select pg_temp.check('but cannot append to it', true, pg_temp.refused(
  $q$select public.append_board_update('rls-team-board', 'AQID')$q$));
select pg_temp.check('nor put a row in by hand', true, pg_temp.refused(
  $q$insert into public.board_updates (board_id, seq, update)
     values ('rls-team-board', 99, '\x01'::bytea)$q$));
select pg_temp.check('nor compact any of it away', true,
  public.compact_board_updates('rls-team-board', 2) = 0);
select pg_temp.check('so the log is still whole', true,
  (select count(*) from public.board_updates where board_id = 'rls-team-board') = 2);

set local role postgres;
update public.board_members set role = 'editor' where board_id = 'rls-team-board';

select pg_temp.becomes('bbbbbbbb-0000-4000-8000-000000000002', 'bob@other.test');
select pg_temp.check('an editor appends, and carries on from the last number', true,
  public.append_board_update('rls-team-board', 'BwgJ') = 3);

select pg_temp.becomes('99999999-0000-4000-8000-000000000009', 'nobody@rls.test');
select pg_temp.check('a stranger sees none of the log', false,
  exists(select 1 from public.board_updates where board_id = 'rls-team-board'));
select pg_temp.check('and cannot append to it', true, pg_temp.refused(
  $q$select public.append_board_update('rls-team-board', 'AQID')$q$));
select pg_temp.check('nor compact it away behind everyone''s back', true,
  public.compact_board_updates('rls-team-board', 3) = 0);

set local role postgres;
select set_config('request.jwt.claims', null, true);
set local role anon;
select pg_temp.check('a caller with no account at all cannot append', true, pg_temp.refused(
  $q$select public.append_board_update('rls-team-board', 'AQID')$q$));

set local role postgres;
select pg_temp.check('nothing a stranger tried changed the log', true,
  (select count(*) from public.board_updates where board_id = 'rls-team-board') = 3);

-- Compacting is the other half: fold the old rows into the snapshot, then drop them. Numbering
-- carries on from what is left, so a reader holding number 3 is not handed a different number 3.
select pg_temp.becomes('aaaaaaaa-0000-4000-8000-000000000001', 'ann@rls.test');
select pg_temp.check('the owner compacts everything up to a number away', true,
  public.compact_board_updates('rls-team-board', 2) = 2);
select pg_temp.check('and what came after it stays', true,
  (select count(*) from public.board_updates where board_id = 'rls-team-board') = 1);
select pg_temp.check('the numbers carry on rather than starting over', true,
  public.append_board_update('rls-team-board', 'CgsM') = 4);

set local role postgres;
delete from public.board_updates where board_id = 'rls-team-board';
delete from public.board_members where board_id = 'rls-team-board';
insert into public.workspace_members (workspace_id, user_id, role, email)
values ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'admin', 'bob@other.test');

-- The issue prefix, on real data ------------------------------------------------------------------
-- The migration that introduced it asks the table to promise the shape of every prefix, and a row
-- that breaks the promise takes the whole file down with it. What follows is the repair standing
-- in front of that promise: every shape the check refuses, put right first.

set local role postgres;
select set_config('request.jwt.claims', '', true);

insert into public.workspaces (id, slug, name, owner)
values ('eeee0000-0000-4000-8000-0000000000e1', '—', 'Проект',
        'aaaaaaaa-0000-4000-8000-000000000001');
select pg_temp.check('a workspace with no ASCII letters in its slug or name still gets a key', true,
  (select prefix from public.workspaces where id = 'eeee0000-0000-4000-8000-0000000000e1') = 'ISS');

-- Clearing it is a write with an obvious right answer, and used to be refused outright because the
-- trigger only ran on the way in.
update public.workspaces set prefix = ''
where id = 'cccccccc-0000-4000-8000-000000000003';
select pg_temp.check('a prefix cleared by an update is filled in rather than refused', true,
  (select prefix ~ '^[A-Z]{1,5}$' from public.workspaces
   where id = 'cccccccc-0000-4000-8000-000000000003'));

-- The shapes the original UPDATE walks straight past. It only looks at null and the empty string,
-- so these reach the constraint untouched and abort the upgrade on somebody's install.
alter table public.workspaces drop constraint workspaces_prefix_check;
insert into public.workspaces (id, slug, name, owner, prefix) values
  ('eeee0000-0000-4000-8000-0000000000e2', 'lower-case', 'Lower', 'aaaaaaaa-0000-4000-8000-000000000001', 'low'),
  ('eeee0000-0000-4000-8000-0000000000e3', 'too-long', 'Toolong', 'aaaaaaaa-0000-4000-8000-000000000001', 'TOOLONG'),
  ('eeee0000-0000-4000-8000-0000000000e4', 'digits', 'Digits', 'aaaaaaaa-0000-4000-8000-000000000001', 'A1');
select pg_temp.check('a prefix the check refuses does exist before the repair', true,
  (select count(*) = 3 from public.workspaces where prefix !~ '^[A-Z]{1,5}$'));

update public.workspaces
set prefix = coalesce(nullif(upper(substring(
  regexp_replace(coalesce(nullif(slug, ''), name, ''), '[^a-zA-Z]', '', 'g') from 1 for 3)), ''), 'ISS')
where prefix is null or prefix !~ '^[A-Z]{1,5}$';

select pg_temp.check('the repair leaves nothing the check would refuse', true,
  (select count(*) = 0 from public.workspaces where prefix is null or prefix !~ '^[A-Z]{1,5}$'));
select pg_temp.check('and the promise can then be asked for without aborting', false,
  pg_temp.refused($$alter table public.workspaces add constraint workspaces_prefix_check
    check (prefix is null or prefix ~ '^[A-Z]{1,5}$')$$));

-- Moving a page under a gate it is not on ----------------------------------------------------------
-- a0a0…0a is restricted to alice; b0b0…0b is not. Bob may write b0b0 and is not on a0a0, so he
-- may not make b0b0 a child of a0a0 (which would hand the subtree to a0a0's people), and he may
-- not lift a restricted page out from under its gate either.

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}';

select pg_temp.check('bob can still write the unrestricted page', false,
  pg_temp.refused($$update public.records set title = 'Moved by bob'
    where id = 'b0b0b0b0-0000-4000-8000-00000000000b'$$));
select pg_temp.check('but cannot push it under a page he is not named on', true,
  pg_temp.refused($$update public.records
    set parent_id = 'a0a0a0a0-0000-4000-8000-00000000000a'
    where id = 'b0b0b0b0-0000-4000-8000-00000000000b'$$));

set local role postgres;
insert into public.records (id, workspace_id, kind, title, parent_id)
values ('c0c0c0c0-0000-4000-8000-00000000000c', 'cccccccc-0000-4000-8000-000000000003',
        'doc', 'Under the gate', 'a0a0a0a0-0000-4000-8000-00000000000a');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

select pg_temp.check('the person named on the gate may move a page inside it', false,
  pg_temp.refused($$update public.records set title = 'Still inside'
    where id = 'c0c0c0c0-0000-4000-8000-00000000000c'$$));

-- Saying you have looked ----------------------------------------------------------------------------
-- A member may stamp their own row and nothing else on it. Somebody outside the workspace, and
-- somebody blocked from it, stamp nothing at all.

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000002", "role": "authenticated"}';

select pg_temp.check('a member can say they have looked', true,
  public.mark_workspace_seen('cccccccc-0000-4000-8000-000000000003') is not null);
select pg_temp.check('and it is their own row that moved', true,
  (select seen_at is not null from public.workspace_members
   where workspace_id = 'cccccccc-0000-4000-8000-000000000003'
     and user_id = 'bbbbbbbb-0000-4000-8000-000000000002'));
set local role postgres;
select pg_temp.check('nobody else was stamped', true,
  (select count(*) = 1 from public.workspace_members
   where workspace_id = 'cccccccc-0000-4000-8000-000000000003' and seen_at is not null));
set local role authenticated;

set local request.jwt.claims = '{"sub": "99999999-0000-4000-8000-000000000009", "role": "authenticated"}';
select pg_temp.check('somebody outside the workspace stamps nothing', true,
  public.mark_workspace_seen('cccccccc-0000-4000-8000-000000000003') is null);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select pg_temp.check('and a caller with no account cannot reach it at all', true,
  pg_temp.refused($$select public.mark_workspace_seen(
    'cccccccc-0000-4000-8000-000000000003')$$));

-- A run is one thing ---------------------------------------------------------------------------------
-- The stamp travels from the row onto its revision, a person's edit never carries one, and the
-- summary answers only for somebody in the workspace.

set local role postgres;
insert into public.records (id, workspace_id, kind, title, updated_via, updated_run)
values ('bbbb1111-0000-4000-8000-00000000ab01', 'cccccccc-0000-4000-8000-000000000003',
        'issue', 'Written by a run', 'claudecode', 'run-20260803-abc123');
update public.records set title = 'Renamed by the same run'
where id = 'bbbb1111-0000-4000-8000-00000000ab01';

select pg_temp.check('the run travels from the row onto its revision', true,
  (select count(*) = 2 from public.record_revisions
   where record_id = 'bbbb1111-0000-4000-8000-00000000ab01'
     and run = 'run-20260803-abc123'));

select pg_temp.check('and a shape nobody should be able to store is refused', true,
  pg_temp.refused($$update public.records set updated_run = 'not a run name!'
    where id = 'bbbb1111-0000-4000-8000-00000000ab01'$$));

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

update public.records set title = 'Renamed by a person'
where id = 'bbbb1111-0000-4000-8000-00000000ab01';
select pg_temp.check('a person editing carries no run', true,
  (select updated_run is null from public.records
   where id = 'bbbb1111-0000-4000-8000-00000000ab01'));

select pg_temp.check('somebody in the workspace sees the run summarised', true,
  (select records = 1 and writes = 2
   from public.agent_runs('cccccccc-0000-4000-8000-000000000003')
   where run = 'run-20260803-abc123'));

set local request.jwt.claims = '{"sub": "99999999-0000-4000-8000-000000000009", "role": "authenticated"}';
select pg_temp.check('and somebody outside it sees no runs at all', true,
  (select count(*) = 0 from public.agent_runs('cccccccc-0000-4000-8000-000000000003')));

set local role postgres;

-- What went wrong, if anything --------------------------------------------------------------------

set local role postgres;

select
  count(*) filter (where expected is distinct from actual) as failed,
  count(*) as checks
from result;

select name, expected, actual from result where expected is distinct from actual order by name;
