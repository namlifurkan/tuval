-- Notifications --------------------------------------------------------------------------------
-- What happened while you were not looking. Rows rather than anything cleverer, because "what is
-- waiting for me" is a question asked across a whole workspace and the server has to be able to
-- answer it without reading a document it cannot read.
--
-- Only what the server can actually see becomes a notification: an assignment is a column, and a
-- person mentioned in a page is written here by the client that saved the page. Comments live
-- inside the document and so are not here at all.

create table if not exists public.notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  -- Who is being told, and who did it. The actor may be nobody once an account is deleted.
  user_id      uuid not null references auth.users on delete cascade,
  actor        uuid references auth.users on delete set null,
  kind         text not null check (kind in ('assigned', 'mentioned')),
  record_id    uuid references public.records on delete cascade,
  created_at   timestamptz not null default now(),
  read_at      timestamptz
);

-- The inbox is "mine, newest first", and the badge is "mine, unread".
create index if not exists notifications_mine_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where read_at is null;

-- Being named in a page tells you once. Saving that page again is not news, and a page is saved
-- every few seconds while somebody writes in it.
create unique index if not exists notifications_mention_once
  on public.notifications (user_id, record_id) where kind = 'mentioned';

alter table public.notifications enable row level security;

drop policy if exists notifications_read   on public.notifications;
drop policy if exists notifications_write  on public.notifications;
drop policy if exists notifications_mine   on public.notifications;
drop policy if exists notifications_remove on public.notifications;

-- Yours and nobody else's, whoever wrote it.
create policy notifications_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));

-- Anyone who may write in the workspace may tell somebody about it. They still cannot read what
-- they sent, which is the point: this is a way to reach an inbox, not a way to see one.
create policy notifications_write on public.notifications for insert to authenticated
  with check ((select public.can_write_workspace(workspace_id)));

-- Marking one read is the only change anybody makes to their own.
create policy notifications_mine on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy notifications_remove on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));

-- Assignment is a column, so the server can notice it happening and does not need to be told.
-- Assigning something to yourself is not news.
create or replace function public.notify_assignee()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.assignee is not null
     and new.assignee is distinct from (select auth.uid())
     and (tg_op = 'INSERT' or new.assignee is distinct from old.assignee)
  then
    insert into public.notifications (workspace_id, user_id, actor, kind, record_id)
    values (new.workspace_id, new.assignee, (select auth.uid()), 'assigned', new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists records_assigned on public.records;
create trigger records_assigned after insert or update of assignee on public.records
  for each row execute function public.notify_assignee();
