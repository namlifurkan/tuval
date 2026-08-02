import { describe, expect, it } from 'vitest'
import { decodeSnapshot, mergeBoardLists, orphansIn, pickSnapshot, snapshotBase64 } from './cloud'

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

describe('boards offered to search', () => {
  it('includes a shared cloud board this browser has never opened', () => {
    const local = [{ room: 'mine', name: 'Mine', opened: 1, items: 0, frames: 0 }]
    const cloud = [{
      room: 'panel', name: 'Panel planning', opened: 2, items: 4, frames: 0,
      owned: false,
    }]
    expect(mergeBoardLists(local, cloud).map((board) => board.room)).toEqual(['mine', 'panel'])
  })

  it('uses the cloud name and omits cloud trash', () => {
    const local = [{ room: 'same', name: 'Old name', opened: 1, items: 0, frames: 0 }]
    const cloud = [
      { room: 'same', name: 'Renamed', opened: 2, items: 0, frames: 0, owned: true },
      { room: 'gone', name: 'Gone', opened: 2, items: 0, frames: 0, owned: true, deleted: 1 },
    ]
    expect(mergeBoardLists(local, cloud)).toEqual([expect.objectContaining({ name: 'Renamed' })])
  })
})

describe('snapshot transport', () => {
  const bytes = Uint8Array.from({ length: 100_003 }, (_, i) => i % 251)
  const hex = `\\x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`

  it('base64-encodes across chunk boundaries without changing a byte', async () => {
    const encoded = await snapshotBase64(bytes)
    const decoded = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0))
    expect(decoded).toEqual(bytes)
    expect(encoded.length).toBeLessThan(bytes.length * 1.34 + 4)
  })

  it('reads back what it wrote, whichever encoding the row comes in', async () => {
    expect(decodeSnapshot(hex)).toEqual(bytes)
    expect(decodeSnapshot(hex.toUpperCase().replace('\\X', '\\x'))).toEqual(bytes)
    expect(decodeSnapshot(await snapshotBase64(bytes))).toEqual(bytes)
  })

  // Returning nothing here used to be indistinguishable from an empty board, and the next save
  // would write this tab's document over the one it could not read.
  it('refuses a row it cannot read instead of reporting an empty board', () => {
    expect(() => decodeSnapshot('\\xabc')).toThrow()
    expect(() => decodeSnapshot('\\xzz')).toThrow()
    expect(() => decodeSnapshot('a snapshot service is down')).toThrow()
  })
})
