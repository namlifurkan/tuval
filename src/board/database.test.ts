import { describe, expect, it } from 'vitest'
import { applyView, monthGrid, monthKey, shiftMonth } from './database'
import type { View } from './database'
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
