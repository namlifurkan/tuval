-- Pinned to the top of your own sidebar ----------------------------------------------------------
-- A row per person per page rather than a flag on the page: what somebody keeps at hand is theirs,
-- and two people in the same workspace want different things there.

create table if not exists public.record_favourites (
  user_id   uuid not null references auth.users on delete cascade,
  record_id uuid not null references public.records on delete cascade,
  position  double precision not null default 0,
  primary key (user_id, record_id)
);

create index if not exists record_favourites_user_idx
  on public.record_favourites (user_id, position);

alter table public.record_favourites enable row level security;

drop policy if exists favourites_own on public.record_favourites;

-- Yours alone, read and written. Nothing here is worth showing anybody else.
create policy favourites_own on public.record_favourites for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
