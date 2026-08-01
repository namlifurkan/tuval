-- Public pages must be addressed, not enumerable -------------------------------------------------

drop policy if exists forms_public on public.forms;

create or replace function public.validate_form_database()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  database_workspace uuid;
  database_kind text;
begin
  select r.workspace_id, r.kind
    into database_workspace, database_kind
  from public.records r
  where r.id = new.database_id;

  if database_workspace is null
     or database_workspace <> new.workspace_id
     or database_kind <> 'database' then
    raise exception 'form database must be a database in the same workspace';
  end if;

  return new;
end;
$$;

drop trigger if exists forms_validate_database on public.forms;
create trigger forms_validate_database
before insert or update of workspace_id, database_id on public.forms
for each row execute function public.validate_form_database();

revoke all on function public.validate_form_database() from public, anon, authenticated;

create or replace function public.public_form(form_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'form', jsonb_build_object(
      'id', f.id,
      'database_id', f.database_id,
      'slug', f.slug,
      'title', f.title,
      'intro', f.intro,
      'asks', f.asks,
      'thanks', f.thanks,
      'active', f.active
    ),
    'fields', coalesce(r.data -> 'fields', '[]'::jsonb)
  )
  from public.forms f
  join public.records r
    on r.id = f.database_id
   and r.workspace_id = f.workspace_id
   and r.kind = 'database'
  where f.slug = form_slug and f.active;
$$;

revoke all on function public.public_form(text) from public;
grant execute on function public.public_form(text) to anon, authenticated;

-- The combined endpoint above supersedes the columns-only endpoint.
revoke all on function public.form_questions(text) from anon, authenticated;

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

  if coalesce(trap, '') <> '' then
    return gen_random_uuid();
  end if;

  select * into db
  from public.records r
  where r.id = form.database_id
    and r.workspace_id = form.workspace_id
    and r.kind = 'database';
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
        select c into choice
        from jsonb_array_elements(coalesce(field -> 'choices', '[]'::jsonb)) c
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

-- Booking links were not useful without notifications. Keep existing data for recovery, but stop
-- publishing pages and accepting bookings until the feature has a complete delivery path.
drop policy if exists booking_pages_public on public.booking_pages;
revoke all on function public.taken_slots(text) from public, anon, authenticated;
revoke all on function public.book_slot(text, timestamptz, text, text, text)
  from public, anon, authenticated;
