create or replace function public.guard_workspace_plan()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'service_role') then
    new.plan := old.plan;
    new.plan_until := old.plan_until;
    new.customer_ref := old.customer_ref;
  end if;
  return new;
end;
$$;

drop trigger if exists workspace_plan_guard on public.workspaces;
create trigger workspace_plan_guard
before update on public.workspaces
for each row execute function public.guard_workspace_plan();
