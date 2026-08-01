import { supabase } from './supabase'
import { getWorkspace } from './workspace'

// The whole workspace in one file. An open-source product that says the data is yours has to be
// able to hand it over, and a backup that cannot be put back is a receipt, not a backup.
//
// What is not in here, and is said out loud on the screen rather than discovered later: the
// uploaded files. They live in storage, they can run to gigabytes, and a browser assembling them
// into one JSON would fall over. Everything written in Tuval is here; everything dragged into it
// is still in the bucket.

export const BACKUP_VERSION = 1

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
}

type Row = { [key: string]: unknown }

const PAGE = 500

// Read in pages. A workspace with more rows than one request returns would otherwise be backed
// up quietly and incompletely, which is the worst thing a backup can be.
async function belonging(table: string, workspace: string): Promise<Row[]> {
  const out: Row[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase!.from(table).select('*')
      .eq('workspace_id', workspace).range(from, from + PAGE - 1)
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

  const [docs, labels, worn, links, cycles] = await Promise.all([
    about('record_docs', 'record_id, doc', 'record_id', ids),
    belonging('labels', ws.id),
    about('record_labels', 'record_id, label_id', 'record_id', ids),
    about('record_links', 'from_id, to_id, kind', 'from_id', ids),
    belonging('cycles', ws.id),
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

export function readBackup(text: string): Backup {
  const held = JSON.parse(text) as Partial<Backup>
  if (!held || typeof held !== 'object' || !Array.isArray(held.records)) {
    throw new Error('This is not a Tuval backup.')
  }
  if (held.version !== BACKUP_VERSION) {
    throw new Error(`This backup was written by a different version (${held.version ?? '?'}).`)
  }
  return held as Backup
}

// The rows that point at other rows, put back last. A record's parent, project and cycle are
// filled in on a second pass, so the order the rows arrive in cannot matter and a page whose
// parent is further down the file is not refused.
const LATER = ['parent_id', 'project_id', 'cycle_id'] as const

// The number an issue wears is assigned by a trigger on insert, which would renumber a restored
// workspace and break every TUV-12 anybody had written down. It is put back afterwards.
export async function importWorkspace(backup: Backup): Promise<{ records: number }> {
  const ws = getWorkspace()
  if (!supabase || !ws) throw new Error('Not signed in')

  if (backup.labels.length) {
    await supabase.from('labels')
      .upsert(backup.labels.map((l) => ({ ...l, workspace_id: ws.id })), { onConflict: 'id' })
      .throwOnError()
  }
  if (backup.cycles.length) {
    await supabase.from('cycles')
      .upsert(backup.cycles.map((c) => ({ ...c, workspace_id: ws.id })), { onConflict: 'id' })
      .throwOnError()
  }

  const flat: Row[] = backup.records.map((r) => {
    const row: Row = { ...r, workspace_id: ws.id }
    for (const key of LATER) row[key] = null
    return row
  })
  for (let at = 0; at < flat.length; at += 200) {
    await supabase.from('records').upsert(flat.slice(at, at + 200), { onConflict: 'id' }).throwOnError()
  }

  for (const row of backup.records) {
    const changes: Row = {}
    for (const key of LATER) if (row[key]) changes[key] = row[key]
    if (row.seq) changes.seq = row.seq
    if (!Object.keys(changes).length) continue
    await supabase.from('records').update(changes).eq('id', row.id as string).throwOnError()
  }

  for (const table of ['record_docs', 'record_labels', 'record_links'] as const) {
    const rows: Row[] = table === 'record_docs' ? backup.docs
      : table === 'record_labels' ? backup.record_labels : backup.record_links
    for (let at = 0; at < rows.length; at += 200) {
      await supabase.from(table).upsert(rows.slice(at, at + 200)).throwOnError()
    }
  }

  return { records: backup.records.length }
}
