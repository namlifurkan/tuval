import { getRecords } from './records'
import type { Record as Row } from './records'
import { getUser, supabase } from './supabase'

// One issue standing in front of another. Kept in the same link table a page mention uses,
// because "this points at that" is one idea and having two tables for it is how the two drift.
//
// Only one direction is stored. Blocked-by is the same row read backwards, so the two can never
// disagree about which way round it is.
export type Relation = 'blocks' | 'relates_to'

interface Link { from_id: string; to_id: string; kind: Relation }

let links: Link[] = []
// React is told the world changed by the value it is handed, so there has to be a value that
// changes. The links themselves are read through the helpers below, not through the snapshot.
let version = 0
const listeners = new Set<() => void>()

export const relationsVersion = () => version

export const subscribeRelations = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

const announce = () => {
  version += 1
  listeners.forEach((fn) => fn())
}

export async function loadRelations() {
  if (!supabase || !getUser()) return
  const { data } = await supabase
    .from('record_links').select('from_id, to_id, kind').in('kind', ['blocks', 'relates_to'])
  links = (data ?? []) as Link[]
  announce()
}

const issuesById = () => new Map(getRecords('issue').map((r) => [r.id, r]))

export function blocking(id: string): Row[] {
  const by = issuesById()
  return links.filter((l) => l.kind === 'blocks' && l.from_id === id)
    .map((l) => by.get(l.to_id)).filter((r): r is Row => !!r)
}

export function blockedBy(id: string): Row[] {
  const by = issuesById()
  return links.filter((l) => l.kind === 'blocks' && l.to_id === id)
    .map((l) => by.get(l.from_id)).filter((r): r is Row => !!r)
}

export function relatedIssues(id: string): Row[] {
  const by = issuesById()
  return links
    .filter((l) => l.kind === 'relates_to' && (l.from_id === id || l.to_id === id))
    .map((l) => by.get(l.from_id === id ? l.to_id : l.from_id))
    .filter((r): r is Row => !!r)
}

export async function link(from: string, to: string, kind: Relation) {
  if (!supabase || from === to) return
  if (links.some((l) => l.kind === kind && l.from_id === from && l.to_id === to)) return
  links = [...links, { from_id: from, to_id: to, kind }]
  announce()
  await supabase.from('record_links').insert({ from_id: from, to_id: to, kind })
}

export async function unlink(from: string, to: string, kind: Relation) {
  if (!supabase) return
  links = links.filter((l) => !(l.kind === kind && l.from_id === from && l.to_id === to))
  announce()
  await supabase.from('record_links')
    .delete().eq('from_id', from).eq('to_id', to).eq('kind', kind)
}

// Sub-issues are not a link at all: an issue under another issue is the parent column already on
// the row, which is the same thing that puts a page under a page.
export const childrenOf = (id: string) =>
  getRecords('issue').filter((r) => r.parent_id === id)

export interface Progress { done: number; total: number }

export function progressOf(id: string, closed: (row: Row) => boolean): Progress | null {
  const kids = childrenOf(id)
  if (!kids.length) return null
  return { done: kids.filter(closed).length, total: kids.length }
}
