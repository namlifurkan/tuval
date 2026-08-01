-- Numbers for the issues that existed before there were numbers -----------------------------------
-- The trigger takes a number on insert, which does nothing for rows already there. They are
-- numbered by age, so the oldest issue is number one and the order matches the order they were
-- actually written in.
--
-- Only rows without a number are touched, so running this twice does nothing the second time.

with base as (
  select workspace_id, coalesce(max(seq), 0) as top
  from public.records
  where kind = 'issue'
  group by workspace_id
),
numbered as (
  select
    r.id,
    b.top + row_number() over (partition by r.workspace_id order by r.created_at, r.id) as n
  from public.records r
  join base b on b.workspace_id = r.workspace_id
  where r.kind = 'issue' and r.seq is null
)
update public.records r
set seq = numbered.n
from numbered
where numbered.id = r.id;
