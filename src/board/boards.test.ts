import { beforeEach, describe, expect, it } from 'vitest'
import { currentRoom, forgetBoard, getBoards, newRoom, touchBoard } from './boards'

beforeEach(() => {
  for (const b of getBoards()) forgetBoard(b.room)
  localStorage.clear()
})

describe('board registry', () => {
  it('adds a board and keeps its facts', () => {
    touchBoard('alpha', { name: 'Sprint', items: 12, frames: 2, opened: 100 })
    expect(getBoards()).toEqual([
      { room: 'alpha', name: 'Sprint', items: 12, frames: 2, opened: 100 },
    ])
  })

  it('updates instead of duplicating', () => {
    touchBoard('alpha', { name: 'Sprint', opened: 100 })
    touchBoard('alpha', { items: 30, opened: 200 })
    expect(getBoards()).toHaveLength(1)
    expect(getBoards()[0]).toMatchObject({ name: 'Sprint', items: 30, opened: 200 })
  })

  it('sorts by most recently opened', () => {
    touchBoard('old', { opened: 1 })
    touchBoard('new', { opened: 9 })
    touchBoard('mid', { opened: 5 })
    expect(getBoards().map((b) => b.room)).toEqual(['new', 'mid', 'old'])
  })

  it('forgets a board and its saved camera', () => {
    touchBoard('alpha', { opened: 1 })
    localStorage.setItem('tuval:camera:alpha', '{"x":0,"y":0,"z":1}')
    forgetBoard('alpha')
    expect(getBoards()).toEqual([])
    expect(localStorage.getItem('tuval:camera:alpha')).toBeNull()
  })

  it('survives a corrupt registry', () => {
    localStorage.setItem('tuval:boards', 'not json')
    expect(() => touchBoard('alpha', { opened: 1 })).not.toThrow()
  })

  it('mints distinct rooms', () => {
    const rooms = new Set(Array.from({ length: 50 }, newRoom))
    expect(rooms.size).toBe(50)
  })
})

describe('room from url', () => {
  const set = (hash: string, search = '') => {
    history.replaceState(null, '', `/${search}${hash}`)
  }

  it('reads the room from the hash', () => {
    set('#alpha')
    expect(currentRoom()).toBe('alpha')
  })

  it('ignores a supabase auth callback hash', () => {
    set('#access_token=abc&expires_in=3600&type=magiclink')
    expect(currentRoom()).toBe('')
  })

  it('falls back to ?room= when the hash carries tokens', () => {
    set('#access_token=abc&refresh_token=def', '?room=alpha')
    expect(currentRoom()).toBe('alpha')
  })

  it('prefers an explicit hash over ?room=', () => {
    set('#beta', '?room=alpha')
    expect(currentRoom()).toBe('beta')
  })
})
