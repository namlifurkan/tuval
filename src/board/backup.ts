import { supabase } from './supabase'
import { getWorkspace } from './workspace'

// The whole workspace in one file. An open-source product that says the data is yours has to be
// able to hand it over, and a backup that cannot be put back is a receipt, not a backup.
//
// What is not in here, and is said out loud on the screen rather than discovered later: the
// uploaded files. They live in storage, they can run to gigabytes, and a browser assembling them
// into one JSON would fall over. Everything written in Tuval is here; everything dragged into it
// is still in the bucket.

export const BACKUP_VERSION = 2

export interface Backup {
  version: number
  taken_at: string
  workspace: { name: string; prefix: string }
  records: Row[]
  docs: { record_id: string; doc: string }[]
  labels: Row[]
  record_labels: { record_id: string; label_id: string }[]
  record_links: { from_id: string; to_id: string; kind: string }[]
  cycles: Row[]
  // The canvases. Left out of the first version, which made "the whole workspace in one file" a
  // sentence with a hole in it: every page came back and every board stayed behind.
  boards: Row[]
  board_docs: { board_id: string; doc: string }[]
}

type Row = { [key: string]: unknown }

const PAGE = 500

// Read in pages. A workspace with more rows than one request returns would otherwise be backed
// up quietly and incompletely, which is the worst thing a backup can be.
async function belonging(table: string, workspace: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('*')
      .eq('workspace_id', workspace).order('id', { ascending: true }).range(from, from + PAGE - 1)
    if (error) throw error
    out.push(...((data ?? []) as Row[]))
    if ((data ?? []).length < PAGE) return out
  }
}

// Chunked by the ids rather than by the rows: a list of five hundred uuids is already a long URL,
// and PostgREST refuses one long enough.
async function about(
  table: string, columns: string, column: string, ids: string[],
): Promise<Row[]> {
  const out: Row[] = []
  for (let at = 0; at < ids.length; at += 200) {
    const { data, error } = await supabase!.from(table).select(columns)
      .in(column, ids.slice(at, at + 200))
    if (error) throw error
    out.push(...((data ?? []) as unknown as Row[]))
  }
  return out
}

export async function exportWorkspace(): Promise<Backup> {
  const ws = getWorkspace()
  if (!supabase || !ws) throw new Error('Not signed in')

  const records = await belonging('records', ws.id)
  const ids = records.map((r) => r.id as string)

  const boards = await belonging('boards', ws.id)
  const rooms = boards.map((b) => b.id as string)

  const [docs, labels, worn, links, cycles, canvases] = await Promise.all([
    about('record_docs', 'record_id, doc', 'record_id', ids),
    belonging('labels', ws.id),
    about('record_labels', 'record_id, label_id', 'record_id', ids),
    about('record_links', 'from_id, to_id, kind', 'from_id', ids),
    belonging('cycles', ws.id),
    about('board_snapshots', 'board_id, doc', 'board_id', rooms),
  ])

  return {
    version: BACKUP_VERSION,
    taken_at: new Date().toISOString(),
    workspace: { name: ws.name, prefix: ws.prefix },
    records,
    docs: docs as Backup['docs'],
    labels,
    record_labels: worn as Backup['record_labels'],
    record_links: links as Backup['record_links'],
    cycles,
    boards,
    board_docs: canvases as Backup['board_docs'],
  }
}

export function downloadBackup(backup: Backup, name: string) {
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${name.replace(/[^\p{L}\p{N} _-]/gu, '').trim() || 'workspace'}.tuval.json`
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const LISTS = ['docs', 'labels', 'record_labels', 'record_links', 'cycles', 'boards', 'board_docs'] as const

export function readBackup(text: string): Backup {
  const held = JSON.parse(text) as Partial<Backup>
  if (!held || typeof held !== 'object' || !Array.isArray(held.records)) {
    throw new Error('This is not a Tuval backup.')
  }
  if (typeof held.version !== 'number' || held.version < 1 || held.version > BACKUP_VERSION) {
    throw new Error(`This backup was written by a different version (${held.version ?? '?'}).`)
  }
  // An older file is missing the lists that were added after it was written, and a newer one may
  // arrive with a list truncated. Filled in here, once, so nothing downstream has to wonder.
  for (const list of LISTS) {
    if (!Array.isArray(held[list])) (held as Record<string, unknown>)[list] = []
  }
  return held as Backup
}

// The rows that point at other rows, put back last. A record's parent, project and cycle are
// filled in on a second pass, so the order the rows arrive in cannot matter and a page whose
// parent is further down the file is not refused.
const LATER = ['parent_id', 'project_id', 'cycle_id'] as const

// The three columns that name a person. Every one of them is a foreign key into the account
// table, which does not travel with the file: nobody in it exists on a fresh install.
const WHO = ['assignee', 'created_by', 'updated_by'] as const

export interface Restored {
  records: number
  boards: number
  // Fields dropped because the person they named has no account here. Said out loud rather than
  // swallowed: an issue that comes back unassigned is a small loss, but it is a loss, and the
  // one thing worse than losing it is not being told.
  strangers: number
  // Rows that would not go back at all. Counted rather than thrown, because a restore that
  // stops on the first refusal leaves a workspace half full and no way to tell which half.
  refused: number
}

// Two hundred rows in one request is what makes a restore finish. Retrying a refused batch one
// row at a time is what stops a single bad row from taking the other hundred and ninety-nine
// with it — and it is the only way the count at the end can be true.
async function putBack(table: string, rows: Row[], onConflict?: string): Promise<number> {
  const send = (batch: Row[]) => onConflict
    ? supabase!.from(table).upsert(batch, { onConflict })
    : supabase!.from(table).upsert(batch)

  let written = 0
  for (let at = 0; at < rows.length; at += 200) {
    const batch = rows.slice(at, at + 200)
    const { error } = await send(batch)
    if (!error) {
      written += batch.length
      continue
    }
    for (const row of batch) {
      const { error: alone } = await send([row])
      if (!alone) written += 1
      else console.warn(`[tuval] ${table} row refused during restore:`, alone.message)
    }
  }
  return written
}

// Who exists here. A restore onto the same installation is the common case — somebody undoing a
// bad afternoon — and blanking every assignee in it would be a second bad afternoon. Only the
// names that really are absent are dropped.
async function peopleHere(workspace: string, owner: string): Promise<Set<string>> {
  const { data } = await supabase!.from('workspace_members').select('user_id').eq('workspace_id', workspace)
  const known = new Set((data ?? []).map((m) => (m as Row).user_id as string))
  known.add(owner)
  const me = (await supabase!.auth.getUser()).data.user?.id
  if (me) known.add(me)
  return known
}

export async function importWorkspace(backup: Backup): Promise<Restored> {
  const ws = getWorkspace()
  if (!supabase || !ws) throw new Error('Not signed in')

  const known = await peopleHere(ws.id, ws.owner)
  const me = (await supabase.auth.getUser()).data.user?.id ?? ws.owner

  let strangers = 0
  const person = (who: unknown): string | null => {
    if (typeof who !== 'string' || !who) return null
    if (known.has(who)) return who
    strangers += 1
    return null
  }

  let asked = 0
  let written = 0
  const restore = async (table: string, rows: Row[], onConflict?: string) => {
    asked += rows.length
    const put = await putBack(table, rows, onConflict)
    written += put
    return put
  }

  await restore('labels', backup.labels.map((l) => ({ ...l, workspace_id: ws.id })), 'id')
  await restore('cycles', backup.cycles.map((c) => ({ ...c, workspace_id: ws.id })), 'id')

  // A board keeps its owner if that person is here, and otherwise belongs to whoever restored
  // it. The column cannot be null, so there is no third answer.
  const boards = await restore('boards', backup.boards.map((b) => ({
    ...b, workspace_id: ws.id, owner: person(b.owner) ?? me,
  })), 'id')
  await restore('board_snapshots', backup.board_docs)

  // seq travels with the row. The trigger that hands out issue numbers only fires when the
  // column arrives empty, so a restored workspace keeps the numbers people wrote down.
  const flat: Row[] = backup.records.map((r) => {
    const row: Row = { ...r, workspace_id: ws.id }
    for (const key of WHO) row[key] = person(r[key])
    for (const key of LATER) row[key] = null
    return row
  })
  const records = await restore('records', flat, 'id')

  // The second pass, batched like the first. It used to be one request per record, which on a
  // real workspace is thousands of round trips and thousands of chances to stop halfway.
  const pointing = flat
    .map((row, at) => ({ row, from: backup.records[at] }))
    .filter(({ from }) => LATER.some((key) => from[key]))
    .map(({ row, from }) => {
      const full: Row = { ...row }
      for (const key of LATER) full[key] = from[key] ?? null
      return full
    })
  await restore('records', pointing, 'id')

  await restore('record_docs', backup.docs)
  await restore('record_labels', backup.record_labels)
  await restore('record_links', backup.record_links)

  return { records, boards, strangers, refused: asked - written }
}
