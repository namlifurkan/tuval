#!/usr/bin/env node
// What a run costs to review ----------------------------------------------------------------------
// A feature without a number is an opinion. This writes a real agent run through the real door —
// the same API key, the same header, the same triggers — and then measures the two ways of
// reviewing it against the database it landed in.
//
//   node scripts/review-cost.mjs [records]      # default 40
//
// Needs TUVAL_API_KEY and VITE_SUPABASE_URL in .env.local, and the Supabase CLI linked to the
// same project (npx supabase link), because the measuring half reads tables the API does not
// expose. It cleans up after itself: everything it wrote is deleted before it exits.
//
// What it does NOT claim: nothing about tokens, model cost or wall-clock in a browser. It counts
// the queries and the rows each path needs, and times them inside one database session so the
// numbers are not measuring node starting up.

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'

const N = Math.max(1, Math.min(500, Number(process.argv[2]) || 40))

const fromFile = (name) => {
  if (!existsSync('.env.local')) return ''
  const line = readFileSync('.env.local', 'utf8')
    .split('\n').find((l) => l.trimStart().startsWith(`${name}=`))
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : ''
}
const read = (name) => process.env[name] || fromFile(name)

const KEY = read('TUVAL_API_KEY')
const BASE = read('TUVAL_API_URL')
  || `${read('VITE_SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/api`
if (!KEY) {
  console.error('Set TUVAL_API_KEY. Make one in Settings → API and webhooks.')
  process.exit(2)
}

const RUN = `cost-${Date.now().toString(36)}`

async function door(path, method, body) {
  const answer = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${KEY}`,
      'x-tuval-run': RUN,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await answer.text()
  if (!answer.ok) throw new Error(`${answer.status}: ${text.slice(0, 200)}`)
  return JSON.parse(text)
}

function ask(sql) {
  const file = `.review-cost-${process.pid}.sql`
  writeFileSync(file, sql)
  try {
    const out = execFileSync(
      'npx', ['-y', 'supabase@latest', 'db', 'query', '--linked', '-f', file],
      { encoding: 'utf8', maxBuffer: 1 << 24 },
    )
    const block = /\{[\s\S]*\n\}/.exec(out)
    return block ? JSON.parse(block[0]).rows ?? [] : []
  } finally {
    unlinkSync(file)
  }
}

console.log(`Writing a run of ${N} records through the API…`)
const made = []
for (let i = 0; i < N; i++) {
  const row = await door('/records', 'POST', {
    kind: 'issue', title: `Review cost ${RUN} #${i + 1}`, status: 'todo',
  })
  made.push(row.id)
}
// One change each, so every record has a revision with something in it to read back.
for (const id of made) await door(`/records/${id}`, 'PATCH', { status: 'doing' })

console.log('Measuring both ways of reviewing it…')

// Both paths in one session, so the numbers are the queries rather than the process starting.
// Path A is what the app does without runs: open each record and read its history, one at a time.
// Path B is what /runs does: ask which runs there are, then ask this one for everything at once.
const rows = ask(`
create temp table cost (path text, queries int, ms numeric, rows_read bigint);

do $$
declare
  ws      uuid := (select workspace_id from public.records where updated_run = '${RUN}' limit 1);
  ids     uuid[] := (select array_agg(id) from public.records where updated_run = '${RUN}');
  one     uuid;
  started timestamptz;
  seen    bigint := 0;
  n       bigint;
begin
  started := clock_timestamp();
  foreach one in array ids loop
    select count(*) into n from public.record_revisions r where r.record_id = one;
    seen := seen + n;
  end loop;
  insert into cost values ('one record at a time', array_length(ids, 1),
    extract(milliseconds from clock_timestamp() - started), seen);

  started := clock_timestamp();
  perform count(*) from public.agent_runs(ws);
  select count(*) into seen from public.record_revisions r where r.run = '${RUN}';
  insert into cost values ('the run, once', 2,
    extract(milliseconds from clock_timestamp() - started), seen);
end $$;

select * from cost order by queries desc;
`)

for (const row of rows) {
  console.log(
    `  ${String(row.path).padEnd(22)} ${String(row.queries).padStart(4)} queries`
    + `  ${Number(row.ms).toFixed(1).padStart(8)} ms  ${String(row.rows_read).padStart(5)} rows`,
  )
}

const slow = rows.find((r) => r.path === 'one record at a time')
const fast = rows.find((r) => r.path === 'the run, once')
if (slow && fast) {
  console.log(
    `\n  ${slow.queries} queries and ${slow.queries} screens become ${fast.queries} and one.`
    + ` Putting it back is ${slow.queries} actions or one.`,
  )
  console.log('  The writes underneath an undo are still one per record; the person does one.')
}

console.log('\nCleaning up…')
ask(`delete from public.records where updated_run = '${RUN}';`)
console.log(`Deleted ${N} records. Nothing of this run is left.`)
