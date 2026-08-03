import { describe, expect, it } from 'vitest'
import { MARK_KEYS, nextMark } from './marks'
import type { Item } from './types'

const item = (over: Partial<Item> = {}): Item => ({
  id: 'i', type: 'sticky', x: 0, y: 0, w: 10, h: 10, bold: false, italic: false,
  ...over,
} as Item)

describe('text marks', () => {
  it('spells the three the way every editor does', () => {
    expect(MARK_KEYS.b).toBe('bold')
    expect(MARK_KEYS.i).toBe('italic')
    expect(MARK_KEYS.u).toBe('underline')
  })

  it('turns a mark on when it is off', () => {
    expect(nextMark([item()], 'bold')).toBe(true)
  })

  it('turns it off only when every one of them has it', () => {
    expect(nextMark([item({ bold: true }), item({ bold: true })], 'bold')).toBe(false)
  })

  it('takes a mixed selection all the way on rather than swapping each for its opposite', () => {
    expect(nextMark([item({ bold: true }), item({ bold: false })], 'bold')).toBe(true)
  })

  it('counts an item with no such field as not having the mark', () => {
    expect(nextMark([item({ bold: true }), item({ type: 'image' } as Partial<Item>)], 'bold')).toBe(true)
  })
})
