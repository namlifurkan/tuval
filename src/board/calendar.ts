import { cellsOf, schemaOf } from './database'
import { getCycles } from './issues'
import type { Cycle } from './issues'
import { startOf, targetOf } from './projects'
import { getRecords } from './records'
import type { Record as Row } from './records'
import { getRules } from './recurring'
import type { Rule } from './recurring'

export type MarkKind = 'issue' | 'page' | 'row' | 'project' | 'cycle' | 'rule'

export interface Mark {
  id: string
  day: string
  title: string
  kind: MarkKind
  icon: string
  href: string
  // Only a record's own due date is the calendar's to move. A cycle's span belongs to the cycle
  // and a rule's next run to the rule; dragging those would write the wrong table.
  movable: boolean
}

// `due_at` is a stamp used as a day, and every screen that reads it takes the first ten
// characters: the date input in IssueDetail and PageProps writes `new Date('2026-08-04')`, which
// is UTC midnight, and shows `slice(0, 10)` back. The calendar keeps that convention rather than
// inventing a second one — a local-day reading would put a day west of Greenwich on the day
// before the one its own detail screen displays.
const dayOfStamp = (at: string) => at.slice(0, 10)

const within = (day: string, from: string, to: string) => !!day && day >= from && day <= to

export function marksFrom(
  source: { issues: Row[]; pages: Row[]; databases: Row[]; projects: Row[]; cycles: Cycle[]; rules: Rule[] },
  from: string,
  to: string,
): Mark[] {
  const marks: Mark[] = []
  const tables = new Set(source.databases.map((d) => d.id))

  for (const row of source.issues) {
    const day = dayOfStamp(row.due_at ?? '')
    if (within(day, from, to)) {
      marks.push({ id: row.id, day, title: row.title, kind: 'issue', icon: row.icon, href: `/i/${row.id}`, movable: true })
    }
  }

  // Which column a table keeps its dates in: the one its own calendar hangs on, and failing that
  // the first date it has. A row set up to be looked at on a calendar belongs on this one too,
  // and asking each table rather than each row means a table with no dates costs nothing.
  const dated = new Map<string, string>()
  for (const table of source.databases) {
    const schema = schemaOf(table)
    const on = schema.views.find((v) => v.kind === 'calendar' && v.dateBy)?.dateBy
      ?? schema.fields.find((f) => f.type === 'date')?.id
    if (on) dated.set(table.id, on)
  }

  // A database row is a `doc` record like a page is, so the two arrive in one list. Calling a row
  // a page on the calendar would be the same mistake the read path already makes elsewhere.
  for (const row of source.pages) {
    const inTable = row.parent_id && tables.has(row.parent_id)
    // A row's own date column stands in for a due date it was never given: the person who set up
    // a Publish column meant that day, and made it the day the table is read by.
    const held = inTable ? cellsOf(row)[dated.get(row.parent_id ?? '') ?? ''] : undefined
    const day = dayOfStamp(row.due_at ?? (typeof held === 'string' ? held : ''))
    if (!within(day, from, to)) continue
    const kind: MarkKind = inTable ? 'row' : 'page'
    marks.push({ id: row.id, day, title: row.title, kind, icon: row.icon, href: `/d/${row.id}`, movable: !!row.due_at })
  }

  for (const row of source.projects) {
    for (const [day, suffix] of [[startOf(row), 'starts'], [targetOf(row), 'target']] as const) {
      if (!within(day, from, to)) continue
      marks.push({
        id: `${row.id}-${suffix}`, day, title: row.title, kind: 'project', icon: row.icon,
        href: `/w/${row.id}`, movable: false,
      })
    }
  }

  for (const cycle of source.cycles) {
    for (const day of [cycle.starts_on, cycle.ends_on]) {
      if (!within(day, from, to)) continue
      marks.push({
        id: `${cycle.id}-${day}`, day, title: cycle.name || `${cycle.number}`, kind: 'cycle', icon: '',
        href: '/issues', movable: false,
      })
    }
  }

  for (const rule of source.rules) {
    if (!rule.active || !within(rule.next_on, from, to)) continue
    marks.push({
      id: rule.id, day: rule.next_on, title: rule.title, kind: 'rule', icon: '',
      href: '/settings', movable: false,
    })
  }

  return marks.sort((a, b) => (a.day === b.day ? a.title.localeCompare(b.title) : a.day < b.day ? -1 : 1))
}

// What the workspace already knows about dates, read from the caches the rest of the app fills.
// No table of events of its own: a calendar that stored anything would be a second truth about a
// day that a record already owns.
export const marksBetween = (from: string, to: string) => marksFrom({
  issues: getRecords('issue'),
  pages: getRecords('doc'),
  databases: getRecords('database'),
  projects: getRecords('project'),
  cycles: getCycles(),
  rules: getRules(),
}, from, to)
