import { nanoid } from 'nanoid'
import { GUIDE } from './brand'
import { avatarUrl } from './profile'
import { displayName, getUser, subscribeAuth } from './supabase'

const NAMES = ['Kerem', 'Deniz', 'Mina', 'Poyraz', 'Zeynep', 'Efe', 'Lara', 'Bora']
const COLORS = ['#C8452D', '#3E5C93', '#5E9A8A', '#8A7FB0', '#DE9A4E', '#B9718A']

export interface Me { id: string; name: string; color: string; avatar?: string }

function load(): Me {
  try {
    const raw = localStorage.getItem('tuval:me')
    if (raw) return JSON.parse(raw) as Me
  } catch { /* ignore */ }
  const fresh: Me = {
    id: nanoid(6),
    name: NAMES[Math.floor(Math.random() * NAMES.length)],
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }
  try { localStorage.setItem('tuval:me', JSON.stringify(fresh)) } catch { /* ignore */ }
  return fresh
}

export const me = load()

const listeners = new Set<() => void>()
export const subscribeMe = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Signing in replaces the alias: appearing to your own team under a random first name is a
// puzzle, not a nicety. An older alias could also collide with the guide, so it is dropped.
function adopt() {
  const user = getUser()
  const wanted = user ? displayName(user.email) : null
  const face = user ? avatarUrl() : ''
  const changed = (wanted && me.name !== wanted)
    || (!wanted && me.name === GUIDE.name)
    || (me.avatar ?? '') !== face

  if (wanted && me.name !== wanted) renameMe(wanted)
  else if (!wanted && me.name === GUIDE.name) renameMe(NAMES[0])
  me.avatar = face || undefined

  if (changed) listeners.forEach((l) => l())
}

adopt()
subscribeAuth(adopt)

export function renameMe(name: string) {
  me.name = name
  try { localStorage.setItem('tuval:me', JSON.stringify(me)) } catch { /* ignore */ }
}

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
