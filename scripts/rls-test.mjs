#!/usr/bin/env node
// Runs the access tests against the real database without changing it.
//
//   node scripts/rls-test.mjs [supabase/migrations/xxxx.sql ...]
//
// Any migrations named are applied first, inside the same transaction as the tests, and the
// whole thing is rolled back. So a migration can be proven before it is pushed rather than
// after, which for an access change is the only order that makes sense.
//
// Name none and it works out which ones the database has not seen. Remembering to list them by
// hand is the failure this exists to prevent: a forgotten file leaves the run green against a
// schema that is not the one being shipped.

import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'

const MIGRATIONS = 'supabase/migrations'

const ask = (sql) => {
  const file = `.rls-ask-${process.pid}.sql`
  writeFileSync(file, sql)
  try {
    return execFileSync(
      'npx', ['-y', 'supabase@latest', 'db', 'query', '--linked', '-f', file],
      { encoding: 'utf8', maxBuffer: 1 << 24 },
    )
  } finally {
    unlinkSync(file)
  }
}

function unapplied() {
  const here = readdirSync(MIGRATIONS).filter((name) => name.endsWith('.sql')).sort()
  const said = ask('select version from supabase_migrations.schema_migrations;')
  const applied = new Set(said.match(/\d{14}/g) ?? [])
  const missing = here.filter((name) => !applied.has(name.slice(0, 14)))
  if (missing.length) {
    console.error(`Applying ${missing.length} migration(s) the database has not seen:`)
    for (const name of missing) console.error(`  ${name}`)
  }
  return missing.map((name) => join(MIGRATIONS, name))
}

const pending = process.argv.length > 2 ? process.argv.slice(2) : unapplied()
const parts = [
  'begin;',
  ...pending.map((f) => readFileSync(f, 'utf8')),
  readFileSync('supabase/tests/rls.sql', 'utf8'),
  'rollback;',
]

const tmp = `.rls-run-${process.pid}.sql`
writeFileSync(tmp, parts.join('\n\n'))

let out
try {
  out = execFileSync(
    'npx', ['-y', 'supabase@latest', 'db', 'query', '--linked', '-f', tmp],
    { encoding: 'utf8', maxBuffer: 1 << 24 },
  )
} catch (e) {
  // A failure here is a broken query, not a failed check, and the message is the useful part.
  const said = `${e.stdout ?? ''}${e.stderr ?? ''}`
  const detail = /ERROR:[^"\\]*/.exec(said)
  console.error(detail ? detail[0] : said || String(e))
  unlinkSync(tmp)
  process.exit(2)
}

try {

  const blocks = [...out.matchAll(/\{[\s\S]*?\n\}/g)].map((m) => {
    try { return JSON.parse(m[0]) } catch { return null }
  }).filter(Boolean)

  const rows = blocks.flatMap((b) => b.rows ?? [])
  const tally = rows.find((r) => 'failed' in r)
  const broken = rows.filter((r) => 'expected' in r)

  if (!tally) {
    console.error('No result from the suite. Raw output:\n' + out)
    process.exit(1)
  }

  for (const row of broken) {
    console.error(`  ✗ ${row.name}: expected ${row.expected}, got ${row.actual}`)
  }

  const failed = Number(tally.failed)
  console.log(`${tally.checks - failed}/${tally.checks} access checks pass`)
  process.exit(failed ? 1 : 0)
} finally {
  try { unlinkSync(tmp) } catch { /* already gone */ }
}
