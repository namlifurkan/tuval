-- The domain is the one you sign in with -------------------------------------------------------
-- The guard read the workspace's owner, which is unusable for the workspaces people actually
-- have: a workspace begun from a personal address is owned by that address forever, so its
-- company's domain could never be named — the screen offered a switch that only ever answered
-- with an error.
--
-- It reads whoever is setting it instead, which is what the board-level rule did before this
-- moved up. That person must already be the owner or an admin, because the row-level policy on
-- workspaces says so, and an admin can invite whoever they like one address at a time in any
-- case. Nothing here is loosened for a stranger: the address still has to be confirmed, and a
-- mailbox provider still cannot stand for a company.
create or replace function public.workspaces_guard_domain()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg  public.tuval_settings;
  held text;
begin
  if new.allowed_domain is null then
    return new;
  end if;
  new.allowed_domain := lower(new.allowed_domain);
  select * into cfg from public.tuval_settings where id = 1;

  select public.email_domain(u.email) into held
  from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;

  if cfg.restrict_to_own_domain and coalesce(held, '') <> new.allowed_domain then
    raise exception 'a workspace can only be opened to the domain you sign in with';
  end if;

  if new.allowed_domain = any (cfg.blocked_domains) then
    raise exception 'that domain is shared by too many people to stand for a company';
  end if;
  return new;
end;
$$;

revoke all on function public.workspaces_guard_domain() from public, anon, authenticated;
