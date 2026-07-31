import { describe, expect, it } from 'vitest'
import { pickSnapshot } from './cloud'

describe('embedded snapshot', () => {
  const snap = { items: 90, frames: 7, thumb: 'data:image/webp;base64,xx' }

  it('reads the one-to-one object PostgREST returns', () => {
    expect(pickSnapshot(snap)).toEqual(snap)
  })

  it('still reads the array shape', () => {
    expect(pickSnapshot([snap])).toEqual(snap)
  })

  it('treats a board with no snapshot as empty, not as broken', () => {
    expect(pickSnapshot(null)).toBe(null)
    expect(pickSnapshot([])).toBe(null)
  })

  it('fills in fields an older row does not have', () => {
    expect(pickSnapshot({ items: 3 })).toEqual({ items: 3, frames: 0, thumb: null })
  })
})
