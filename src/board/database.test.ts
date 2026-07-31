import { describe, expect, it } from 'vitest'
import {
  addDays, aggregate, applyView, daysApart, groupsOf, monthGrid, monthKey, shiftMonth, spanOf,
  valueOf,
} from './database'
import type { Field, View } from './database'
import type { Record as Row } from './records'

const row = (id: string, title: string, data: { [k: string]: unknown } = {}, position = 0): Row => ({
  id,
  kind: 'doc',
  title,
  description: '',
  icon: '',
  cover: '',
  parent_id: 'db',
  status: null,
  assignee: null,
  priority: null,
  due_at: null,
  position,
  updated_at: '2026-08-01T00:00:00Z',
  data,
})

const view = (over: Partial<View> = {}): View => ({ id: 'v', name: 'V', kind: 'table', ...over })

describe('monthGrid', () => {
  it('always returns six weeks', () => {
    for (const key of ['2026-01', '2026-02', '2026-08', '2027-02', '2024-02']) {
      expect(monthGrid(key)).toHaveLength(42)
    }
  })

  it('starts on the Monday on or before the first', () => {
    // 1 August 2026 is a Saturday, so the grid opens on Monday 27 July.
    expect(monthGrid('2026-08')[0]).toBe('2026-07-27')
    // 1 June 2026 is a Monday, so no padding is needed.
    expect(monthGrid('2026-06')[0]).toBe('2026-06-01')
  })

  it('covers every day of the month', () => {
    const days = monthGrid('2026-02')
    expect(days).toContain('2026-02-01')
    expect(days).toContain('2026-02-28')
  })

  it('handles a leap day', () => {
    expect(monthGrid('2024-02')).toContain('2024-02-29')
  })
})

describe('shiftMonth', () => {
  it('crosses a year in both directions', () => {
    expect(shiftMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftMonth('2026-01', -1)).toBe('2025-12')
  })

  it('is its own inverse', () => {
    expect(shiftMonth(shiftMonth('2026-08', 5), -5)).toBe('2026-08')
  })
})

describe('monthKey', () => {
  it('takes the month out of a day', () => {
    expect(monthKey('2026-08-01')).toBe('2026-08')
  })
})

describe('applyView', () => {
  const rows = [
    row('a', 'Apple', { n: 3, tag: 't1' }, 2),
    row('b', 'pear', { n: 1 }, 1),
    row('c', 'Fig', { n: 10, tag: 't1' }, 3),
  ]

  it('keeps every row when nothing is set', () => {
    expect(applyView(rows, view())).toHaveLength(3)
  })

  it('filters on a cell', () => {
    const only = applyView(rows, view({ filters: [{ id: 'f', field: 'tag', op: 'is', value: 't1' }] }))
    expect(only.map((r) => r.id)).toEqual(['a', 'c'])
  })

  it('filters on the title, ignoring case', () => {
    const only = applyView(rows, view({ filters: [{ id: 'f', field: '__title__', op: 'contains', value: 'P' }] }))
    expect(only.map((r) => r.id)).toEqual(['a', 'b'])
  })

  it('compares numbers as numbers, not as text', () => {
    const sorted = applyView(rows, view({ sorts: [{ field: 'n', dir: 'asc' }] }))
    expect(sorted.map((r) => r.id)).toEqual(['b', 'a', 'c'])
  })

  it('sorts an empty cell last whichever way the column points', () => {
    const up = applyView(rows, view({ sorts: [{ field: 'tag', dir: 'asc' }] }))
    const down = applyView(rows, view({ sorts: [{ field: 'tag', dir: 'desc' }] }))
    expect(up.at(-1)!.id).toBe('b')
    expect(down.at(-1)!.id).toBe('b')
  })

  it('treats a relation as the list it is', () => {
    const linked = [
      row('x', 'X', { rel: ['r1', 'r2'] }),
      row('y', 'Y', { rel: [] }),
      row('z', 'Z'),
    ]
    const is = applyView(linked, view({ filters: [{ id: 'f', field: 'rel', op: 'is', value: 'r2' }] }))
    expect(is.map((r) => r.id)).toEqual(['x'])

    const empty = applyView(linked, view({ filters: [{ id: 'f', field: 'rel', op: 'empty' }] }))
    expect(empty.map((r) => r.id)).toEqual(['y', 'z'])

    const some = applyView(linked, view({ filters: [{ id: 'f', field: 'rel', op: 'notEmpty' }] }))
    expect(some.map((r) => r.id)).toEqual(['x'])
  })

  it('leaves the original list alone', () => {
    applyView(rows, view({ sorts: [{ field: 'n', dir: 'desc' }] }))
    expect(rows.map((r) => r.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('groupsOf', () => {
  const field: Field = {
    id: 'f',
    name: 'Status',
    type: 'select',
    choices: [
      { id: 'a', name: 'Todo', tone: '#000' },
      { id: 'b', name: 'Done', tone: '#111' },
    ],
  }

  it('is one group holding everything when nothing groups it', () => {
    const rows = [row('1', 'One'), row('2', 'Two')]
    expect(groupsOf(rows, undefined)).toEqual([{ choice: null, rows }])
  })

  it('keeps a group with no rows in it', () => {
    const groups = groupsOf([row('1', 'One', { f: 'a' })], field)
    expect(groups.map((g) => g.choice?.id ?? null)).toEqual(['a', 'b', null])
    expect(groups[1].rows).toEqual([])
  })

  it('files a value naming a deleted choice with the ones that never had one', () => {
    const groups = groupsOf([row('1', 'One', { f: 'gone' }), row('2', 'Two')], field)
    expect(groups.at(-1)!.rows.map((r) => r.id)).toEqual(['1', '2'])
  })

  it('loses no row', () => {
    const rows = [row('1', 'a', { f: 'a' }), row('2', 'b', { f: 'b' }), row('3', 'c')]
    expect(groupsOf(rows, field).flatMap((g) => g.rows)).toHaveLength(rows.length)
  })
})

describe('aggregate', () => {
  const values = [3, '10', 'not a number', '', 5]

  it('counts every row, whatever they hold', () => {
    expect(aggregate(values, 'count')).toBe(5)
    expect(aggregate([], 'count')).toBe(0)
  })

  it('does arithmetic only over the values that are numbers', () => {
    expect(aggregate(values, 'sum')).toBe(18)
    expect(aggregate(values, 'average')).toBe(6)
    expect(aggregate(values, 'min')).toBe(3)
    expect(aggregate(values, 'max')).toBe(10)
    expect(aggregate(values, 'range')).toBe(7)
  })

  it('is empty rather than zero when nothing is a number', () => {
    for (const roll of ['sum', 'average', 'min', 'max', 'range'] as const) {
      expect(aggregate(['a', ''], roll)).toBe('')
    }
  })

  it('shows what is there and skips what is not', () => {
    expect(aggregate(['Ayse', '', null, 'Mehmet'], 'show')).toBe('Ayse, Mehmet')
  })
})

describe('valueOf', () => {
  const fields: Field[] = [
    { id: 'p', name: 'Price', type: 'number' },
    { id: 'q', name: 'Qty', type: 'number' },
    { id: 'total', name: 'Total', type: 'formula', formula: 'prop("Price") * prop("Qty")' },
    { id: 'vat', name: 'With VAT', type: 'formula', formula: 'round(prop("Total") * 1.2)' },
  ]

  it('reads a stored cell as it is stored', () => {
    expect(valueOf(row('1', 'One', { p: 10 }), fields[0], fields)).toBe(10)
  })

  it('works a formula out from the row', () => {
    expect(valueOf(row('1', 'One', { p: 10, q: 3 }), fields[2], fields)).toBe(30)
  })

  it('lets one formula name another', () => {
    expect(valueOf(row('1', 'One', { p: 10, q: 3 }), fields[3], fields)).toBe(36)
  })

  it('gives the title the name every database calls it', () => {
    const named: Field[] = [{ id: 'f', name: 'Greeting', type: 'formula', formula: '"hi " || prop("Name")' }]
    expect(valueOf(row('1', 'Ayse'), named[0], named)).toBe('hi Ayse')
  })

  it('stops rather than hangs when two formulas name each other', () => {
    const loop: Field[] = [
      { id: 'a', name: 'A', type: 'formula', formula: 'prop("B")' },
      { id: 'b', name: 'B', type: 'formula', formula: 'prop("A")' },
    ]
    expect(valueOf(row('1', 'One'), loop[0], loop)).toBe('')
  })
})

describe('day arithmetic', () => {
  it('adds days across a month and a year', () => {
    expect(addDays('2026-08-30', 3)).toBe('2026-09-02')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
  })

  it('counts days apart, whichever way round', () => {
    expect(daysApart('2026-08-05', '2026-08-12')).toBe(7)
    expect(daysApart('2026-08-12', '2026-08-05')).toBe(-7)
    expect(daysApart('2026-08-05', '2026-08-05')).toBe(0)
  })

  it('survives the two days a year that are not 24 hours long', () => {
    // Whatever the machine's timezone, a day added is a day added.
    for (const iso of ['2026-03-28', '2026-03-29', '2026-10-24', '2026-10-25']) {
      expect(daysApart(iso, addDays(iso, 1))).toBe(1)
    }
  })
})

describe('spanOf', () => {
  const timeline = view({ kind: 'timeline', dateBy: 's', endBy: 'e' })

  it('is nothing at all without a start', () => {
    expect(spanOf(row('1', 'One', { e: '2026-08-10' }), timeline)).toBeNull()
  })

  it('is one day wide when there is no end', () => {
    const held = spanOf(row('1', 'One', { s: '2026-08-05' }), timeline)
    expect(held).toEqual({ start: '2026-08-05', end: '2026-08-05' })
  })

  it('refuses to run backwards', () => {
    const held = spanOf(row('1', 'One', { s: '2026-08-05', e: '2026-07-01' }), timeline)
    expect(held).toEqual({ start: '2026-08-05', end: '2026-08-05' })
  })
})
