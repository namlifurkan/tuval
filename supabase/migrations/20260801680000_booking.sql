-- Somebody outside picking a time --------------------------------------------------------------
-- The smallest thing that replaces a booking link: a page with the free slots on it, and a
-- booking that becomes an event in the workspace like any other record.
--
-- Times are stored as they are meant to be read — a page belongs to one person in one place, and
-- the hours they work are the hours where they are. What crosses a timezone is the booked
-- instant, which is a timestamptz and needs no arguing about.

create table if not exists public.booking_pages (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  owner        uuid not null references auth.users on delete cascade,
  slug         text not null unique,
  title        text not null default '',
  intro        text not null default '',
  minutes      int not null default 30 check (minutes between 5 and 480),
  -- Which days, 1 for Monday, and the hours on them, in the owner's own time.
  weekdays     int[] not null default array[1, 2, 3, 4, 5],
  opens_at     time not null default '09:00',
  closes_at    time not null default '17:00',
  zone         text not null default 'Europe/Istanbul',
  -- How far ahead somebody may book, and how little notice they may give.
  horizon_days int not null default 21 check (horizon_days between 1 and 120),
  notice_hours int not null default 12 check (notice_hours between 0 and 336),
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists booking_pages_owner_idx on public.booking_pages (owner);

create table if not exists public.bookings (
  id         uuid primary key default gen_random_uuid(),
  page_id    uuid not null references public.booking_pages on delete cascade,
  record_id  uuid references public.records on delete set null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  name       text not null default '',
  email      text not null default '',
  note       text not null default '',
  created_at timestamptz not null default now(),
  -- One booking per instant per page. Two people clicking the same slot at the same moment is
  -- exactly the case a calendar has to get right, and this is the only way to be sure of it.
  unique (page_id, starts_at)
);

alter table public.booking_pages enable row level security;
alter table public.bookings      enable row level security;

drop policy if exists booking_pages_read   on public.booking_pages;
drop policy if exists booking_pages_public on public.booking_pages;
drop policy if exists booking_pages_write  on public.booking_pages;
drop policy if exists bookings_read        on public.bookings;

create policy booking_pages_read on public.booking_pages for select to authenticated
  using ((select public.in_workspace(workspace_id)));

-- A live page is readable by anybody, or there is nothing to draw for the person booking. What
-- they can read is when you are free, never who has already booked.
create policy booking_pages_public on public.booking_pages for select to anon
  using (active);

create policy booking_pages_write on public.booking_pages for all to authenticated
  using (owner = (select auth.uid()) and (select public.can_write_workspace(workspace_id)))
  with check (owner = (select auth.uid()) and (select public.can_write_workspace(workspace_id)));

create policy bookings_read on public.bookings for select to authenticated
  using (exists (
    select 1 from public.booking_pages p
    where p.id = page_id and (select public.in_workspace(p.workspace_id))
  ));

-- Which instants are already gone -----------------------------------------------------------------
-- Only the instants, never who booked them: somebody choosing a time needs to know a slot is
-- taken and has no business knowing by whom.

create or replace function public.taken_slots(page_slug text)
returns setof timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select b.starts_at
  from public.bookings b
  join public.booking_pages p on p.id = b.page_id
  where p.slug = page_slug and p.active and b.starts_at > now();
$$;

-- Booking ------------------------------------------------------------------------------------------
-- Everything that decides whether a time is allowed is here rather than in the page: a hand-made
-- request cannot book outside the hours, at no notice, or past the horizon.

create or replace function public.book_slot(
  page_slug text,
  at timestamptz,
  who text,
  mail text,
  note text default ''
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  page  public.booking_pages;
  local timestamp;
  made  uuid;
  event uuid;
begin
  select * into page from public.booking_pages p where p.slug = page_slug and p.active;
  if page.id is null then
    return null;
  end if;

  if at < now() + make_interval(hours => page.notice_hours) then
    return null;
  end if;
  if at > now() + make_interval(days => page.horizon_days) then
    return null;
  end if;

  -- Judged in the owner's own time, which is what their working hours are written in.
  local := at at time zone page.zone;

  if not (extract(isodow from local)::int = any (page.weekdays)) then
    return null;
  end if;
  if local::time < page.opens_at or (local + make_interval(mins => page.minutes))::time > page.closes_at then
    return null;
  end if;
  -- Slots start on the hour and at whole multiples of the length, so the day divides evenly and
  -- two people cannot book overlapping halves of the same hour.
  if extract(epoch from (local::time - page.opens_at))::int % (page.minutes * 60) <> 0 then
    return null;
  end if;

  insert into public.records (workspace_id, kind, title, assignee, due_at, description)
  values (
    page.workspace_id, 'event',
    coalesce(nullif(trim(who), ''), 'Booking') || ' · ' || page.title,
    page.owner, at,
    trim(both from coalesce(mail, '') || E'\n' || coalesce(note, ''))
  )
  returning id into event;

  insert into public.bookings (page_id, record_id, starts_at, ends_at, name, email, note)
  values (page.id, event, at, at + make_interval(mins => page.minutes),
          left(trim(who), 120), left(trim(mail), 200), left(trim(note), 2000))
  returning id into made;

  return made;
exception when unique_violation then
  -- Somebody took it in the moment between the page being drawn and the button being pressed.
  return null;
end;
$$;

revoke all on function public.taken_slots(text) from public;
revoke all on function public.book_slot(text, timestamptz, text, text, text) from public;
grant execute on function public.taken_slots(text) to anon, authenticated;
grant execute on function public.book_slot(text, timestamptz, text, text, text) to anon, authenticated;
