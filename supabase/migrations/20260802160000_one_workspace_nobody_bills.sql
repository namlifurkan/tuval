-- One workspace, decided by hand -------------------------------------------------------------------
-- Three ways to stop billing somebody existed and none of them was "this one". A domain carries
-- everybody who has an address at it, self-hosting carries the whole install, and the paid plan
-- has a seat count. An operator who wants to carry one team had to widen a domain rule to do it,
-- which is the opposite of what they asked for.
--
-- So 'unlimited' becomes something the row can hold, not only something plan_of() works out. It
-- expires the same way a paid plan does, so a decision can be made for a quarter rather than for
-- ever, and it reads through exactly the same limits.
--
--   update public.workspaces set plan = 'unlimited', plan_until = null where slug = 'their-slug';

alter table public.workspaces drop constraint if exists workspaces_plan_check;
alter table public.workspaces add constraint workspaces_plan_check
  check (plan in ('free', 'team', 'unlimited'));

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
    when w.plan in ('team', 'unlimited')
     and (w.plan_until is null or w.plan_until > now()) then w.plan
    else 'free'
  end
  from public.workspaces w where w.id = ws;
$$;
