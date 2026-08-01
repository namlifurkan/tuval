import * as Y from 'yjs'
import { getItems, room, ydoc } from './doc'
import { readOnly } from './access'
import { storagePath } from './storage'
import { surfaceColor } from './brand'
import { makeThumb } from './thumb'
import { claimBoard, pullSnapshot, pushSnapshot, sweepImages } from './cloud'
import { getUser, subscribeAuth, supabase } from './supabase'
import { getMeta } from './doc'
import { loadWorkspace } from './workspace'

const SAVE_AFTER = 2500
const RETRY_AFTER = 5000

let timer = 0
let restoreTimer = 0
let dirty = false
let restored = false
let restoring = false
let revision = 0

const counts = () => {
  const all = getItems()
  return {
    items: all.filter((i) => i.type !== 'frame').length,
    frames: all.filter((i) => i.type === 'frame').length,
  }
}

let lastError: string | null = null
export const cloudError = () => lastError
const errorListeners = new Set<() => void>()
export const subscribeCloud = (listener: () => void) => {
  errorListeners.add(listener)
  return () => { errorListeners.delete(listener) }
}

function setCloudError(next: string | null) {
  if (lastError === next) return
  lastError = next
  errorListeners.forEach((listener) => listener())
}

async function save() {
  timer = 0
  if (!room || !dirty || !restored || !getUser() || readOnly()) return
  const saving = revision
  const { items, frames } = counts()
  const name = (getMeta().name as string) ?? ''
  const error = await claimBoard(room, name)
    ?? await pushSnapshot(room, Y.encodeStateAsUpdate(ydoc), items, frames, makeThumb(getItems(), surfaceColor(String(getMeta().surface ?? 'paper'))))
  if (error) {
    setCloudError(error)
    dirty = true
    console.warn('[tuval] cloud save failed:', error)
    if (!timer) timer = window.setTimeout(() => { void save() }, RETRY_AFTER)
    return
  }
  setCloudError(null)
  dirty = revision !== saving
  if (dirty && !timer) timer = window.setTimeout(() => { void save() }, SAVE_AFTER)
}

// Opening a board is enough to want a picture of it: a board nobody has edited since the
// feature shipped would otherwise stay blank in the list for ever.
// Run once the document is on screen, not on every save: it lists a folder, and what it
// removes has been unreferenced for a day already.
export async function sweepOrphanImages() {
  if (!room || readOnly()) return
  // A document that failed to load looks exactly like an empty one, and on an empty one every
  // image is unreferenced. Nothing is removed until there is something to compare against.
  if (!getItems().length) return
  const referenced = new Set(
    getItems()
      .filter((i) => i.type === 'image')
      .map((i) => storagePath(i.src))
      .filter((p): p is string => !!p),
  )
  const gone = await sweepImages(room, referenced)
  if (gone) console.info(`[tuval] removed ${gone} unreferenced image(s)`)
}

export function refreshThumb() {
  schedule()
}

function schedule() {
  if (!room) return
  revision += 1
  dirty = true
  if (timer || !restored || !getUser()) return
  timer = window.setTimeout(() => void save(), SAVE_AFTER)
}

// The cloud copy is merged, never assigned: a CRDT update applied on top of the local doc
// converges whatever each side missed while offline.
async function restore() {
  if (restored || restoring || !getUser()) return
  restoring = true
  try {
    if (!await loadWorkspace()) throw new Error('No workspace')
    const update = await pullSnapshot(room)
    if (update?.length) Y.applyUpdate(ydoc, update, 'cloud')
    restored = true
    revision += 1
    dirty = true
    await save()
  } catch (error) {
    setCloudError(error instanceof Error ? error.message : String(error))
    if (!restoreTimer) {
      restoreTimer = window.setTimeout(() => {
        restoreTimer = 0
        void restore()
      }, RETRY_AFTER)
    }
  } finally {
    restoring = false
  }
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
