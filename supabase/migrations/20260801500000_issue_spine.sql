-- What an issue needs to be an issue --------------------------------------------------------------
-- Until now an issue was a title, a status, somebody's name and a date. That is a to-do list. The
-- things a team actually runs on are missing: a number you can say out loud, a size, the two weeks
-- it belongs to, and labels.
--
-- None of it becomes a second kind of row. An issue stays a record, so it can be put on a canvas,
-- named in a page and found in the same search as everything else.

-- A number you can say out loud ---------------------------------------------------------------

alter table public.workspaces add column if not exists prefix text;

update public.workspaces
set prefix = upper(substring(
  regexp_replace(coalesce(nullif(slug, ''), name, 'iss'), '[^a-zA-Z]', '', 'g') from 1 for 3))
where prefix is null or prefix = '';

-- And every workspace made from here on, not just the ones that already existed.
create or replace function public.workspaces_prefix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.prefix is null or new.prefix = '' then
    new.prefix := upper(substring(
      regexp_replace(coalesce(nullif(new.slug, ''), new.name, ''), '[^a-zA-Z]', '', 'g') from 1 for 3));
    if new.prefix = '' then new.prefix := 'ISS'; end if;
  end if;
  return new;
end;
$$;

drop trigger if exists workspaces_prefixed on public.workspaces;
create trigger workspaces_prefixed before insert on public.workspaces
  for each row execute function public.workspaces_prefix();

alter table public.workspaces drop constraint if exists workspaces_prefix_check;
alter table public.workspaces add constraint workspaces_prefix_check
  check (prefix is null or prefix ~ '^[A-Z]{1,5}$');

alter table public.records add column if not exists seq int;

-- Unique within a workspace, so TUV-12 means one issue and always the same one.
create unique index if not exists records_seq_idx
  on public.records (workspace_id, seq) where seq is not null;

-- Size, and the two weeks it belongs to --------------------------------------------------------

create table if not exists public.cycles (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  number       int not null,
  name         text not null default '',
  starts_on    date not null,
  ends_on      date not null,
  created_at   timestamptz not null default now(),
  unique (workspace_id, number)
);

create index if not exists cycles_workspace_idx on public.cycles (workspace_id, starts_on desc);

alter table public.records
  add column if not exists estimate   int,
  -- A project is a record too, which is why this points back at the same table.
  add column if not exists project_id uuid references public.records on delete set null,
  add column if not exists cycle_id   uuid references public.cycles on delete set null;

alter table public.records drop constraint if exists records_estimate_check;
alter table public.records add constraint records_estimate_check
  check (estimate is null or (estimate >= 0 and estimate <= 999));

create index if not exists records_cycle_idx on public.records (cycle_id)
  where archived_at is null;
create index if not exists records_project_idx on public.records (project_id)
  where archived_at is null;

-- Two states that were missing ------------------------------------------------------------------
-- Backlog is "not now" and is the difference between a list you can read and a list you cannot.
-- In review is where work sits while somebody else looks at it, which is not the same as doing.

alter table public.records drop constraint if exists records_status_check;
alter table public.records add constraint records_status_check
  check (status is null or status in
    ('backlog', 'todo', 'doing', 'review', 'blocked', 'done', 'cancelled'));

-- Labels ----------------------------------------------------------------------------------------

create table if not exists public.labels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name         text not null,
  tone         text not null default '#8A867C',
  created_at   timestamptz not null default now()
);

-- One "bug" per workspace, whatever case somebody types it in.
create unique index if not exists labels_name_idx
  on public.labels (workspace_id, lower(name));

create table if not exists public.record_labels (
  record_id uuid not null references public.records on delete cascade,
  label_id  uuid not null references public.labels on delete cascade,
  primary key (record_id, label_id)
);

create index if not exists record_labels_label_idx on public.record_labels (label_id);

-- Numbering -------------------------------------------------------------------------------------
-- Taken on insert, and only for issues: a page does not want a number and a database row would
-- burn through them. The workspace row is locked first, so two issues made in the same instant
-- get two numbers rather than one number twice.

create or replace function public.records_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kind = 'issue' and new.seq is null then
    perform 1 from public.workspaces w where w.id = new.workspace_id for update;
    select coalesce(max(r.seq), 0) + 1 into new.seq
    from public.records r
    where r.workspace_id = new.workspace_id and r.seq is not null;
  end if;
  return new;
end;
$$;

drop trigger if exists records_numbered on public.records;
create trigger records_numbered before insert on public.records
  for each row execute function public.records_number();

-- Access ----------------------------------------------------------------------------------------
-- A cycle and a label belong to the workspace and follow its rules exactly. What is labelled
-- follows the record, so a label on a page nobody may read cannot be read either.

alter table public.cycles        enable row level security;
alter table public.labels        enable row level security;
alter table public.record_labels enable row level security;

drop policy if exists cycles_read  on public.cycles;
drop policy if exists cycles_write on public.cycles;
drop policy if exists labels_read  on public.labels;
drop policy if exists labels_write on public.labels;
drop policy if exists record_labels_read  on public.record_labels;
drop policy if exists record_labels_write on public.record_labels;

create policy cycles_read on public.cycles for select to authenticated
  using ((select public.in_workspace(workspace_id)));

create policy cycles_write on public.cycles for all to authenticated
  using ((select public.can_write_workspace(workspace_id)))
  with check ((select public.can_write_workspace(workspace_id)));

create policy labels_read on public.labels for select to authenticated
  using ((select public.in_workspace(workspace_id)));

create policy labels_write on public.labels for all to authenticated
  using ((select public.can_write_workspace(workspace_id)))
  with check ((select public.can_write_workspace(workspace_id)));

create policy record_labels_read on public.record_labels for select to authenticated
  using ((select public.can_read_record(record_id)));

create policy record_labels_write on public.record_labels for all to authenticated
  using ((select public.can_write_record(record_id)))
  with check ((select public.can_write_record(record_id)));
