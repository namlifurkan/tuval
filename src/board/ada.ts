import { getItems } from './doc'
import { cloudEnabled, getUser } from './supabase'

export interface Tip {
  id: string
  anchor: string
  title: string
  body: string
  when: (f: Facts) => boolean
}

export interface Facts {
  items: number
  connectors: number
  frames: number
  signedIn: boolean
}

export const TIPS: Tip[] = [
  {
    id: 'first',
    anchor: 'sticky',
    title: 'Empty board',
    body: 'Press N and click the canvas to drop your first sticky.',
    when: (f) => f.items === 0,
  },
  {
    id: 'connect',
    anchor: 'connector',
    title: 'Two loose ideas',
    body: 'L draws a connector. Drag from one item to another and the line follows them.',
    when: (f) => f.items >= 2 && f.connectors === 0,
  },
  {
    id: 'frame',
    anchor: 'frame',
    title: 'Getting crowded',
    body: 'F draws a frame. Frames become sections when you present or hand off.',
    when: (f) => f.items >= 6 && f.frames === 0,
  },
  {
    id: 'handoff',
    anchor: 'handoff',
    title: 'Ready to build',
    body: 'This turns the board into a brief an AI agent can read and act on.',
    when: (f) => f.frames >= 1,
  },
  {
    id: 'signin',
    anchor: 'account',
    title: 'This browser only',
    body: 'Sign in and the board follows you to any device.',
    when: (f) => cloudEnabled && !f.signedIn && f.items >= 8,
  },
  {
    id: 'share',
    anchor: 'share',
    title: 'Better with someone',
    body: 'Share emails a teammate a sign-in link straight to this board.',
    when: (f) => cloudEnabled && f.signedIn && f.items >= 8,
  },
]

const KEY = 'tuval:ada'

interface State { off: boolean; seen: string[] }

function read(): State {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? (JSON.parse(raw) as Partial<State>) : {}
    return { off: !!parsed.off, seen: Array.isArray(parsed.seen) ? parsed.seen : [] }
  } catch {
    return { off: false, seen: [] }
  }
}

let state = read()
const listeners = new Set<() => void>()

export const getAda = () => state
export const subscribeAda = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function write(next: State) {
  state = next
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export const dismissTip = (id: string) =>
  write({ ...state, seen: state.seen.includes(id) ? state.seen : [...state.seen, id] })

export const setAdaOff = (off: boolean) => write({ ...state, off })

export function facts(): Facts {
  const items = getItems()
  return {
    items: items.filter((i) => i.type !== 'connector').length,
    connectors: items.filter((i) => i.type === 'connector').length,
    frames: items.filter((i) => i.type === 'frame').length,
    signedIn: !!getUser(),
  }
}

export function nextTip(anchored: (anchor: string) => boolean): Tip | null {
  if (state.off) return null
  const f = facts()
  return TIPS.find((t) => !state.seen.includes(t.id) && t.when(f) && anchored(t.anchor)) ?? null
}
