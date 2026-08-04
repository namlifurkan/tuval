-- Publishing was permanent until somebody remembered to undo it. A brief shown to a client, a
-- board sent to a candidate, a page opened for one meeting — all of them stayed open for as long
-- as the workspace existed, and taking a link back was a habit rather than a rule.
--
-- One nullable column on each of the two things that can be published, and every gate that asks
-- "is this public" now also asks "still". Null means what it always meant: open until closed.

alter table public.records add column if not exists public_until timestamptz;
alter table public.boards  add column if not exists public_until timestamptz;

-- A board: the one function the row, its snapshots and its pictures all read.
create or replace function public.board_is_public(board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b
    where b.id = board
      and b.public_at is not null
      and b.deleted_at is null
      and (b.public_until is null or b.public_until > now())
  );
$$;

grant execute on function public.board_is_public(text) to anon, authenticated;

-- The anon side of a board is its own policy and asks the column directly.
drop policy if exists boards_public on public.boards;
create policy boards_public on public.boards for select to anon
  using (
    public_at is not null
    and deleted_at is null
    and (public_until is null or public_until > now())
  );

-- A page, and the body that follows it. Four policies, one clause.
drop policy if exists records_read   on public.records;
drop policy if exists records_public on public.records;

create policy records_read on public.records for select to authenticated
  using (
    (published_at is not null and (public_until is null or public_until > now()))
    or ((select public.in_workspace(workspace_id)) and (select public.can_read_record(id)))
  );

create policy records_public on public.records for select to anon
  using (published_at is not null and (public_until is null or public_until > now()));

drop policy if exists record_docs_read   on public.record_docs;
drop policy if exists record_docs_public on public.record_docs;

create policy record_docs_read on public.record_docs for select to authenticated
  using (
    exists (
      select 1 from public.records r
      where r.id = record_id
        and r.published_at is not null
        and (r.public_until is null or r.public_until > now())
    )
    or (select public.can_read_record(record_id))
  );

create policy record_docs_public on public.record_docs for select to anon
  using (
    exists (
      select 1 from public.records r
      where r.id = record_id
        and r.published_at is not null
        and (r.public_until is null or r.public_until > now())
    )
  );
