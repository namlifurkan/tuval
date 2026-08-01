-- A form is a database with one side of it turned outwards -----------------------------------------
-- Nothing new is collected. A form asks for some of the columns a database already has, and an
-- answer becomes a row in it — visible in the table, the board and the calendar the moment it
-- arrives, because it is the same row anybody here would have typed.
--
-- The one thing that needs care is that a form is answered by people with no account. They are
-- not given permission to write records; they are given one function that writes exactly one row
-- into exactly one database, with exactly the columns the form asked for.

create table if not exists public.forms (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  database_id  uuid not null references public.records on delete cascade,
  slug         text not null unique,
  title        text not null default '',
  intro        text not null default '',
  -- Which of the database's columns to ask for, in the order to ask them.
  asks         text[] not null default '{}',
  thanks       text not null default '',
  active       boolean not null default true,
  created_at   timestamptz not null default now()
);

create index if not exists forms_database_idx on public.forms (database_id);

alter table public.forms enable row level security;

drop policy if exists forms_read   on public.forms;
drop policy if exists forms_public on public.forms;
drop policy if exists forms_write  on public.forms;

create policy forms_read on public.forms for select to authenticated
  using ((select public.in_workspace(workspace_id)));

-- Anybody may read a live form, or there would be nothing to draw for the person filling it in.
-- What they can read is the shape of the questions, never the answers.
create policy forms_public on public.forms for select to anon
  using (active);

create policy forms_write on public.forms for all to authenticated
  using ((select public.can_write_workspace(workspace_id)))
  with check ((select public.can_write_workspace(workspace_id)));

-- The one thing somebody with no account may do ------------------------------------------------
-- Values arrive as text because that is what a form field is. Each is turned into whatever the
-- column actually holds, and anything the form did not ask for is dropped rather than refused —
-- a hand-made request cannot smuggle a column in.

create or replace function public.submit_form(form_slug text, answers jsonb, trap text default '')
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  form    public.forms;
  db      public.records;
  fields  jsonb;
  field   jsonb;
  asked   text;
  raw     text;
  cells   jsonb := '{}'::jsonb;
  name    text := '';
  made    uuid;
  choice  jsonb;
begin
  select * into form from public.forms f where f.slug = form_slug and f.active;
  if form.id is null then
    return null;
  end if;

  -- The trap is a field no person can see. Something that fills it in is not a person, and is
  -- told the same thing everybody else is told rather than being told it was caught.
  if coalesce(trap, '') <> '' then
    return gen_random_uuid();
  end if;

  select * into db from public.records r where r.id = form.database_id;
  if db.id is null then
    return null;
  end if;

  fields := coalesce(db.data -> 'fields', '[]'::jsonb);

  foreach asked in array form.asks loop
    raw := nullif(trim(answers ->> asked), '');

    if asked = '__title__' then
      name := coalesce(raw, '');
      continue;
    end if;

    if raw is null then
      continue;
    end if;

    select f into field from jsonb_array_elements(fields) f where f ->> 'id' = asked;
    if field is null then
      continue;
    end if;

    case field ->> 'type'
      when 'number' then
        begin
          cells := cells || jsonb_build_object(asked, (replace(raw, ',', '.'))::numeric);
        exception when others then
          null;
        end;
      when 'checkbox' then
        cells := cells || jsonb_build_object(asked, raw in ('true', 'on', 'yes', '1'));
      when 'select' then
        -- A form may only offer choices the column already has, so an answer is matched to one
        -- rather than becoming a new one.
        select c into choice from jsonb_array_elements(coalesce(field -> 'choices', '[]'::jsonb)) c
        where c ->> 'id' = raw or lower(c ->> 'name') = lower(raw);
        if choice is not null then
          cells := cells || jsonb_build_object(asked, choice ->> 'id');
        end if;
      else
        cells := cells || jsonb_build_object(asked, left(raw, 4000));
    end case;
  end loop;

  insert into public.records (workspace_id, kind, title, parent_id, data)
  values (form.workspace_id, 'doc', left(name, 300), form.database_id, cells)
  returning id into made;

  return made;
end;
$$;

revoke all on function public.submit_form(text, jsonb, text) from public;
grant execute on function public.submit_form(text, jsonb, text) to anon, authenticated;
