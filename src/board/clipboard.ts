import { copyImage } from './cloud'
import { room } from './doc'
import { storagePath } from './storage'
import { getUser } from './supabase'
import type { Item } from './types'

const KEY = 'tuval:clipboard'

interface Clip { room: string; items: Item[] }

// Switching board reloads the page, so a clipboard held in a variable was emptied by the very
// act of going where you wanted to paste. It lives in storage, which also makes it work
// between tabs.
export function writeClip(items: Item[]) {
  if (!items.length) return
  try { localStorage.setItem(KEY, JSON.stringify({ room, items } satisfies Clip)) } catch { /* full */ }
}

export function readClip(): Clip | null {
  try {
    const raw = localStorage.getItem(KEY)
    const clip = raw ? (JSON.parse(raw) as Clip) : null
    return clip?.items?.length ? clip : null
  } catch {
    return null
  }
}

// An image object lives under the id of the board it was added to and may only be read by
// people who can read that board. Pasted elsewhere as it is, it would show for whoever could
// see the board it came from and be a blank rectangle for everyone else.
export async function rehomePastedImages(items: Item[], from: string): Promise<Item[]> {
  if (!getUser() || from === room) return items
  return Promise.all(items.map(async (item) => {
    if (item.type !== 'image') return item
    const path = storagePath(item.src)
    if (!path || !path.startsWith(`${from}/`)) return item
    const next = `${room}/${path.slice(from.length + 1)}`
    return (await copyImage(path, next)) ? { ...item, src: next } : item
  }))
}
