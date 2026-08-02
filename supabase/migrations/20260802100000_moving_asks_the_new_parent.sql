-- Moving a page asks the place it is moving to ---------------------------------------------------
-- A page with people named on it restricts everything under it, and the nearest named ancestor is
-- what decides. So changing parent_id changes who may read a whole subtree — and the only thing
-- ever asked was whether the caller could write the row being moved.
--
-- Two directions, both wrong. A page can be pushed under a restricted ancestor by somebody who is
-- not on it, which hands that subtree to the people who are. And a restricted page can be pulled
-- out from under its gate by anybody who can write it, which hands it to the whole workspace.
--
-- The row policy asks about the destination as well. Because with check sees the row as it will
-- be, one clause covers both directions: the parent it is landing on has to be one the caller
-- could write to.

drop policy if exists records_update on public.records;

create policy records_update on public.records for update to authenticated
  using ((select public.can_write_record(id)))
  with check (
    (select public.can_write_record(id))
    and (select public.can_write_record(parent_id))
  );
