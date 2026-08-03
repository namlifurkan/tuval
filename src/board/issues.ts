import { COLOR } from './brand'
import { CLOSED, getRecords, loadRecords } from './records'
import type { Record as Row, Status } from './records'
import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// The colour of a state, in one place, because a dot in a list and a column on a board are the
// same fact and drifting apart is how a product starts to feel unmade.
export const STATUS_TONE: { [K in Status]: string } = {
  backlog: '#C6C2B6',
  todo: COLOR.muted,
  doing: '#DE9A4E',
  review: '#7FA5BE',
  blocked: '#C8664A',
  done: '#5E9A8A',
  cancelled: '#C6C2B6',
}

// What an issue is called out loud. The prefix belongs to the workspace, the number to the row.
export const issueKey = (row: Row, prefix: string) =>
  row.seq ? `${prefix || 'ISS'}-${row.seq}` : ''

export const isClosed = (row: Row) => !!row.status && CLOSED.includes(row.status)

// Cycles ----------------------------------------------------------------------------------------

export interface Cycle {
  id: string
  number: number
  name: string
  starts_on: string
  ends_on: string
}

const COLUMNS = 'id, number, name, starts_on, ends_on'

let cycles: Cycle[] = []
let labels: Label[] = []
const listeners = new Set<() => void>()

export const getCycles = () => cycles
export const getLabels = () => labels

export function subscribeIssues(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

const announce = () => listeners.forEach((fn) => fn())

export async function loadCycles() {
  const ws = getWorkspace()
  if (!supabase || !ws) return
  const { data } = await supabase
    .from('cycles').select(COLUMNS).eq('workspace_id', ws.id)
    .order('number', { ascending: false }).limit(40)
  cycles = (data ?? []) as Cycle[]
  announce()
}

// The one today falls inside. Cycles do not overlap in practice, and if two somehow do, the one
// that started later is the one being worked in.
export function currentCycle(day: string): Cycle | null {
  return cycles.find((c) => c.starts_on <= day && day <= c.ends_on) ?? null
}

const LENGTH = 14

// The next one starts where the last one ended, so a team that makes cycles by clicking a button
// ends up with a calendar rather than a pile.
export async function addCycle(after: string): Promise<Cycle | null> {
  const ws = getWorkspace()
  if (!supabase || !ws) return null
  const last = cycles[0]
  const starts = last ? nextDay(last.ends_on) : after
  const { data } = await supabase.from('cycles').insert({
    workspace_id: ws.id,
    number: (last?.number ?? 0) + 1,
    starts_on: starts,
    ends_on: addDays(starts, LENGTH - 1),
  }).select(COLUMNS).single()
  if (data) { cycles = [data as Cycle, ...cycles]; announce() }
  return (data as Cycle) ?? null
}

export async function removeCycle(id: string) {
  if (!supabase) return
  cycles = cycles.filter((c) => c.id !== id)
  announce()
  await supabase.from('cycles').delete().eq('id', id)
  await loadRecords('issue')
}

const addDays = (iso: string, by: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + by * 86400000).toISOString().slice(0, 10)

const nextDay = (iso: string) => addDays(iso, 1)

// How a cycle is doing: points closed against points taken on, and how many days are left.
export interface Burn { total: number; closed: number; open: number; left: number }

export function burnOf(cycle: Cycle, rows: Row[], day: string): Burn {
  const mine = rows.filter((r) => r.cycle_id === cycle.id)
  const points = (list: Row[]) => list.reduce((sum, r) => sum + (r.estimate ?? 0), 0)
  const shut = mine.filter(isClosed)
  return {
    total: points(mine),
    closed: points(shut),
    open: mine.length - shut.length,
    left: Math.max(0, Math.round(
      (Date.parse(`${cycle.ends_on}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`)) / 86400000)),
  }
}

// Labels ----------------------------------------------------------------------------------------

export interface Label { id: string; name: string; tone: string }

// The gouache palette again, so a label, a tag in a database and a sticky are the same colours.
export const LABEL_TONES = [
  '#C8664A', '#E8C55A', '#8FA96B', '#7FA5BE', '#8A7FB0', '#B9718A', '#5E9A8A', '#DE9A4E',
]

export async function loadLabels() {
  const ws = getWorkspace()
  if (!supabase || !ws) return
  const { data } = await supabase
    .from('labels').select('id, name, tone').eq('workspace_id', ws.id).order('name')
  labels = (data ?? []) as Label[]
  announce()
}

export async function addLabel(name: string): Promise<Label | null> {
  const ws = getWorkspace()
  const held = name.trim()
  if (!supabase || !ws || !held) return null
  const same = labels.find((l) => l.name.toLowerCase() === held.toLowerCase())
  if (same) return same
  const { data } = await supabase.from('labels').insert({
    workspace_id: ws.id,
    name: held,
    tone: LABEL_TONES[labels.length % LABEL_TONES.length],
  }).select('id, name, tone').single()
  if (data) { labels = [...labels, data as Label]; announce() }
  return (data as Label) ?? null
}

export async function removeLabel(id: string) {
  if (!supabase) return
  labels = labels.filter((l) => l.id !== id)
  wornBy = new Map([...wornBy].map(([row, worn]) => [row, worn.filter((l) => l !== id)]))
  announce()
  await supabase.from('labels').delete().eq('id', id)
}

// Which labels are on which record. A map rather than a column on the row, because a label is a
// thing in its own right — renaming one should not mean rewriting every issue wearing it.
let wornBy = new Map<string, string[]>()

export const labelsOn = (record: string) => wornBy.get(record) ?? []

export async function loadWorn() {
  if (!supabase || !getUser()) return
  const { data } = await supabase.from('record_labels').select('record_id, label_id')
  const next = new Map<string, string[]>()
  for (const row of (data ?? []) as { record_id: string; label_id: string }[]) {
    next.set(row.record_id, [...(next.get(row.record_id) ?? []), row.label_id])
  }
  wornBy = next
  announce()
}

export async function toggleLabel(record: string, label: string) {
  if (!supabase) return
  const worn = labelsOn(record)
  const had = worn.includes(label)
  wornBy = new Map(wornBy).set(record, had ? worn.filter((l) => l !== label) : [...worn, label])
  announce()

  if (had) {
    await supabase.from('record_labels').delete().eq('record_id', record).eq('label_id', label)
  } else {
    await supabase.from('record_labels').insert({ record_id: record, label_id: label })
  }
}

// Grouping ---------------------------------------------------------------------------------------

export type GroupBy = 'status' | 'assignee' | 'priority' | 'cycle' | 'project' | 'none'

export interface Band { key: string; label: string; rows: Row[] }

// One way of splitting a list, used by the list view and by nothing else yet. Kept here rather
// than in the component because what a band is called is a fact about the data.
export function bandsOf(
  rows: Row[],
  by: GroupBy,
  names: { person: (id: string | null) => string; cycle: (id: string | null) => string },
): Band[] {
  if (by === 'none') return [{ key: 'all', label: '', rows }]

  const of = (row: Row): { key: string; label: string } => {
    switch (by) {
      case 'status': return { key: row.status ?? 'none', label: row.status ?? 'none' }
      case 'assignee': return {
        key: row.assignee ?? 'none',
        label: names.person(row.assignee) || 'Nobody',
      }
      case 'priority': return {
        key: String(row.priority ?? 0),
        label: ['none', 'low', 'medium', 'high'][row.priority ?? 0],
      }
      case 'cycle': return {
        key: row.cycle_id ?? 'none',
        label: names.cycle(row.cycle_id) || 'No cycle',
      }
      default: return {
        key: row.project_id ?? 'none',
        label: getRecords('project').find((p) => p.id === row.project_id)?.title || 'No project',
      }
    }
  }

  const bands = new Map<string, Band>()
  for (const row of rows) {
    const { key, label } = of(row)
    const held = bands.get(key) ?? { key, label, rows: [] }
    held.rows.push(row)
    bands.set(key, held)
  }

  // Status bands come out in the order the states are written down; everything else is however
  // the rows arrived, which is the order the list was already in.
  const order = ['backlog', 'todo', 'doing', 'review', 'blocked', 'done', 'cancelled', 'none']
  const out = [...bands.values()]
  if (by === 'status') out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
  return out
}
