-- A board marked public was readable by a stranger with no account and by nobody else. The two
-- policies that open it are `to anon`, and `can_read_board` — which is what every authenticated
-- read goes through, for the row, its snapshots and its pictures alike — never asked whether the
-- board was public at all. So the person most likely to open a shared link, a colleague already
-- signed in, was refused, and signing out was the workaround.
--
-- One clause, in the one function all three of those policies already call. Writing is untouched:
-- `can_write_board` still wants ownership or membership.

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
      ) or (select public.board_is_public(board))
    )
  );
$$;

revoke all on function public.can_read_board(text) from public;
grant execute on function public.can_read_board(text) to authenticated;
