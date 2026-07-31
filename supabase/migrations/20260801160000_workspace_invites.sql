-- Inviting somebody to the team --------------------------------------------------------------
-- Board invites wait by address until that address signs in, because the person being invited
-- usually has no account yet. A workspace invite works the same way, and the same claim runs on
-- sign in so somebody invited to a team and to a board in it is admitted to both at once.

create table if not exists public.workspace_invites (
  workspace_id  uuid not null references public.workspaces on delete cascade,
  email         text not null,
  role          text not null default 'member' check (role in ('admin', 'member', 'guest')),
  invited_by    uuid references auth.users on delete set null,
  created_at    timestamptz not null default now(),
  primary key (workspace_id, email)
);

create index if not exists workspace_invites_email_idx on public.workspace_invites (lower(email));

alter table public.workspace_invites enable row level security;

drop policy if exists ws_invites_admin on public.workspace_invites;
drop policy if exists ws_invites_mine  on public.workspace_invites;

create policy ws_invites_admin on public.workspace_invites for all to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create policy ws_invites_mine on public.workspace_invites for select to authenticated
  using (lower(email) = lower((select auth.jwt() ->> 'email')));

-- Extends the existing claim rather than adding a second one, so one call on sign in settles
-- every invitation waiting for this address.
create or replace function public.claim_invites()
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  taken int;
  mail  text := lower((select auth.jwt() ->> 'email'));
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

  return taken;
end;
$$;

revoke all on function public.claim_invites() from public;
grant execute on function public.claim_invites() to authenticated;
