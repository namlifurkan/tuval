-- Integrations speak for the workspace, so only its owner may create or inspect them. Older
-- rows do not record a webhook creator, and older keys may not record one, so fail closed: keep
-- them for an audit trail, but require the owner to deliberately replace or re-enable them.

update public.api_keys k
set revoked_at = coalesce(k.revoked_at, now())
where not exists (
  select 1 from public.workspaces w
  where w.id = k.workspace_id and w.owner = k.created_by
);

update public.webhooks set active = false where active;

drop policy if exists api_keys_read  on public.api_keys;
drop policy if exists api_keys_write on public.api_keys;
drop policy if exists webhooks_read  on public.webhooks;
drop policy if exists webhooks_write on public.webhooks;

create policy api_keys_read on public.api_keys for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy api_keys_write on public.api_keys for all to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check (
    (select public.owns_workspace(workspace_id))
    and created_by = (select auth.uid())
  );

create policy webhooks_read on public.webhooks for select to authenticated
  using ((select public.owns_workspace(workspace_id)));

create policy webhooks_write on public.webhooks for all to authenticated
  using ((select public.owns_workspace(workspace_id)))
  with check ((select public.owns_workspace(workspace_id)));

create or replace function public.refresh_webhooks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.webhooks w
  set last_status = r.status_code
  from net._http_response r
  where r.id = w.last_request_id
    and w.last_status is distinct from r.status_code
    and public.owns_workspace(w.workspace_id);
end;
$$;

revoke all on function public.refresh_webhooks() from public, anon;
grant execute on function public.refresh_webhooks() to authenticated;

-- PostgreSQL grants EXECUTE on a new function to PUBLIC unless told otherwise. Supabase also has
-- explicit grants for its API roles, so removing the blanket grant preserves each intentional
-- anon/authenticated grant while closing access for every other database role.
do $$
declare
  fn record;
begin
  for fn in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
  loop
    execute format('revoke all on function %s from public', fn.signature);
  end loop;
end;
$$;
