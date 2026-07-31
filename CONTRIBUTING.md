# Contributing

## Language

**Commit messages, code, comments, issues and pull requests are written in English.**

The user-facing interface is translated, and Turkish is a first-class translation in
`src/i18n.ts`, but the repository itself has one language. Git history is the part of a project
a newcomer reads before anything else; it should not be the part they cannot read.

Every user-visible string goes through `t('...')` with English as the source. A missing
translation falls back to the source text, so an untranslated string is never a blank screen.
To add a language, copy the `tr` catalogue and register it in `CATALOG` and `LANGS`.

## Code

- **No explanatory comments.** Only `// TODO:`. If a piece of code needs a paragraph to
  explain it, make the code clearer instead. Comments that survive are the ones that record a
  decision or a trap, not the ones that restate the line below.
- Follow the patterns already in the file: naming, layout, import order.
- No new dependency for something a few lines of the standard library already do.
- Never cut corners on input validation, on error handling that prevents data loss, on
  security, or on accessibility.

## Database

Migrations in `supabase/migrations/` are append-only. Never edit a file that has been applied;
add a new one, and write it so it can run twice, because self-hosters apply them by hand.

## Dependencies

After adding or removing one, regenerate the lockfile with the npm the build image runs, not
whatever is on your machine:

```bash
rm -rf node_modules package-lock.json
npx npm@10 install --package-lock-only
npx npm@10 ci --dry-run
```

A lockfile written by a newer npm is rejected by an older one, and the failure only shows up
in CI.

## Deploys

The build writes the commit it came from to `dist/version.json`. A build that fails silently
looks exactly like one that worked, so when in doubt, ask the site what it is running:

```bash
curl -s https://tuval.dev/version.json
```

## Access

Anything that changes who can read or write something is proven before it is applied, not
after. The suite creates two users, puts them through every combination the policies are meant
to allow and refuse, and rolls back:

```bash
node scripts/rls-test.mjs                                   # against the schema as applied
node scripts/rls-test.mjs supabase/migrations/xxxx.sql      # with a migration not yet pushed
```

The second form runs the migration inside the same transaction as the tests, so a change can be
proven before `db push` touches anything. A mistake here does not look like a bug: it looks like
everything working, while somebody reads data that is not theirs.

## Before every push

CI does not run on its own while the repository is private, because Actions minutes are billed
there. These four are the gate, and they have to pass before anything is pushed:

```bash
npx tsc -b --noEmit
npm run lint
npm test
npm run build
```

`npx tsc --noEmit` without `-b` checks nothing here: the root `tsconfig.json` is a solution
file with `"files": []`, so the bare command exits clean while hiding every error.
