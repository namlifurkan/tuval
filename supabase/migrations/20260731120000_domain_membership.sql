-- Membership for people who arrived through the domain rule -------------------------------
-- Domain access grants read and write without leaving a trace, so the owner cannot see who
-- is on the board or remove one person. A row is written on first open, and an explicit
-- 'blocked' row always wins over the domain rule.

alter table public.board_members drop constraint if exists board_members_role_check;
alter table public.board_members add constraint board_members_role_check
  check (role in ('editor', 'viewer', 'blocked'));

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
        where b.id = board and b.allowed_domain is not null
          and b.allowed_domain = public.email_domain((select auth.jwt() ->> 'email'))
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
        where b.id = board and b.allowed_domain is not null and b.domain_role = 'editor'
          and b.allowed_domain = public.email_domain((select auth.jwt() ->> 'email'))
      )
    )
  );
$$;

-- Called on every board open. Security definer because someone arriving through the domain
-- rule has no write rights on board_members yet.
create or replace function public.touch_membership(board text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted text;
begin
  if (select auth.uid()) is null then return; end if;

  if exists (
    select 1 from public.boards b where b.id = board and b.owner = (select auth.uid())
  ) then return; end if;

  if exists (
    select 1 from public.board_members m
    where m.board_id = board and m.user_id = (select auth.uid())
  ) then return; end if;

  select b.domain_role into wanted
  from public.boards b
  where b.id = board and b.allowed_domain is not null
    and b.allowed_domain = public.email_domain((select auth.jwt() ->> 'email'));

  if wanted is null then return; end if;

  insert into public.board_members (board_id, user_id, role, email)
  values (board, (select auth.uid()), wanted, (select auth.jwt() ->> 'email'))
  on conflict (board_id, user_id) do nothing;
end;
$$;

revoke all on function public.touch_membership(text) from public;
grant execute on function public.touch_membership(text) to authenticated;
