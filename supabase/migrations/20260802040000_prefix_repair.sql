-- A prefix the check would refuse, repaired instead of aborting the file ------------------------
-- 20260801500000 gave every workspace an issue prefix and then asked the table to promise the
-- shape of it. Half of that has already been fixed: the UPDATE there fell through to '' on a slug
-- and a name with no ASCII letters in them, and now falls back to 'ISS' the same way the trigger
-- does. What was left is the shape the UPDATE never looks at.
--
-- That UPDATE only touches `prefix is null or prefix = ''`. Any other value the check refuses —
-- lower case, six letters, a digit, whatever a self-hoster typed into psql or an older build
-- wrote before the constraint existed — is walked straight past, and then
-- `add constraint ... check` scans the table and aborts the whole file. Nothing in the schema
-- repairs that shape, so the install can never move forward: the failing statement is in a file
-- that has already been applied everywhere else and cannot be edited.
--
-- So: repair first, then ask for the promise. In that order the constraint has nothing left to
-- refuse and this file cannot be the one that stops an upgrade.

update public.workspaces
set prefix = coalesce(nullif(upper(substring(
  regexp_replace(coalesce(nullif(slug, ''), name, ''), '[^a-zA-Z]', '', 'g') from 1 for 3)), ''), 'ISS')
where prefix is null or prefix !~ '^[A-Z]{1,5}$';

alter table public.workspaces drop constraint if exists workspaces_prefix_check;
alter table public.workspaces add constraint workspaces_prefix_check
  check (prefix is null or prefix ~ '^[A-Z]{1,5}$');

-- And the same guard on the way in, on both kinds of write ---------------------------------------
-- The trigger only fired before insert, which made the promise true exactly once per row. Clearing
-- the prefix afterwards — a rename that recomputes it, an import, a script — was refused by the
-- constraint with a raw Postgres error rather than being filled in. A blank prefix has an obvious
-- correct value; refusing the whole write over it helps nobody.
--
-- Only blank is repaired. A prefix somebody typed wrong is still refused, loudly, because
-- quietly rewriting what an admin asked for is how a workspace ends up with a key nobody chose.

drop trigger if exists workspaces_prefixed on public.workspaces;
create trigger workspaces_prefixed before insert or update on public.workspaces
  for each row execute function public.workspaces_prefix();
