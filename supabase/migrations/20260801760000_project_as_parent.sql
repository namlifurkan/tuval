-- Somewhere for a thing to belong -----------------------------------------------------------------
-- People run several pieces of work at once, and a flat list stops working somewhere around
-- twenty things. What was missing was not a new kind of container — a project already exists and
-- issues already point at one — but the other two halves pointing at it as well.
--
-- Optional on purpose. The quick note, the scratch board and the one-off are the reason a tool
-- that insists everything lives inside something becomes a tool people work around. Nothing
-- moves; what has no project keeps having none, and that is a place to be rather than a mistake.

alter table public.boards add column if not exists project_id uuid
  references public.records on delete set null;

create index if not exists boards_project_idx on public.boards (project_id);

-- Records already carry project_id for issues; the index is what was missing for the other kinds.
create index if not exists records_project_idx on public.records (project_id)
  where project_id is not null;

-- A project cannot be its own parent, and a board's project has to be a project rather than any
-- record that happens to have an id.
create or replace function public.check_project()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.project_id is null then
    return new;
  end if;
  -- Compared as text because one table keys on a uuid and the other on a room name, and the same
  -- guard has to compile for both.
  if new.project_id::text = new.id::text then
    raise exception 'a project cannot be inside itself';
  end if;
  if not exists (
    select 1 from public.records r where r.id = new.project_id and r.kind = 'project'
  ) then
    raise exception 'that is not a project';
  end if;
  return new;
end;
$$;

drop trigger if exists boards_project on public.boards;
create trigger boards_project before insert or update of project_id on public.boards
  for each row execute function public.check_project();

drop trigger if exists records_project on public.records;
create trigger records_project before insert or update of project_id on public.records
  for each row execute function public.check_project();
