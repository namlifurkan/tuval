-- Who may see one page ---------------------------------------------------------------------------
-- Until now a record was readable exactly when its workspace was. That is the right default and
-- stays the default: this only adds the two cases the default cannot express.
--
-- Restricted: a page with people named on it is readable only by them. Naming people on a page
-- restricts everything under it too, because a subpage of a private page is part of that page.
-- The nearest named ancestor decides, so a page can be opened up again further down.
--
-- Published: a page anybody can read, signed in or not. That is a deliberate hole in the wall
-- and so it is one column, set on one page at a time, never inherited.

alter table public.records
  add column if not exists published_at timestamptz,
  add column if not exists public_slug  text unique;

create index if not exists records_published_idx on public.records (public_slug)
  where published_at is not null;

create table if not exists public.record_members (
  record_id uuid not null references public.records on delete cascade,
  user_id   uuid not null references auth.users on delete cascade,
  role      text not null default 'editor' check (role in ('editor', 'viewer', 'blocked')),
  email     text,
  primary key (record_id, user_id)
);

create index if not exists record_members_user_idx on public.record_members (user_id);

alter table public.record_members enable row level security;

-- The nearest ancestor with people named on it, or nothing if there is none. Depth is capped
-- because a tree that has somehow been made cyclic should be an access refusal, not a hang.
create or replace function public.record_gate(rec uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  with recursive up as (
    select r.id, r.parent_id, 0 as depth from public.records r where r.id = rec
    union all
    select r.id, r.parent_id, up.depth + 1
    from public.records r join up on r.id = up.parent_id
    where up.depth < 24
  )
  select up.id from up
  where exists (select 1 from public.record_members m where m.record_id = up.id)
  order by up.depth
  limit 1;
$$;

create or replace function public.can_read_record(rec uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ws   uuid;
  gate uuid;
begin
  if rec is null then return false; end if;
  select r.workspace_id into ws from public.records r where r.id = rec;
  -- Nothing there yet is nothing to refuse: an insert is judged by its parent, below.
  if ws is null then return true; end if;
  if not public.in_workspace(ws) then return false; end if;

  gate := public.record_gate(rec);
  if gate is null then return true; end if;

  -- Whoever owns the workspace is never shut out of it, or a page could be made unreachable
  -- by the last person on it leaving.
  if exists (select 1 from public.workspaces w where w.id = ws and w.owner = (select auth.uid())) then
    return true;
  end if;

  return exists (
    select 1 from public.record_members m
    where m.record_id = gate and m.user_id = (select auth.uid()) and m.role <> 'blocked'
  );
end;
$$;

create or replace function public.can_write_record(rec uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ws   uuid;
  gate uuid;
begin
  if rec is null then return true; end if;
  select r.workspace_id into ws from public.records r where r.id = rec;
  if ws is null then return true; end if;
  if not public.can_write_workspace(ws) then return false; end if;

  gate := public.record_gate(rec);
  if gate is null then return true; end if;

  if exists (select 1 from public.workspaces w where w.id = ws and w.owner = (select auth.uid())) then
    return true;
  end if;

  return exists (
    select 1 from public.record_members m
    where m.record_id = gate and m.user_id = (select auth.uid()) and m.role = 'editor'
  );
end;
$$;

-- One policy per command rather than one for all of them: an insert has no row to gate yet, so
-- it is judged by the parent it is being put under, and only an update can be judged by itself.
drop policy if exists records_read   on public.records;
drop policy if exists records_write  on public.records;
drop policy if exists records_insert on public.records;
drop policy if exists records_update on public.records;
drop policy if exists records_delete on public.records;
drop policy if exists records_public on public.records;

create policy records_read on public.records for select to authenticated
  using (
    published_at is not null
    or ((select public.in_workspace(workspace_id)) and (select public.can_read_record(id)))
  );

create policy records_public on public.records for select to anon
  using (published_at is not null);

create policy records_insert on public.records for insert to authenticated
  with check (
    (select public.can_write_workspace(workspace_id))
    and (select public.can_write_record(parent_id))
  );

create policy records_update on public.records for update to authenticated
  using ((select public.can_write_record(id)))
  with check ((select public.can_write_record(id)));

create policy records_delete on public.records for delete to authenticated
  using ((select public.can_write_record(id)));

-- The body follows the record it belongs to, published and restricted alike.
drop policy if exists record_docs_read   on public.record_docs;
drop policy if exists record_docs_write  on public.record_docs;
drop policy if exists record_docs_public on public.record_docs;

create policy record_docs_read on public.record_docs for select to authenticated
  using (
    exists (select 1 from public.records r where r.id = record_id and r.published_at is not null)
    or (select public.can_read_record(record_id))
  );

create policy record_docs_public on public.record_docs for select to anon
  using (
    exists (select 1 from public.records r where r.id = record_id and r.published_at is not null)
  );

create policy record_docs_write on public.record_docs for all to authenticated
  using ((select public.can_write_record(record_id)))
  with check ((select public.can_write_record(record_id)));

-- Who is named on a page is visible to everybody named on it, and changed by whoever may write
-- the page. The first person to restrict a page is doing so from a page they can still write.
drop policy if exists record_members_read  on public.record_members;
drop policy if exists record_members_write on public.record_members;

create policy record_members_read on public.record_members for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.records r
      where r.id = record_id and (select public.can_write_workspace(r.workspace_id))
    )
  );

create policy record_members_write on public.record_members for all to authenticated
  using (
    exists (
      select 1 from public.records r
      where r.id = record_id and (select public.can_write_workspace(r.workspace_id))
    )
  )
  with check (
    exists (
      select 1 from public.records r
      where r.id = record_id and (select public.can_write_workspace(r.workspace_id))
    )
  );
