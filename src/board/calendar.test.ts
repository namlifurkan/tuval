import { describe, expect, it } from 'vitest'
import { marksFrom } from './calendar'
import type { Cycle } from './issues'
import type { Record as Row } from './records'
import type { Rule } from './recurring'

const row = (over: Partial<Row> = {}): Row => ({
  id: 'r', kind: 'issue', title: 'Launch plan', icon: '', parent_id: null, due_at: null, data: {},
  ...over,
} as Row)

const NOTHING = { issues: [], pages: [], databases: [], projects: [], cycles: [], rules: [] }

describe('workspace calendar', () => {
  it('places a due date on the day its own detail screen shows', () => {
    // The date input writes new Date('2026-08-04').toISOString(), which is UTC midnight, and
    // reads it back with slice(0, 10). A calendar that converted to a local day would disagree
    // with that screen for every user west of Greenwich.
    const stamp = new Date('2026-08-04').toISOString()
    const marks = marksFrom({ ...NOTHING, issues: [row({ due_at: stamp })] }, '2026-08-01', '2026-08-31')
    expect(marks.map((m) => m.day)).toEqual(['2026-08-04'])
    expect(marks[0].href).toBe('/i/r')
    expect(marks[0].movable).toBe(true)
  })

  it('leaves out what falls outside the window', () => {
    const marks = marksFrom({
      ...NOTHING,
      issues: [row({ id: 'a', due_at: '2026-07-31T00:00:00.000Z' }), row({ id: 'b', due_at: '2026-08-15T00:00:00.000Z' })],
    }, '2026-08-01', '2026-08-31')
    expect(marks.map((m) => m.id)).toEqual(['b'])
  })

  it('calls a database row a row and a page a page', () => {
    const marks = marksFrom({
      ...NOTHING,
      databases: [row({ id: 'db', kind: 'database', title: 'Clients' })],
      pages: [
        row({ id: 'p', kind: 'doc', title: 'Brief', due_at: '2026-08-04T00:00:00.000Z' }),
        row({ id: 'x', kind: 'doc', title: 'Acme', parent_id: 'db', due_at: '2026-08-04T00:00:00.000Z' }),
      ],
    }, '2026-08-01', '2026-08-31')
    expect(marks.map((m) => m.kind).sort()).toEqual(['page', 'row'])
  })

  it('shows what a cycle, a project and a rule own, and refuses to move them', () => {
    const cycle: Cycle = { id: 'c', number: 4, name: 'Cycle 4', starts_on: '2026-08-03', ends_on: '2026-08-17' }
    const rule = { id: 'u', title: 'Weekly report', next_on: '2026-08-07', active: true } as Rule
    const project = row({ id: 'w', kind: 'project', title: 'Redesign', data: { starts_on: '2026-08-02', ends_on: '2026-08-20' } })
    const marks = marksFrom({ ...NOTHING, cycles: [cycle], rules: [rule], projects: [project] }, '2026-08-01', '2026-08-31')
    expect(marks.map((m) => m.day)).toEqual(['2026-08-02', '2026-08-03', '2026-08-07', '2026-08-17', '2026-08-20'])
    expect(marks.every((m) => !m.movable)).toBe(true)
  })

  it('keeps a rule that has been switched off out of the month', () => {
    const rule = { id: 'u', title: 'Weekly report', next_on: '2026-08-07', active: false } as Rule
    expect(marksFrom({ ...NOTHING, rules: [rule] }, '2026-08-01', '2026-08-31')).toEqual([])
  })
})
