import { nanoid } from 'nanoid'

const NAMES = ['Ada', 'Kerem', 'Deniz', 'Mina', 'Poyraz', 'Zeynep', 'Efe', 'Lara']
const COLORS = ['#C8452D', '#3E5C93', '#5E9A8A', '#8A7FB0', '#DE9A4E', '#B9718A']

export interface Me { id: string; name: string; color: string }

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

export function renameMe(name: string) {
  me.name = name
  try { localStorage.setItem('tuval:me', JSON.stringify(me)) } catch { /* ignore */ }
}

export const initials = (name: string) =>
  name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()
