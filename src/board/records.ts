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
  status: Status | null
  assignee: string | null
  priority: number | null
  due_at: string | null
  position: number
  updated_at: string
}

const COLUMNS = 'id, kind, title, status, assignee, priority, due_at, position, updated_at'

// One place holds what has been loaded, so a change made in one view is seen by the others
// without either knowing about the other.
let cache: Record[] = []
const listeners = new Set<() => void>()

export const getRecords = () => cache
export const subscribeRecords = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function publish(next: Record[]) {
  cache = next
  listeners.forEach((l) => l())
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
  publish((data ?? []) as Record[])
}

// Applied to what is on screen first and sent afterwards. Waiting for a round trip to see your
// own typing is the difference between a tool that feels fast and one that does not.
async function optimistic(next: Record[], work: () => Promise<{ error: unknown }>) {
  const before = cache
  publish(next)
  const { error } = await work()
  if (error) {
    publish(before)
    throw new Error(String((error as { message?: string }).message ?? error))
  }
}

export async function createRecord(title: string, kind: Kind = 'issue'): Promise<string | null> {
  const ws = getWorkspace()
  if (!supabase || !ws) return null

  const row = {
    workspace_id: ws.id,
    kind,
    title: title.trim(),
    status: kind === 'issue' ? ('todo' as Status) : null,
    // Ahead of everything loaded, so a new one appears where it was typed.
    position: Math.min(0, ...cache.map((r) => r.position)) - 1,
    created_by: getUser()?.id ?? null,
  }

  const { data, error } = await supabase.from('records').insert(row).select(COLUMNS).single()
  if (error || !data) return null
  publish([data as Record, ...cache])
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
  publish(cache.map((r) => (r.id === id ? { ...r, ...changes } : r)))
  queued.set(id, { ...queued.get(id), ...changes })
  clearTimeout(timers.get(id))
  timers.set(id, window.setTimeout(() => void flushRecord(id), SETTLE))
}

export async function flushRecord(id: string) {
  clearTimeout(timers.get(id))
  timers.delete(id)
  const changes = queued.get(id)
  if (!changes || !supabase) return
  queued.delete(id)
  const { error } = await supabase.from('records').update(changes).eq('id', id)
  if (error) await loadRecords(cache.find((r) => r.id === id)?.kind ?? 'issue')
}

export const flushRecords = () => Promise.all([...queued.keys()].map(flushRecord))

addEventListener('pagehide', () => { void flushRecords() })

export async function archiveRecord(id: string) {
  await optimistic(
    cache.filter((r) => r.id !== id),
    async () => supabase!.from('records')
      .update({ archived_at: new Date().toISOString() }).eq('id', id),
  )
}

// Dropped between two others: the midpoint of their positions, so one row is written rather
// than every row after it being renumbered.
export function between(before: Record | null, after: Record | null): number {
  if (!before && !after) return 0
  if (!before) return after!.position - 1
  if (!after) return before.position + 1
  return (before.position + after.position) / 2
}
