-- A board could be made from outside and never touched again. An integration that publishes the
-- same report every sprint had one move available — make another board — so four runs left four
-- boards, three of them rubbish, and none of them removable from out there either. The way to fix
-- a report was to open the app and clean up by hand, which is the shape of a thing nobody keeps
-- doing.
--
-- Two things are needed for a board to be updatable from the API, and one of them is a gate.
-- `can_read_board_as` exists because the door holds the service key and has to ask the question
-- the client's own policies ask, on behalf of the person whose key it is. Writing is a different
-- question with a different answer — a viewer can read a board and must not redraw it — so it
-- gets the same treatment rather than borrowing the read.
--
-- The workspace half is asked through `workspace_seat` for the reason written beside the read
-- variant: that is where "is this person in that workspace" already lives, and two copies of an
-- access rule agree until the day one of them is changed. The board half is the membership rule
-- from `can_write_board`, which has no such single home to defer to.

create or replace function public.can_write_board_as(who uuid, board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select who is not null and (
    exists (
      select 1 from public.boards b where b.id = board and b.owner = who
    ) or (
      not exists (
        select 1 from public.board_members m
        where m.board_id = board and m.user_id = who and m.role <> 'editor'
      ) and (
        exists (
          select 1 from public.board_members m
          where m.board_id = board and m.user_id = who and m.role = 'editor'
        ) or exists (
          select 1 from public.boards b
          where b.id = board
            and coalesce(public.workspace_seat(who, b.workspace_id), 'blocked')
                in ('owner', 'admin', 'member')
        )
      )
    )
  );
$$;

revoke all on function public.can_write_board_as(uuid, text) from public, authenticated, anon;
grant execute on function public.can_write_board_as(uuid, text) to service_role;

-- How the next brief meets what is already on the canvas. A brief has always been drawn by the
-- first browser to open the board, and until now there was only ever one of them, so the question
-- did not arise. It arises the moment the same board can be redrawn.
--
-- Null is append, so a row written before this existed and a caller that says nothing get the
-- reading that adds rather than the one that removes.
alter table public.boards add column if not exists pending_mode text;

alter table public.boards drop constraint if exists boards_pending_mode_check;
alter table public.boards add constraint boards_pending_mode_check
  check (pending_mode is null or pending_mode in ('append', 'replace'));
