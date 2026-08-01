import { describe, expect, it } from 'vitest'
import { leftovers } from './tidy'
import type { Item } from './types'

const item = (over: Partial<Item> & { type: Item['type'] }): Item =>
  ({ id: over.type, x: 0, y: 0, w: 100, h: 100, rotation: 0, locked: false, ...over } as Item)

const ends = (x: number, y: number) => ({ itemId: null, anchor: null, x, y })

describe('leftovers', () => {
  it('takes the things a slip of the hand makes', () => {
    const found = leftovers([
      item({ type: 'text', id: 'blank-text', text: '   ' }),
      item({ type: 'sticky', id: 'blank-sticky', text: '' }),
      item({ type: 'draw', id: 'speck', w: 2, h: 3 }),
      item({ type: 'connector', id: 'stub', text: '', from: ends(0, 0), to: ends(5, 5) }),
      item({ type: 'frame', id: 'unused-frame', title: '' }),
    ])
    expect(found.sort()).toEqual(['blank-sticky', 'blank-text', 'speck', 'stub', 'unused-frame'])
  })

  it('leaves anything somebody meant', () => {
    const found = leftovers([
      item({ type: 'text', id: 'written', text: 'Hello' }),
      // A sticky with only a label on it is a column heading in half the boards ever made.
      item({ type: 'sticky', id: 'labelled', text: '', label: 'Backlog' }),
      item({ type: 'draw', id: 'stroke', w: 200, h: 40 }),
      item({ type: 'image', id: 'picture' }),
      item({ type: 'record', id: 'card' }),
      item({ type: 'table', id: 'grid' }),
      item({ type: 'comment', id: 'pin' }),
      item({ type: 'shape', id: 'box', text: '' }),
    ])
    expect(found).toEqual([])
  })

  it('keeps a connector that joins two things, however short', () => {
    const joined = { itemId: 'a', anchor: null, x: 0, y: 0 }
    expect(leftovers([
      item({ type: 'connector', id: 'joined', text: '', from: joined, to: { ...joined, itemId: 'b' } }),
    ])).toEqual([])
  })

  it('keeps a long connector even with nothing on either end', () => {
    expect(leftovers([
      item({ type: 'connector', id: 'drawn', text: '', from: ends(0, 0), to: ends(400, 0) }),
    ])).toEqual([])
  })

  it('keeps a frame with something in it, and a named empty one', () => {
    expect(leftovers([
      item({ type: 'frame', id: 'holding', title: '' }),
      item({ type: 'sticky', id: 'inside', text: 'x', parentId: 'holding' }),
      item({ type: 'frame', id: 'named', title: 'Week 3' }),
    ])).toEqual([])
  })

  it('never takes something locked, whatever it looks like', () => {
    expect(leftovers([item({ type: 'text', id: 'pinned', text: '', locked: true })])).toEqual([])
  })
})
