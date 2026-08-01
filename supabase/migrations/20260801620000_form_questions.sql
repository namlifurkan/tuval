-- The questions, without the answers ---------------------------------------------------------------
-- A form draws itself from the database's own columns, so that the two can never drift apart.
-- But somebody filling one in has no account and cannot read that row — and should not, because
-- the row is where every previous answer lives.
--
-- So this hands over exactly the shape of the questions and nothing else, and only for a form
-- that is live.

create or replace function public.form_questions(form_slug text)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(r.data -> 'fields', '[]'::jsonb)
  from public.forms f
  join public.records r on r.id = f.database_id
  where f.slug = form_slug and f.active;
$$;

revoke all on function public.form_questions(text) from public;
grant execute on function public.form_questions(text) to anon, authenticated;
