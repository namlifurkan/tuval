-- The body of a record -----------------------------------------------------------------------
-- A page is a row like anything else: it has an id, a title, and can be asked about. What it
-- cannot be is a row all the way down, because two people writing the same paragraph is not
-- something last-write-wins can settle. So the body is a CRDT, stored beside the record and
-- keyed by it.
--
-- The same applies to an issue description later: the issue stays a row, its description gets
-- a body here.

create table if not exists public.record_docs (
  record_id   uuid primary key references public.records on delete cascade,
  doc         bytea not null,
  updated_at  timestamptz not null default now()
);

alter table public.record_docs enable row level security;

drop policy if exists record_docs_read  on public.record_docs;
drop policy if exists record_docs_write on public.record_docs;

-- Whoever may read the record may read its body; whoever may change the record may change it.
create policy record_docs_read on public.record_docs for select to authenticated
  using (
    exists (
      select 1 from public.records r
      where r.id = record_id and (select public.in_workspace(r.workspace_id))
    )
  );

create policy record_docs_write on public.record_docs for all to authenticated
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
