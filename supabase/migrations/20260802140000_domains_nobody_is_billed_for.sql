-- Domains this install does not bill ---------------------------------------------------------------
-- The plan limits exist because somebody is paying for the disks, the bandwidth and the answering.
-- An install has people it is not billing for: the company running it, and whoever else it has
-- decided to carry. That is an operator's decision, not a product one, so it lives beside the
-- other instance policy rather than in anybody's code.
--
-- Which addresses those are is left empty here on purpose. This file ships to everyone who runs
-- Tuval, and one install's arrangement is not another's.
--
--   update public.tuval_settings
--   set unlimited_domains = array['example.com', 'example.org'] where id = 1;

alter table public.tuval_settings
  add column if not exists unlimited_domains text[] not null default '{}';

comment on column public.tuval_settings.unlimited_domains is
  'Email domains this install does not bill. A workspace whose owner has a confirmed address at '
  'one of them has no seat, storage or API limit. Set by the operator; empty by default.';

-- Read of the owner rather than of whoever is asking. A workspace follows the person who holds
-- it: being invited into somebody else's does not carry your arrangement into their workspace,
-- and does not take it away from your own.
--
-- The address has to be confirmed. An unconfirmed one is a claim, and this is not a claim anybody
-- should be able to make about themselves by typing it.
create or replace function public.unlimited_owner(ws uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.workspaces w
    join auth.users u on u.id = w.owner
    join public.tuval_settings s on s.id = 1
    where w.id = ws
      and u.email_confirmed_at is not null
      and cardinality(s.unlimited_domains) > 0
      and public.email_domain(u.email) <> ''
      and public.email_domain(u.email) = any (
        select lower(one) from unnest(s.unlimited_domains) as one
      )
  );
$$;

create or replace function public.plan_of(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_self_hosted() then 'unlimited'
    when public.unlimited_owner(ws) then 'unlimited'
    when w.plan = 'team' and (w.plan_until is null or w.plan_until > now()) then 'team'
    else 'free'
  end
  from public.workspaces w where w.id = ws;
$$;

-- A self-hosted install used to answer 'team' and then have every number lifted underneath it,
-- which meant the screen said one thing and the triggers did another. It is the same case as this
-- one and now says so.
create or replace function public.plan_limits(plan text, seats_used int)
returns table (seats int, bytes bigint, api boolean)
language sql
immutable
set search_path = ''
as $$
  select
    case when plan = 'unlimited' then 2147483647
         when plan = 'team' then 200 else 3 end,
    case when plan = 'unlimited' then 9223372036854775807::bigint
         when plan = 'team' then greatest(seats_used, 1)::bigint * 10 * 1024 * 1024 * 1024
         else 1024 * 1024 * 1024 end,
    plan in ('team', 'unlimited');
$$;

-- The door for robots asked for 'team' by name, so a workspace nobody bills would have been
-- refused the one thing it is least sensible to refuse it.
create or replace function public.workspace_for_key(token text, writing boolean default false)
returns table (workspace_id uuid, acting uuid, agent text, scope text, writes_left int)
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.api_keys;
  seat  text;
  may   text;
  spent int;
begin
  select * into found from public.api_keys k
  where k.token_sha = encode(extensions.digest(token, 'sha256'), 'hex')
    and k.revoked_at is null
    and (k.expires_at is null or k.expires_at > now());

  if found.id is null or found.created_by is null then
    return;
  end if;

  if public.plan_of(found.workspace_id) = 'free' then
    return;
  end if;

  seat := public.workspace_seat(found.created_by, found.workspace_id);
  if seat is null or seat = 'blocked' then
    return;
  end if;

  may := case
    when found.scope = 'write' and seat in ('owner', 'admin', 'member') then 'write'
    else 'read'
  end;

  spent := case when found.writes_on = current_date then found.writes_today else 0 end;

  -- A day's allowance is a hosted cost too, so an install that is not billing this workspace is
  -- not counting its writes either.
  if public.plan_of(found.workspace_id) = 'unlimited' then
    writes_left := 2147483647;
  elsif writing and may = 'write' then
    if spent >= found.daily_writes then
      writes_left := -1;
    else
      spent := spent + 1;
    end if;
  end if;

  update public.api_keys
     set last_used_at = now(), writes_on = current_date, writes_today = spent
   where id = found.id;

  workspace_id := found.workspace_id;
  acting       := found.created_by;
  agent        := found.name;
  scope        := may;
  writes_left  := coalesce(writes_left, found.daily_writes - spent);
  return next;
end;
$$;

revoke all on function public.unlimited_owner(uuid) from public, anon;
grant execute on function public.unlimited_owner(uuid) to authenticated;

revoke all on function public.workspace_for_key(text, boolean) from public, authenticated, anon;
grant execute on function public.workspace_for_key(text, boolean) to service_role;
