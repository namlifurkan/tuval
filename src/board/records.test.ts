import { describe, expect, it } from 'vitest'
import { between } from './records'
import type { Record as Issue } from './records'

const at = (position: number) => ({ position } as Issue)

describe('where a dropped card goes', () => {
  it('takes the midpoint between its neighbours, so one row is written', () => {
    expect(between(at(1), at(2))).toBe(1.5)
    expect(between(at(0), at(1))).toBe(0.5)
  })

  it('goes before the first, or after the last', () => {
    expect(between(null, at(3))).toBe(2)
    expect(between(at(3), null)).toBe(4)
  })

  it('has somewhere to go in an empty column', () => {
    expect(between(null, null)).toBe(0)
  })

  it('keeps its place after repeated drops between the same pair', () => {
    let low = at(0)
    const high = at(1)
    for (let i = 0; i < 20; i++) {
      const next = between(low, high)
      expect(next).toBeGreaterThan(low.position)
      expect(next).toBeLessThan(high.position)
      low = at(next)
    }
  })
})
