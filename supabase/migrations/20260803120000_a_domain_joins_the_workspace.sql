-- A domain joins the workspace, not the board -------------------------------------------------
-- Opening a board to everybody at a company was written before there were workspaces, so it was
-- attached to the only thing that existed: one board at a time. That is the wrong height. What a
-- colleague arriving at their own company's installation wants is not a board, it is the place
-- the boards, the docs and the projects are kept, and workspace membership already grants all
-- three. So the rule moves up and the board-level one is removed rather than kept beside it.
--
-- Nobody loses access they were using: somebody who had opened a board through the old rule has
-- a membership row from that first open, and it stays. Somebody who never opened it never had a
-- row, and now needs an invitation. Narrowing is the safe direction for a rule about who is let
-- in without being asked for.

alter table public.workspaces add column if not exists allowed_domain text;
alter table public.workspaces add column if not exists domain_role text not null default 'guest';
alter table public.workspaces drop constraint if exists workspaces_domain_role_check;
alter table public.workspaces add constraint workspaces_domain_role_check
  check (domain_role in ('member', 'guest'));

-- Which rows the rule wrote rather than a person. It answers two questions that are otherwise
-- guesses: whether a seat was taken deliberately, and whether the screen may say how somebody
-- got here.
alter table public.workspace_members add column if not exists via_domain boolean not null default false;

-- Public mailbox providers -----------------------------------------------------------------------
-- The guard has always asked only that a domain be your own. On a company installation that is
-- the whole question. On a hosted one it is not: an owner signing in with a personal address
-- holds gmail.com as honestly as anyone else, and this rule now hands over a workspace rather
-- than a single board. The list is seeded rather than assumed, and merged rather than replaced,
-- so an operator's own additions survive this file running twice.
update public.tuval_settings set blocked_domains = (
  select array(select distinct lower(one) from unnest(blocked_domains || array[
    'gmail.com', 'googlemail.com', 'outlook.com', 'outlook.com.tr', 'hotmail.com',
    'hotmail.co.uk', 'hotmail.com.tr', 'live.com', 'live.co.uk', 'msn.com', 'windowslive.com',
    'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'rocketmail.com',
    'icloud.com', 'me.com', 'mac.com',
    'proton.me', 'protonmail.com', 'pm.me',
    'aol.com', 'gmx.com', 'gmx.net', 'gmx.de', 'mail.com', 'hey.com', 'fastmail.com',
    'zoho.com', 'tutanota.com', 'tuta.io',
    'yandex.com', 'yandex.ru', 'yandex.com.tr', 'mail.ru',
    'mynet.com', 'superonline.com', 'ttmail.com',
    'qq.com', '163.com', '126.com', 'sina.com', 'naver.com', 'daum.net', 'hanmail.net',
    'web.de', 't-online.de', 'freenet.de', 'seznam.cz',
    'orange.fr', 'free.fr', 'sfr.fr', 'wanadoo.fr', 'laposte.net',
    'libero.it', 'virgilio.it', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'rediffmail.com'
  ]) as one order by 1)
) where id = 1;

-- The domain is read from the owner's confirmed address, never from what was typed. An admin
-- may set the rule, but they cannot set it to a domain the workspace's owner cannot receive mail
-- at, so nobody opens a workspace to a company they are not in.
create or replace function public.workspaces_guard_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg  public.tuval_settings;
  held text;
begin
  if new.allowed_domain is null then
    return new;
  end if;
  new.allowed_domain := lower(new.allowed_domain);
  select * into cfg from public.tuval_settings where id = 1;

  select public.email_domain(u.email) into held
  from auth.users u
  where u.id = new.owner and u.email_confirmed_at is not null;

  if cfg.restrict_to_own_domain and coalesce(held, '') <> new.allowed_domain then
    raise exception 'a workspace can only be opened to the domain its owner signs in with';
  end if;

  if new.allowed_domain = any (cfg.blocked_domains) then
    raise exception 'that domain is shared by too many people to stand for a company';
  end if;
  return new;
end;
$$;

-- A trigger runs as the table's owner whoever fired it, so nobody needs to be able to call this
-- by name, and a security definer function that anybody may call is how a door gets left open.
revoke all on function public.workspaces_guard_domain() from public, anon, authenticated;

drop trigger if exists workspaces_domain_guard on public.workspaces;
create trigger workspaces_domain_guard before insert or update of allowed_domain on public.workspaces
  for each row execute function public.workspaces_guard_domain();

-- Extends the existing claim for the third time rather than adding a call beside it: an address
-- is let in by an invitation or by the domain it belongs to, and both are the same question
-- asked on the same sign-in. The address has to be confirmed here, because an unconfirmed one is
-- a claim about a company somebody typed rather than one they can receive mail at. An existing
-- membership row of any kind wins, which is what keeps a removal — stored as 'blocked' — from
-- being undone on the next sign-in.
create or replace function public.claim_invites()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken int;
  mail  text := lower((select auth.jwt() ->> 'email'));
  home  text;
begin
  with mine as (
    select i.board_id, i.role, i.email from public.board_invites i where lower(i.email) = mail
  ), added as (
    insert into public.board_members (board_id, user_id, role, email)
    select m.board_id, (select auth.uid()), m.role, m.email from mine m
    on conflict (board_id, user_id) do update set role = excluded.role
    returning board_id
  )
  delete from public.board_invites i
  where i.board_id in (select board_id from added) and lower(i.email) = mail;

  get diagnostics taken = row_count;

  with mine as (
    select i.workspace_id, i.role, i.email
    from public.workspace_invites i where lower(i.email) = mail
  ), added as (
    insert into public.workspace_members (workspace_id, user_id, role, email)
    select m.workspace_id, (select auth.uid()), m.role, m.email from mine m
    on conflict (workspace_id, user_id) do update set role = excluded.role
    returning workspace_id
  )
  delete from public.workspace_invites i
  where i.workspace_id in (select workspace_id from added) and lower(i.email) = mail;

  select public.email_domain(u.email) into home
  from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;

  if coalesce(home, '') <> '' then
    insert into public.workspace_members (workspace_id, user_id, role, email, via_domain)
    select w.id, (select auth.uid()), w.domain_role, mail, true
    from public.workspaces w
    where w.allowed_domain = home
      and w.owner <> (select auth.uid())
      and not exists (
        select 1 from public.workspace_members m
        where m.workspace_id = w.id and m.user_id = (select auth.uid())
      )
    on conflict (workspace_id, user_id) do nothing;
  end if;

  return taken;
end;
$$;

revoke all on function public.claim_invites() from public, anon;
grant execute on function public.claim_invites() to authenticated;

-- Seats -------------------------------------------------------------------------------------------
-- A seat is somebody the workspace decided to carry. The rule's readers were decided about as a
-- group and cost nothing to answer, so they are not counted and are not stopped at the door — a
-- free workspace opening itself to its company would otherwise let three people in and show the
-- fourth a limit they did not ask to reach. Somebody the rule brought in and an admin then made
-- a member is a deliberate seat again, and counts.
create or replace function public.workspace_seats(ws uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select 1
    + (select count(*) from public.workspace_members m
       where m.workspace_id = ws and m.role <> 'blocked'
         and not (m.via_domain and m.role = 'guest')
         and m.user_id <> (select w.owner from public.workspaces w where w.id = ws))
    + (select count(*) from public.workspace_invites i where i.workspace_id = ws);
$$;

create or replace function public.check_seats()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  ws  uuid := new.workspace_id;
  cap record;
begin
  -- Nested rather than one condition: an invitation row has no via_domain column, and plpgsql
  -- plans the whole expression before it runs a line of it.
  if tg_table_name = 'workspace_members' then
    if new.via_domain and new.role = 'guest' then
      return new;
    end if;
  end if;

  select * into cap from public.plan_limits(public.plan_of(ws), public.workspace_seats(ws));
  if public.workspace_seats(ws) >= cap.seats then
    raise exception 'seat limit reached'
      using hint = 'This workspace is on a plan with ' || cap.seats || ' seats.';
  end if;
  return new;
end;
$$;

-- The board's own rule, removed ---------------------------------------------------------------
-- Read and write drop their domain branch; what is left is the board's owner, the per-board
-- grants, and the workspace. The columns go with it so there is one place a domain is written.
create or replace function public.can_read_board(board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner = (select auth.uid())
  ) or (
    not exists (
      select 1 from public.board_members m
      where m.board_id = board and m.user_id = (select auth.uid()) and m.role = 'blocked'
    ) and (
      exists (
        select 1 from public.board_members m
        where m.board_id = board and m.user_id = (select auth.uid())
      ) or exists (
        select 1 from public.boards b
        where b.id = board and (select public.in_workspace(b.workspace_id))
      )
    )
  );
$$;

create or replace function public.can_write_board(board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b where b.id = board and b.owner = (select auth.uid())
  ) or (
    not exists (
      select 1 from public.board_members m
      where m.board_id = board and m.user_id = (select auth.uid()) and m.role <> 'editor'
    ) and (
      exists (
        select 1 from public.board_members m
        where m.board_id = board and m.user_id = (select auth.uid()) and m.role = 'editor'
      ) or exists (
        select 1 from public.boards b
        where b.id = board and (select public.can_write_workspace(b.workspace_id))
      )
    )
  );
$$;

revoke all on function public.can_read_board(text) from public;
revoke all on function public.can_write_board(text) from public;
grant execute on function public.can_read_board(text) to authenticated;
grant execute on function public.can_write_board(text) to authenticated;

drop trigger if exists boards_domain_guard on public.boards;
drop function if exists public.boards_guard_domain();
drop function if exists public.touch_membership(text);

alter table public.boards drop column if exists allowed_domain;
alter table public.boards drop column if exists domain_role;
