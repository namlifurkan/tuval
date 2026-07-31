#!/usr/bin/env node
// Runs the access tests against the real database without changing it.
//
//   node scripts/rls-test.mjs [supabase/migrations/xxxx.sql ...]
//
// Any migrations named are applied first, inside the same transaction as the tests, and the
// whole thing is rolled back. So a migration can be proven before it is pushed rather than
// after, which for an access change is the only order that makes sense.

import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'

const pending = process.argv.slice(2)
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
