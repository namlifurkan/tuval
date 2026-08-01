-- A page of somebody's own -------------------------------------------------------------------
-- People who build with agents already have an audience; what they do not have is a good place
-- to put the thing itself. The screenshot of a board and the prompt underneath it are two halves
-- pasted together by the reader. Here the board is the prompt, so a published one can hand over
-- the exact brief its author gave their agent.
--
-- What this is not: a feed. No follows, no likes, no discovery. The audience stays where it is
-- and this is what gets linked to. A feed would mean owning moderation forever and competing for
-- attention with the place the readers already are.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users on delete cascade,
  handle     text not null,
  name       text not null default '',
  bio        text not null default '',
  avatar     text not null default '',
  links      jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.profiles drop constraint if exists profiles_handle_check;
alter table public.profiles add constraint profiles_handle_check
  check (handle ~ '^[a-z0-9][a-z0-9_-]{1,29}$');

-- Compared without case, because two people cannot both be at the same address and a reader
-- typing the wrong case is not a different person.
create unique index if not exists profiles_handle_idx on public.profiles (lower(handle));

-- Names the product itself answers to. Taking one would leave somebody's page unreachable.
create or replace function public.handle_taken(name text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select lower(name) in (
    'about', 'admin', 'api', 'app', 'blog', 'board', 'boards', 'docs', 'help', 'home',
    'login', 'logout', 'new', 'null', 'privacy', 'register', 'root', 'settings', 'signin',
    'signup', 'support', 'terms', 'tuval', 'undefined', 'user', 'users', 'www'
  );
$$;

-- Where a link may point ------------------------------------------------------------------------
-- An allow-list rather than a warning. A profile that accepts any address is a place to host the
-- link in a scam, and the person taken in would have arrived through our domain. Personal sites
-- are the obvious thing missing and are deliberately missing: one free-form host and the list
-- stops being a list.
create or replace function public.allowed_link(url text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  with host as (select lower(substring(url from '^https://([^/?#]+)')) as h)
  select exists (
    select 1 from host, unnest(array[
      'buymeacoffee.com', 'ko-fi.com', 'patreon.com', 'liberapay.com', 'opencollective.com',
      'gumroad.com', 'github.com', 'github.io', 'gitlab.com', 'substack.com',
      'x.com', 'twitter.com', 'youtube.com', 'twitch.tv', 'linkedin.com',
      'bsky.app', 'mastodon.social', 'discord.gg'
    ]) as allowed
    where host.h = allowed or host.h like '%.' || allowed
  );
$$;

create or replace function public.check_links()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  one jsonb;
begin
  if jsonb_typeof(new.links) <> 'array' then
    raise exception 'links must be a list';
  end if;
  if jsonb_array_length(new.links) > 8 then
    raise exception 'that is more links than a page can carry';
  end if;

  for one in select * from jsonb_array_elements(new.links) loop
    if not public.allowed_link(one ->> 'url') then
      raise exception 'that address is not one this can link to'
        using hint = 'Donation, code and social links only, over https.';
    end if;
  end loop;
  return new;
end;
$$;

drop trigger if exists profiles_links on public.profiles;
create trigger profiles_links before insert or update on public.profiles
  for each row execute function public.check_links();

alter table public.profiles enable row level security;

drop policy if exists profiles_public on public.profiles;
drop policy if exists profiles_read   on public.profiles;
drop policy if exists profiles_write  on public.profiles;

-- Readable by anybody: that is the entire point of it.
create policy profiles_public on public.profiles for select to anon using (true);
create policy profiles_read   on public.profiles for select to authenticated using (true);

create policy profiles_write on public.profiles for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and not public.handle_taken(handle));

-- A board anybody may read ----------------------------------------------------------------------
-- Added as its own policy rather than folded into can_read_board. That function decides who may
-- read a board they have an account for, and reaching into it to also mean "or nobody in
-- particular" is how a sharing rule quietly becomes a leak.

alter table public.boards add column if not exists public_at timestamptz;

create or replace function public.board_is_public(board text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.boards b
    where b.id = board and b.public_at is not null and b.deleted_at is null
  );
$$;

drop policy if exists boards_public    on public.boards;
drop policy if exists snapshots_public on public.board_snapshots;

create policy boards_public on public.boards for select to anon
  using (public_at is not null and deleted_at is null);

create policy snapshots_public on public.board_snapshots for select to anon
  using ((select public.board_is_public(board_id)));

-- The pictures on it, which are in a private bucket keyed by the board id.
drop policy if exists board_images_public on storage.objects;
create policy board_images_public on storage.objects for select to anon
  using (
    bucket_id = 'board-images'
    and (select public.board_is_public(split_part(name, '/', 1)))
  );

grant execute on function public.board_is_public(text) to anon, authenticated;
grant execute on function public.handle_taken(text)    to anon, authenticated;
grant execute on function public.allowed_link(text)    to anon, authenticated;
