-- An install nobody is billing for ----------------------------------------------------------------
-- The plan limits exist for one reason: somebody else is paying for the disks, the bandwidth and
-- the answering. On an install you run yourself there is no somebody else, so there is nothing
-- for a limit to protect.
--
-- The site has been saying "run it yourself and every limit here is yours to set" while the API
-- was switched off for exactly those people: plan_of() answers 'free' for a workspace nobody
-- upgraded, and the API door checks for 'team'. Saying it and not doing it is the worse half.
--
-- So the install says which it is, once, in the settings row it already has.

alter table public.tuval_settings
  add column if not exists self_hosted boolean not null default false;

comment on column public.tuval_settings.self_hosted is
  'Set true on an install you run yourself: seats, storage and the API stop being limited.';

create or replace function public.is_self_hosted()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select s.self_hosted from public.tuval_settings s where s.id = 1), false);
$$;

-- Read by the API door, the seat trigger, the storage trigger and the screen that shows usage,
-- so one answer changes all four rather than four places agreeing by luck.
create or replace function public.plan_of(ws uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when public.is_self_hosted() then 'team'
    when w.plan = 'team' and (w.plan_until is null or w.plan_until > now()) then 'team'
    else 'free'
  end
  from public.workspaces w where w.id = ws;
$$;

-- On a self-hosted install the numbers a plan would cap are not caps at all.
create or replace function public.plan_limits(plan text, seats_used int)
returns table (seats int, bytes bigint, api boolean)
language sql
stable
set search_path = ''
as $$
  select
    case when public.is_self_hosted() then 2147483647
         when plan = 'team' then 200 else 3 end,
    case when public.is_self_hosted() then 9223372036854775807::bigint
         when plan = 'team' then greatest(seats_used, 1)::bigint * 10 * 1024 * 1024 * 1024
         else 1024 * 1024 * 1024 end,
    public.is_self_hosted() or plan = 'team';
$$;

grant execute on function public.is_self_hosted() to anon, authenticated;
