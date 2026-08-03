#!/usr/bin/env node
// Pulls every item of a Miro board into a JSON file that Tuval can import.
//
//   MIRO_TOKEN=xxx node scripts/miro-export.mjs <board-url-or-id> [out.json]
//
// Miro has no JSON export of its own — the menu offers PDF, an image, a CSV of sticky text and
// a backup only Miro can read. This asks the API for the same board instead, which is where the
// frames, the connectors and the positions actually are.
//
// The token stays in your shell: Tuval never sees it, and the browser never talks to Miro.
// Create one at https://miro.com/app/settings/user-profile/apps — a developer team app with
// boards:read is enough.

const token = process.env.MIRO_TOKEN
const [raw, out = 'miro-board.json'] = process.argv.slice(2)

// Paste the address bar rather than picking the id out of it. The id is the segment after
// /board/, it usually ends in an '=', and that has to be encoded before it goes back into a URL.
const found = /\/board\/([^/?#]+)/.exec(raw ?? '')?.[1] ?? raw ?? ''
const board = found && encodeURIComponent(decodeURIComponent(found))

if (!token || !board) {
  console.error('usage: MIRO_TOKEN=xxx node scripts/miro-export.mjs <board-url-or-id> [out.json]')
  process.exit(1)
}

const api = async (path) => {
  const res = await fetch(`https://api.miro.com/v2${path}`, {
    headers: { authorization: `Bearer ${token}`, accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}: ${await res.text()}`)
  return res.json()
}

const items = []
let cursor = ''

do {
  const page = await api(`/boards/${board}/items?limit=50${cursor ? `&cursor=${cursor}` : ''}`)
  items.push(...(page.data ?? []))
  cursor = page.cursor ?? ''
  process.stderr.write(`\r${items.length} items`)
} while (cursor)

// Connectors are a separate collection in the Miro API and never appear under /items.
cursor = ''
do {
  const page = await api(`/boards/${board}/connectors?limit=50${cursor ? `&cursor=${cursor}` : ''}`)
  items.push(...(page.data ?? []).map((c) => ({ ...c, type: 'connector' })))
  cursor = page.cursor ?? ''
  process.stderr.write(`\r${items.length} items`)
} while (cursor)

const { writeFile } = await import('node:fs/promises')
await writeFile(out, JSON.stringify({ data: items }, null, 2))
process.stderr.write(`\rWrote ${items.length} items to ${out}\n`)
