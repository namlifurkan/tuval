-- updated_at had a default and nothing that maintained it, so every row claimed to have been
-- last touched when it was created. A list ordered by it was ordered by nothing.
--
-- In the trigger rather than in the client: a page is edited from the list, from the detail
-- panel, from the board card and from the editor, and each of those would have to remember.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists records_touch on public.records;
create trigger records_touch
  before update on public.records
  for each row execute function public.touch_updated_at();
