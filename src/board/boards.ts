import { nanoid } from 'nanoid'

export interface BoardEntry {
  room: string
  name: string
  opened: number
  items: number
  frames: number
  thumb?: string
}

const KEY = 'tuval:boards'
const DB_PREFIX = 'tuval:'

const listeners = new Set<() => void>()
let cache: BoardEntry[] = read()

function read(): BoardEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = (raw ? (JSON.parse(raw) as BoardEntry[]) : []).filter((b) => b?.room)
    return Array.isArray(parsed) ? parsed.filter((b) => b && typeof b.room === 'string') : []
  } catch {
    return []
  }
}

function write(next: BoardEntry[]) {
  cache = next.sort((a, b) => b.opened - a.opened)
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export const getBoards = () => cache

export function subscribeBoards(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function touchBoard(room: string, patch: Partial<Omit<BoardEntry, 'room'>>) {
  if (!room) return
  const rest = cache.filter((b) => b.room !== room)
  const current = cache.find((b) => b.room === room)
  const next: BoardEntry = {
    room,
    name: patch.name ?? current?.name ?? '',
    opened: patch.opened ?? current?.opened ?? Date.now(),
    items: patch.items ?? current?.items ?? 0,
    frames: patch.frames ?? current?.frames ?? 0,
  }
  if (current && next.name === current.name && next.items === current.items
    && next.frames === current.frames && next.opened === current.opened) return
  write([...rest, next])
}

export function forgetBoard(room: string) {
  write(cache.filter((b) => b.room !== room))
  try { indexedDB.deleteDatabase(`${DB_PREFIX}${room}`) } catch { /* ignore */ }
  try { localStorage.removeItem(`tuval:camera:${room}`) } catch { /* ignore */ }
}

export const newRoom = () => nanoid(10)

const PENDING = 'tuval:pending-template'

export function takeTemplate() {
  const id = sessionStorage.getItem(PENDING)
  if (id) sessionStorage.removeItem(PENDING)
  return id
}

export function openBoard(room: string, template?: string) {
  if (!room) return
  if (template) sessionStorage.setItem(PENDING, template)
  if (room === currentRoom()) return
  // replaceState never navigates, so the reload below is guaranteed to load the new url.
  // Assigning location.href starts a navigation that the reload then races.
  history.replaceState(null, '', `${location.pathname}#${room}`)
  // doc.ts binds its Y.Doc at module load, so switching rooms means a fresh page.
  location.reload()
}

const AUTH_HASH = /(?:^|&)(?:access_token|refresh_token|error_description|error_code)=/

export function currentRoom() {
  const hash = location.hash.replace(/^#/, '')
  if (hash && !AUTH_HASH.test(hash)) return hash
  return new URLSearchParams(location.search).get('room') ?? ''
}

// Rooms this browser has data for but that never made it into the registry: an older visit,
// a link someone sent, a cleared localStorage.
export async function discoverBoards() {
  if (typeof indexedDB.databases !== 'function') return
  try {
    const dbs = await indexedDB.databases()
    const known = new Set(cache.map((b) => b.room))
    const found = dbs
      .map((db) => db.name ?? '')
      .filter((n) => n.startsWith(DB_PREFIX))
      .map((n) => n.slice(DB_PREFIX.length))
      .filter((room) => room && !known.has(room))
    if (found.length) {
      write([...cache, ...found.map((room) => ({ room, name: '', opened: 0, items: 0, frames: 0 }))])
    }
  } catch { /* ignore */ }
}
