import { describe, expect, it } from 'vitest'
import { recordHref, recordItemsFor, snapshotPatches } from './promote'
import { makeRecordItem } from './items'
import type { Record as Row } from './records'

const row = (id: string, kind: string, title = id): Row =>
  ({ id, kind, title, status: null } as unknown as Row)

describe('placing existing work', () => {
  it('lays cards out three to a row', () => {
    const made = recordItemsFor([1, 2, 3, 4].map((n) => row(`r${n}`, 'issue')), 0, 0)
    expect(made.map((i) => [i.x, i.y])).toEqual([[0, 0], [280, 0], [560, 0], [0, 116]])
  })

  it('carries the kind, so a page card is not mistaken for an issue', () => {
    const [card] = recordItemsFor([row('p1', 'doc', 'Launch notes')], 10, 20)
    expect(card).toMatchObject({ type: 'record', kind: 'doc', recordId: 'p1', x: 10, y: 20 })
    expect(card.type === 'record' && card.snapshot.title).toBe('Launch notes')
  })

  it('opens a page on the page screen and everything else on the issue screen', () => {
    const [page, base, work] = recordItemsFor(
      [row('a', 'doc'), row('b', 'database'), row('c', 'issue')], 0, 0,
    )
    expect([page, base, work].map((i) => recordHref(i as never)))
      .toEqual(['/d/a', '/d/b', '/i/c'])
  })
})

describe('refreshing record cards', () => {
  it('marks a card whose record disappeared, and clears the mark if it returns', () => {
    const card = makeRecordItem(0, 0, 'gone', 'Old title', 'todo')
    expect(snapshotPatches([card], new Map())).toEqual([[card.id, { missing: true }]])

    card.missing = true
    const returned = row('gone', 'issue', 'Restored title')
    returned.status = 'doing'
    expect(snapshotPatches([card], new Map([['gone', returned]]))).toEqual([[
      card.id,
      { missing: false, snapshot: { title: 'Restored title', status: 'doing' } },
    ]])
  })
})
