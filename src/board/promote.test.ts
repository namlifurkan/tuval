import { describe, expect, it } from 'vitest'
import { recordHref, recordItemsFor } from './promote'
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
