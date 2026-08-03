-- The rule reaches the people already here ------------------------------------------------------
-- Turning the domain on and seeing nobody is not a workspace working quietly, it is a workspace
-- that looks broken. Joining was written as something the arriving person does on their next
-- visit, which answers for an account that does not exist yet and answers badly for the
-- colleague who signed up last week and has no reason to open the app today.
--
-- So the rule is applied when it is set, to everybody at that address who already has a
-- confirmed account, and claim_invites keeps answering for whoever arrives after. Turning it off
-- takes back what it gave: the rows it wrote go, and a 'blocked' row stays, because a removal is
-- a decision and must survive the switch being flipped twice.

create or replace function public.apply_domain_rule(ws uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rule public.workspaces;
begin
  select * into rule from public.workspaces w where w.id = ws;
  if rule.id is null then return; end if;

  if rule.allowed_domain is null then
    delete from public.workspace_members m
    where m.workspace_id = ws and m.via_domain and m.role <> 'blocked';
    return;
  end if;

  -- Somebody the rule brought in follows the rule. An admin who has given one of them a role by
  -- hand is not overruled: that row stops being the rule's the moment it is set deliberately.
  update public.workspace_members m
     set role = rule.domain_role
   where m.workspace_id = ws and m.via_domain
     and m.role not in ('blocked', rule.domain_role);

  insert into public.workspace_members (workspace_id, user_id, role, email, via_domain)
  select ws, u.id, rule.domain_role, u.email, true
  from auth.users u
  where u.email_confirmed_at is not null
    and public.email_domain(u.email) = rule.allowed_domain
    and u.id <> rule.owner
    and not exists (
      select 1 from public.workspace_members m
      where m.workspace_id = ws and m.user_id = u.id
    )
  on conflict (workspace_id, user_id) do nothing;
end;
$$;

revoke all on function public.apply_domain_rule(uuid) from public, anon, authenticated;

create or replace function public.workspaces_domain_members()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.apply_domain_rule(new.id);
  return null;
end;
$$;

revoke all on function public.workspaces_domain_members() from public, anon, authenticated;

drop trigger if exists workspaces_domain_members on public.workspaces;
create trigger workspaces_domain_members
after insert or update of allowed_domain, domain_role on public.workspaces
for each row execute function public.workspaces_domain_members();

-- The workspaces that turned it on before this existed are waiting on exactly this.
select public.apply_domain_rule(id) from public.workspaces where allowed_domain is not null;
