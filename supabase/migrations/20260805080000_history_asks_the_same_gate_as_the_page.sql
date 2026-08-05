-- A page with people named on it is shut to everybody else. Its history was not. `record_revisions`
-- was readable by anybody in the workspace, and the `was` column carries the old title, the old
-- description and the old `data` of the row it belongs to — which is to say the contents of the
-- restricted page, one edit at a time, to a reader who cannot open the page itself.
--
-- What makes it worse rather than merely old is agent writing. Every write through the API leaves
-- a row here, so the more of the workspace an agent touches, the more of a shut page leaks out of
-- it. The trail that exists to make agent work reviewable was quietly making it readable.
--
-- So history asks the gate the page asks. `can_read_record()` walks up to the nearest page with
-- members on it and answers for that one, the same call `records` itself is filtered by, which
-- means a page that opens or closes takes its history with it and there is no second rule to keep
-- in step.
--
-- One edge stays open on purpose: a revision whose record is gone answers true, because
-- `can_read_record()` treats a missing row as nothing to refuse. Records are archived rather than
-- deleted here, so that is a row somebody removed from the database by hand.
--
-- `agent_runs()` is security definer and still counts every revision in the workspace, so a run's
-- record and write totals can be larger than the touches the screen lists under it. Counts rather
-- than content, and the alternative is a gate walk per revision on a summary read.

drop policy if exists record_revisions_read on public.record_revisions;
create policy record_revisions_read on public.record_revisions for select to authenticated
  using (
    (select public.in_workspace(workspace_id))
    and (select public.can_read_record(record_id))
  );
