-- A project restricts what is inside it, and hours do not go round the back --------------------
-- Two holes with one shape: something is restricted, and a second path reads it anyway.
--
-- The first is the gate. `record_gate` walked `parent_id` and stopped there, but an issue does
-- not sit under its project in the tree — it points at it with `project_id`. So naming people on
-- a project shut nobody out of its issues. Nothing in the app offers that today, which is why
-- this is a hole rather than a leak; a workspace calendar that puts every dated record on one
-- month is exactly the screen that would turn it into one.
--
-- The second is time. Writing an entry already asks `can_write_record`, but reading them asked
-- only whether you were in the workspace. Everybody seeing where the hours went is the point of
-- keeping them, and it stays true — for the records you can read. On a restricted one, the title
-- is hidden while "three hours, Tuesday, on it" was not.
--
-- Runs twice without complaint, like every migration here.

-- The walk now goes up the tree and then across to the project, and up that project's tree, for
-- as far as either leads. Eight hops is not a limit anybody reaches: it is what keeps a pair of
-- projects pointing at each other from being a loop rather than an answer.
create or replace function public.record_gate(rec uuid)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  here uuid := rec;
  gate uuid;
  hops int := 0;
begin
  while here is not null and hops < 8 loop
    with recursive up as (
      select r.id, r.parent_id, 0 as depth from public.records r where r.id = here
      union all
      select r.id, r.parent_id, up.depth + 1
      from public.records r join up on r.id = up.parent_id
      where up.depth < 24
    )
    select up.id into gate from up
    where exists (select 1 from public.record_members m where m.record_id = up.id)
    order by up.depth
    limit 1;

    if gate is not null then
      return gate;
    end if;

    select r.project_id into here from public.records r where r.id = here;
    hops := hops + 1;
  end loop;

  return null;
end;
$$;

revoke all on function public.record_gate(uuid) from public;
grant execute on function public.record_gate(uuid) to authenticated;

drop policy if exists time_read on public.time_entries;

create policy time_read on public.time_entries for select to authenticated
  using (
    (select public.in_workspace(workspace_id))
    and (select public.can_read_record(record_id))
  );
