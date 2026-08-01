import { nanoid } from 'nanoid'

export interface BoardEntry {
  room: string
  name: string
  opened: number
  items: number
  frames: number
  thumb?: string
  deleted?: number
}

const KEY = 'tuval:boards'
const DB_PREFIX = 'tuval:'

const listeners = new Set<() => void>()
let cache: BoardEntry[] = read()

// useSyncExternalStore compares snapshots by identity, so these are sliced once per write and
// handed out as the same arrays. Filtering inside the getter returns a new array every render
// and spins.
let live: BoardEntry[] = []
let binned: BoardEntry[] = []

function reslice() {
  live = cache.filter((b) => !b.deleted)
  binned = cache.filter((b) => b.deleted)
}

reslice()

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
  reslice()
  try { localStorage.setItem(KEY, JSON.stringify(cache)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export const getBoards = () => live
export const getTrash = () => binned

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
    thumb: patch.thumb ?? current?.thumb,
  }
  if (current && next.name === current.name && next.items === current.items
    && next.frames === current.frames && next.opened === current.opened
    && next.thumb === current.thumb) return
  write([...rest, next])
}

// The document survives until the trash is emptied, so restoring gives back the board rather
// than an empty one with the right name.
export function trashLocalBoard(room: string) {
  const board = cache.find((b) => b.room === room)
  if (!board) return
  write([...cache.filter((b) => b.room !== room), { ...board, deleted: Date.now() }])
}

export function restoreLocalBoard(room: string) {
  const board = cache.find((b) => b.room === room)
  if (!board) return
  const { deleted: _gone, ...rest } = board
  write([...cache.filter((b) => b.room !== room), rest])
}

export function forgetBoard(room: string) {
  write(cache.filter((b) => b.room !== room))
  try { indexedDB.deleteDatabase(`${DB_PREFIX}${room}`) } catch { /* ignore */ }
  try { localStorage.removeItem(`tuval:camera:${room}`) } catch { /* ignore */ }
}

export const newRoom = () => nanoid(10)

export function goHome() {
  go('/dashboard')
}

const routeListeners = new Set<() => void>()
const announceRoute = () => routeListeners.forEach((l) => l())

export function subscribeRoute(fn: () => void) {
  routeListeners.add(fn)
  return () => { routeListeners.delete(fn) }
}

export const routePath = () => location.pathname

addEventListener('popstate', announceRoute)

// A board binds its Y.Doc, its renderer and its socket at module load, so arriving at one or
// leaving one is a fresh page. Everything else is one tree and moves without reloading.
export function go(path: string) {
  if (path === location.pathname) return
  const heavy = readRoute().kind === 'board' || path.startsWith('/b/')
  history.pushState(null, '', path)
  if (heavy) location.reload()
  else announceRoute()
}

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
  history.replaceState(null, '', `/b/${encodeURIComponent(room)}`)
  // doc.ts binds its Y.Doc at module load, so switching rooms means a fresh page.
  location.reload()
}

// Supabase returns from a sign-in link with its tokens in the hash. Rooms live in the path,
// so the two can no longer collide; this only recognises the old shape.
const AUTH_HASH = /(?:^|&)(?:access_token|refresh_token|error_description|error_code)=/

export type AuthPage = 'login' | 'register' | 'forgot' | 'reset'

export type Route =
  | { kind: 'landing' }
  | { kind: 'dashboard' }
  | { kind: 'settings' }
  | { kind: 'issues' }
  | { kind: 'issue'; id: string }
  | { kind: 'projects' }
  | { kind: 'docs' }
  | { kind: 'inbox' }
  | { kind: 'published'; slug: string }
  | { kind: 'form'; slug: string }
  | { kind: 'page'; id: string }
  | { kind: 'collection'; id: string }
  | { kind: 'profile'; handle: string }
  | { kind: 'project'; id: string }
  | { kind: 'auth'; page: AuthPage }
  | { kind: 'board'; room: string }

const AUTH_PAGES: AuthPage[] = ['login', 'register', 'forgot', 'reset']

export function readRoute(): Route {
  const path = location.pathname.replace(/\/+$/, '') || '/'
  const board = /^\/b\/(.+)$/.exec(path)
  if (board) return { kind: 'board', room: decodeURIComponent(board[1]) }
  if (path === '/dashboard') return { kind: 'dashboard' }
  if (path === '/settings') return { kind: 'settings' }
  if (path === '/issues') return { kind: 'issues' }
  if (path === '/projects') return { kind: 'projects' }
  if (path === '/pages') return { kind: 'docs' }
  if (path === '/inbox') return { kind: 'inbox' }
  const shown = /^\/p\/(.+)$/.exec(path)
  if (shown) return { kind: 'published', slug: decodeURIComponent(shown[1]) }
  const asking = /^\/f\/(.+)$/.exec(path)
  if (asking) return { kind: 'form', slug: decodeURIComponent(asking[1]) }
  const page = /^\/d\/(.+)$/.exec(path)
  if (page) return { kind: 'page', id: decodeURIComponent(page[1]) }
  const set = /^\/c\/(.+)$/.exec(path)
  if (set) return { kind: 'collection', id: decodeURIComponent(set[1]) }
  const who = /^\/u\/(.+)$/.exec(path)
  if (who) return { kind: 'profile', handle: decodeURIComponent(who[1]) }
  const work = /^\/w\/(.+)$/.exec(path)
  if (work) return { kind: 'project', id: decodeURIComponent(work[1]) }
  const issue = /^\/i\/(.+)$/.exec(path)
  if (issue) return { kind: 'issue', id: decodeURIComponent(issue[1]) }
  const auth = AUTH_PAGES.find((p) => path === `/${p}`)
  if (auth) return { kind: 'auth', page: auth }
  // Every marketing address, including the front door, is the same kind of thing: a page of
  // words the site module owns. An address nobody wrote a page for falls back to the front door.
  return { kind: 'landing' }
}

// Boards used to live in the hash and briefly in ?room=. Links of both shapes are already out
// in the world, in invite emails among other places, so they are translated on arrival.
export function legacyTarget(pathname: string, search: string, hash: string): string | null {
  if (pathname.replace(/\/+$/, '') !== '') return null
  const raw = hash.replace(/^#/, '')
  const token = AUTH_HASH.test(raw)
  const room = token ? new URLSearchParams(search).get('room') ?? '' : raw
  if (!room) return null
  return `/b/${encodeURIComponent(room)}${token ? `#${raw}` : ''}`
}

function adoptLegacyUrl() {
  const to = legacyTarget(location.pathname, location.search, location.hash)
  if (to) history.replaceState(null, '', to)
}

adoptLegacyUrl()

export const currentRoom = () => {
  const route = readRoute()
  return route.kind === 'board' ? route.room : ''
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
