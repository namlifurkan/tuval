import { addDays, today } from './database'
import { isClosed } from './issues'
import { createRecord, getRecords, patchCells } from './records'
import type { Record as Row, Status } from './records'

// A project is a record, so it is searchable, mentionable and can be dropped on a canvas like
// anything else. What makes it a project is that issues point at it and it has two dates.
//
// The dates live in data rather than in columns of their own: a start date is wanted by exactly
// one screen, and a column earns its place by being queried, not by existing.
export const startOf = (row: Row) => String((row.data as { starts_on?: unknown })?.starts_on ?? '')
export const targetOf = (row: Row) => String((row.data as { ends_on?: unknown })?.ends_on ?? '')

export const setSpan = (row: Row, starts: string, ends: string) =>
  patchCells(row.id, { starts_on: starts, ends_on: ends })

export const listProjects = () => getRecords('project')

const LENGTH = 42

// Six weeks is what a project is until somebody says otherwise, which is long enough to be worth
// planning and short enough to be worth finishing.
export async function addProject(title: string): Promise<string | null> {
  const id = await createRecord(title, 'project')
  if (id) patchCells(id, { starts_on: today(), ends_on: addDays(today(), LENGTH) })
  return id
}

export interface Progress { done: number; total: number; points: number; closed: number }

export function progressOf(project: string): Progress {
  const mine = getRecords('issue').filter((r) => r.project_id === project)
  const shut = mine.filter(isClosed)
  const points = (list: Row[]) => list.reduce((sum, r) => sum + (r.estimate ?? 0), 0)
  return {
    done: shut.length,
    total: mine.length,
    points: points(mine),
    closed: points(shut),
  }
}

// A project has no status of its own to type in: it is planned until something under it has
// started, and finished when nothing under it is left open. Said rather than stored, so it
// cannot be stale.
export type Phase = 'planned' | 'started' | 'finished'

export function phaseOf(project: string): Phase {
  const held = progressOf(project)
  if (!held.total) return 'planned'
  if (held.done === held.total) return 'finished'
  const started = getRecords('issue')
    .some((r) => r.project_id === project && r.status && r.status !== 'backlog' && r.status !== 'todo')
  return started ? 'started' : 'planned'
}

export const PHASE_TONE: { [K in Phase]: string } = {
  planned: '#C6C2B6',
  started: '#DE9A4E',
  finished: '#5E9A8A',
}

// Whether a project is late: past its target with work still open. A project with no target
// cannot be late, which is the honest answer rather than a guess.
export function isLate(project: Row): boolean {
  const target = targetOf(project)
  if (!target) return false
  return target < today() && phaseOf(project.id) !== 'finished'
}

export const openIssues = (project: string): Row[] =>
  getRecords('issue').filter((r) => r.project_id === project && !isClosed(r))

export const statusOf = (row: Row): Status | null => row.status
