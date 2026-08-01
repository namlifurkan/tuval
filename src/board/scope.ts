import { getRecords } from './records'
import type { Record as Row } from './records'

// Which piece of work the whole side of the screen is about. Not a filter tucked into one list:
// somebody deep in one project wants the tree, the boards and the issues to all be about that
// project, and to stop thinking about the rest until they switch back.
//
// Everything, always, is the first choice and the one you start on. Scoping is a way to narrow a
// crowded workspace, not a place you have to be.

const KEY = 'tuval:scope'

let current = read()
const listeners = new Set<() => void>()

function read(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

export const getScope = () => current

export const subscribeScope = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setScope(project: string) {
  if (project === current) return
  current = project
  try { localStorage.setItem(KEY, project) } catch { /* private mode */ }
  listeners.forEach((fn) => fn())
}

// A project that has been archived or was never there leaves the scope pointing at nothing, and
// a sidebar showing nothing with no way to see why is worse than showing everything.
export function settleScope() {
  if (current && !getRecords('project').some((r) => r.id === current)) setScope('')
}

// A page inside a page belongs where its parent belongs. Said by walking up rather than by
// copying the project onto every child: a page moved into a project would otherwise take a pass
// over its whole subtree, and any missed one would quietly vanish from the tree.
// The nearest answer wins. Walking up until something says which project it is in means a page
// somebody deliberately put in another project belongs to that one and only that one, rather
// than turning up in two projects because its parent is in a different one.
export function projectOf(row: Row, all: Row[]): string | null {
  const byId = new Map(all.map((r) => [r.id, r]))
  let held: Row | undefined = row
  const seen = new Set<string>()
  while (held && !seen.has(held.id)) {
    if (held.project_id) return held.project_id
    seen.add(held.id)
    held = held.parent_id ? byId.get(held.parent_id) : undefined
  }
  return null
}

export function inScope(row: Row, all: Row[], project = current): boolean {
  if (!project) return true
  return projectOf(row, all) === project
}

export const scopedRows = (rows: Row[]): Row[] =>
  (current ? rows.filter((r) => inScope(r, rows)) : rows)
