-- Writing one cell without rewriting the row ------------------------------------------------------
-- A row's values live in one jsonb object, and until now setting one cell meant sending the whole
-- object back. With one person that is invisible. With two it is a bug: both read the copy their
-- screen was drawn from, both send the whole object, and the second one puts back the cell the
-- first had just changed.
--
-- The merge happens here instead, where the current row is the current row. `||` replaces only the
-- keys it is given and leaves the rest alone; `-` removes the ones being cleared.
--
-- Not security definer: this is the caller writing their own row, so the ordinary update policy
-- has to apply to it exactly as it would to an update.

create or replace function public.merge_cells(record uuid, patch jsonb, drop_keys text[] default '{}')
returns void
language sql
set search_path = ''
as $$
  update public.records
  set data = (coalesce(data, '{}'::jsonb) - drop_keys) || coalesce(patch, '{}'::jsonb)
  where id = record;
$$;

revoke all on function public.merge_cells(uuid, jsonb, text[]) from public;
grant execute on function public.merge_cells(uuid, jsonb, text[]) to authenticated;
