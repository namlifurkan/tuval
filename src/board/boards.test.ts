import { beforeEach, describe, expect, it } from 'vitest'
import {
  currentRoom, forgetBoard, getBoards, legacyTarget, newRoom, openBoard, readRoute, touchBoard,
} from './boards'

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
  const at = (path: string, search = '', hash = '') => {
    history.replaceState(null, '', `${path}${search}${hash}`)
  }

  it('reads the room from the path', () => {
    at('/b/alpha')
    expect(currentRoom()).toBe('alpha')
    expect(readRoute()).toEqual({ kind: 'board', room: 'alpha' })
  })

  it('knows the account pages', () => {
    for (const page of ['login', 'register', 'forgot', 'reset']) {
      at(`/${page}`)
      expect(readRoute()).toEqual({ kind: 'auth', page })
      expect(currentRoom()).toBe('')
    }
    at('/loginn')
    expect(readRoute().kind).toBe('landing')
  })

  it('has no room on the front door or the board list', () => {
    at('/')
    expect(currentRoom()).toBe('')
    expect(readRoute().kind).toBe('landing')
    at('/dashboard')
    expect(currentRoom()).toBe('')
    expect(readRoute().kind).toBe('dashboard')
    at('/settings')
    expect(currentRoom()).toBe('')
    expect(readRoute().kind).toBe('settings')
  })

  it('decodes a room that needed escaping', () => {
    at('/b/team%20board')
    expect(currentRoom()).toBe('team board')
  })
})

describe('links written before rooms moved into the path', () => {
  it('turns an old hash link into a path', () => {
    expect(legacyTarget('/', '', '#alpha')).toBe('/b/alpha')
  })

  it('keeps a sign-in token and takes the room from ?room=', () => {
    const token = '#access_token=abc&type=magiclink'
    expect(legacyTarget('/', '?room=alpha', token)).toBe(`/b/alpha${token}`)
  })

  it('leaves a token-only arrival on the front door', () => {
    expect(legacyTarget('/', '', '#access_token=abc')).toBe(null)
  })

  it('never rewrites a url that already has a path', () => {
    expect(legacyTarget('/b/alpha', '', '#beta')).toBe(null)
    expect(legacyTarget('/dashboard', '?room=alpha', '')).toBe(null)
  })

  it('does nothing without a legacy room', () => {
    expect(legacyTarget('/', '', '')).toBe(null)
  })
})

describe('board pictures', () => {
  it('keeps a thumbnail and does not lose it on the next touch', () => {
    touchBoard('alpha', { items: 3, thumb: 'data:image/webp;base64,xx' })
    expect(getBoards()[0].thumb).toBe('data:image/webp;base64,xx')
    touchBoard('alpha', { items: 4 })
    expect(getBoards()[0]).toMatchObject({ items: 4, thumb: 'data:image/webp;base64,xx' })
  })
})

describe('the landing hero is not a board', () => {
  it('refuses to register a board with no room', () => {
    touchBoard('', { name: 'hero', items: 7 })
    expect(getBoards()).toHaveLength(0)
  })

  it('refuses to open one', () => {
    const before = location.href
    openBoard('')
    expect(location.href).toBe(before)
  })
})
