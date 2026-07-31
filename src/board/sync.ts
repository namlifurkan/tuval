import * as Y from 'yjs'
import { getItems, room, ydoc } from './doc'
import { readOnly } from './access'
import { surfaceColor } from './brand'
import { makeThumb } from './thumb'
import { claimBoard, claimInvites, pullSnapshot, pushSnapshot } from './cloud'
import { getUser, subscribeAuth, supabase } from './supabase'
import { getMeta } from './doc'

const SAVE_AFTER = 2500

let timer = 0
let dirty = false
let restored = false

const counts = () => {
  const all = getItems()
  return {
    items: all.filter((i) => i.type !== 'frame').length,
    frames: all.filter((i) => i.type === 'frame').length,
  }
}

let lastError: string | null = null
export const cloudError = () => lastError

async function save() {
  timer = 0
  if (!room || !dirty || !getUser() || readOnly()) return
  dirty = false
  const { items, frames } = counts()
  const name = (getMeta().name as string) ?? ''
  lastError = await claimBoard(room, name)
    ?? await pushSnapshot(room, Y.encodeStateAsUpdate(ydoc), items, frames, makeThumb(getItems(), surfaceColor(String(getMeta().surface ?? 'paper'))))
  if (lastError) console.warn('[tuval] cloud save failed:', lastError)
}

// Opening a board is enough to want a picture of it: a board nobody has edited since the
// feature shipped would otherwise stay blank in the list for ever.
export function refreshThumb() {
  schedule()
}

function schedule() {
  if (!room) return
  dirty = true
  if (timer || !getUser()) return
  timer = window.setTimeout(() => void save(), SAVE_AFTER)
}

// The cloud copy is merged, never assigned: a CRDT update applied on top of the local doc
// converges whatever each side missed while offline.
async function restore() {
  if (restored || !getUser()) return
  restored = true
  await claimInvites()
  const update = await pullSnapshot(room)
  if (update?.length) Y.applyUpdate(ydoc, update, 'cloud')
  dirty = true
  void save()
}

export function startCloudSync() {
  if (!supabase) return
  void restore()
  subscribeAuth(() => { void restore() })
  ydoc.on('update', (_update: Uint8Array, origin: unknown) => {
    if (origin === 'cloud') return
    schedule()
  })
  window.addEventListener('pagehide', () => { if (dirty) void save() })
}

export const flushCloud = () => save()
