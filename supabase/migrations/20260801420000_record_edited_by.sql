-- Who touched it last ----------------------------------------------------------------------------
-- When it was last edited has been kept since the beginning; who did it has not, and a table
-- wanting a "Last edited by" column cannot work that out from anything already stored.
--
-- Written by the same trigger that stamps the time, so the two can never disagree and no caller
-- has to remember to send it.

alter table public.records add column if not exists updated_by uuid references auth.users on delete set null;

create or replace function public.records_touch()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  -- A row changed by a trigger rather than by a person leaves this alone rather than blanking it.
  new.updated_by := coalesce((select auth.uid()), old.updated_by, new.created_by);
  return new;
end;
$$;

drop trigger if exists records_touched on public.records;
create trigger records_touched before update on public.records
  for each row execute function public.records_touch();
