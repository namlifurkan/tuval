import { describe, expect, it } from 'vitest'
import { orphansIn, pickSnapshot } from './cloud'

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

describe('collecting images nothing refers to', () => {
  const day = 24 * 60 * 60 * 1000
  const now = Date.parse('2026-07-31T12:00:00Z')
  const old = new Date(now - day * 2).toISOString()
  const fresh = new Date(now - 60_000).toISOString()

  it('removes what the board no longer refers to', () => {
    const objects = [{ name: 'a.webp', created_at: old }, { name: 'b.webp', created_at: old }]
    expect(orphansIn('demo', objects, new Set(['demo/b.webp']), now)).toEqual(['demo/a.webp'])
  })

  it('leaves a recent upload alone, in case its item is not saved yet', () => {
    const objects = [{ name: 'a.webp', created_at: fresh }]
    expect(orphansIn('demo', objects, new Set(), now)).toEqual([])
  })

  it('leaves an object of unknown age alone', () => {
    expect(orphansIn('demo', [{ name: 'a.webp' }], new Set(), now)).toEqual([])
    expect(orphansIn('demo', [{ name: 'a.webp', created_at: 'nonsense' }], new Set(), now)).toEqual([])
  })

  it('keeps an image two items share', () => {
    const objects = [{ name: 'a.webp', created_at: old }]
    expect(orphansIn('demo', objects, new Set(['demo/a.webp']), now)).toEqual([])
  })
})
