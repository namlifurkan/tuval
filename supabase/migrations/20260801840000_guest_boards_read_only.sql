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
      ) or exists (
        select 1 from public.boards b
        where b.id = board and b.allowed_domain is not null and b.domain_role = 'editor'
          and b.allowed_domain = public.email_domain((select auth.jwt() ->> 'email'))
      )
    )
  );
$$;

revoke all on function public.can_write_board(text) from public;
grant execute on function public.can_write_board(text) to authenticated;
