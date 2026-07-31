import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

export type Kind = 'issue' | 'doc' | 'person' | 'company' | 'project' | 'event' | 'file'
export type Status = 'todo' | 'doing' | 'blocked' | 'done' | 'cancelled'

export const STATUSES: Status[] = ['todo', 'doing', 'blocked', 'done', 'cancelled']
export const PRIORITIES = ['none', 'low', 'medium', 'high'] as const

export interface Record {
  id: string
  kind: Kind
  title: string
  description: string
  icon: string
  parent_id: string | null
  status: Status | null
  assignee: string | null
  priority: number | null
  due_at: string | null
  position: number
  updated_at: string
}

const COLUMNS =
  'id, kind, title, description, icon, parent_id, status, assignee, priority, due_at, position, updated_at'

// One store per kind. The page tree is drawn on every screen and the issue list only on one, so
// the two are loaded at the same time and a single list would have them overwriting each other.
const EMPTY: Record[] = []
const cache = new Map<Kind, Record[]>()
const listeners = new Set<() => void>()

export const getRecords = (kind: Kind) => cache.get(kind) ?? EMPTY
export const subscribeRecords = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

const kindOf = (id: string): Kind | null => {
  for (const [kind, rows] of cache) if (rows.some((r) => r.id === id)) return kind
  return null
}

function publish(kind: Kind, next: Record[]) {
  cache.set(kind, next)
  listeners.forEach((l) => l())
}

// A change is applied wherever the record already is, so an edit made in one view is seen by
// the others without either knowing about the other.
function replace(id: string, make: (rows: Record[]) => Record[]) {
  const kind = kindOf(id)
  if (kind) publish(kind, make(cache.get(kind)!))
}

export async function loadRecords(kind: Kind = 'issue') {
  const ws = getWorkspace()
  if (!supabase || !ws) return
  const { data } = await supabase
    .from('records').select(COLUMNS)
    .eq('workspace_id', ws.id).eq('kind', kind)
    .is('archived_at', null)
    .order('position', { ascending: true })
    .limit(500)
  publish(kind, (data ?? []) as Record[])
}

export async function createRecord(
  title: string,
  kind: Kind = 'issue',
  parent: string | null = null,
): Promise<string | null> {
  const ws = getWorkspace()
  if (!supabase || !ws) return null
  const here = getRecords(kind)

  const row = {
    workspace_id: ws.id,
    kind,
    title: title.trim(),
    parent_id: parent,
    status: kind === 'issue' ? ('todo' as Status) : null,
    // Ahead of everything loaded, so a new one appears where it was typed.
    position: Math.min(0, ...here.map((r) => r.position)) - 1,
    created_by: getUser()?.id ?? null,
  }

  const { data, error } = await supabase.from('records').insert(row).select(COLUMNS).single()
  if (error || !data) return null
  publish(kind, [data as Record, ...here])
  return (data as Record).id
}

// A title is typed a letter at a time, and one request per letter is a set of requests that
// finish in whatever order the network decides. The last one to arrive wins, so a slow early
// request overwrites the later, longer title with a prefix of itself. Changes are collected
// per record and sent once the typing stops, which is both one request and one answer.
const queued = new Map<string, Partial<Record>>()
const timers = new Map<string, number>()

const SETTLE = 400

export function patchRecord(id: string, changes: Partial<Record>) {
  // The server stamps this itself; the copy on screen is stamped too so a list ordered by it
  // reorders as you type rather than at the next load.
  const local = { ...changes, updated_at: new Date().toISOString() }
  replace(id, (rows) => rows.map((r) => (r.id === id ? { ...r, ...local } : r)))
  queued.set(id, { ...queued.get(id), ...changes })
  clearTimeout(timers.get(id))
  timers.set(id, window.setTimeout(() => void flushRecord(id), SETTLE))
}

export async function flushRecord(id: string) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  const changes = queued.get(id)
  if (!changes || !supabase) return
  const kind = kindOf(id) ?? 'issue'
  queued.delete(id)
  const { error } = await supabase.from('records').update(changes).eq('id', id)
  if (error) await loadRecords(kind)
}

export const flushRecords = () => Promise.all([...queued.keys()].map(flushRecord))

addEventListener('pagehide', () => { void flushRecords() })

// Archiving a page archives what is under it. Leaving the children behind would strand them:
// nothing points at them and no tree draws them, so they exist only as rows.
export async function archiveRecord(id: string) {
  const kind = kindOf(id) ?? 'issue'
  const doomed = new Set([id])
  for (let grew = true; grew;) {
    grew = false
    for (const r of getRecords(kind)) {
      if (r.parent_id && doomed.has(r.parent_id) && !doomed.has(r.id)) {
        doomed.add(r.id)
        grew = true
      }
    }
  }

  const before = getRecords(kind)
  publish(kind, before.filter((r) => !doomed.has(r.id)))
  const { error } = await supabase!.from('records')
    .update({ archived_at: new Date().toISOString() }).in('id', [...doomed])
  if (error) {
    publish(kind, before)
    throw new Error(String((error as { message?: string }).message ?? error))
  }
}

// Dropped between two others: the midpoint of their positions, so one row is written rather
// than every row after it being renumbered.
export function between(before: Record | null, after: Record | null): number {
  if (!before && !after) return 0
  if (!before) return after!.position - 1
  if (!after) return before.position + 1
  return (before.position + after.position) / 2
}

// The chain from the workspace down to a page, used for breadcrumbs. Guarded against a record
// that is its own ancestor: the column allows it even though nothing in the product creates it.
export function ancestors(rows: Record[], id: string): Record[] {
  const by = new Map(rows.map((r) => [r.id, r]))
  const chain: Record[] = []
  const seen = new Set<string>()
  let at = by.get(id)?.parent_id ?? null
  while (at && !seen.has(at)) {
    seen.add(at)
    const row = by.get(at)
    if (!row) break
    chain.unshift(row)
    at = row.parent_id
  }
  return chain
}
