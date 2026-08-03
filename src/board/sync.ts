import * as Y from 'yjs'
import { getItems, room, ydoc } from './doc'
import { readOnly } from './access'
import { storagePath } from './storage'
import { makeThumb } from './thumb'
import {
  appendUpdate, claimBoard, compactUpdates, LOG_MAX, pullSnapshot, pullUpdates,
  pushSnapshot, snapshotStamp, sweepImages,
} from './cloud'
import { getUser, subscribeAuth, supabase } from './supabase'
import { getMeta } from './doc'
import { loadWorkspace } from './workspace'

const SAVE_AFTER = 2500
const RETRY_AFTER = 5000
const LOG_AFTER = 150
const COMPACT_LAG = 60_000

let timer = 0
let restoreTimer = 0
let dirty = false
let restored = false
let restoring = false
let revision = 0
let stamp: string | null = null

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

let logPending: Uint8Array[] = []
let logTimer = 0
let logging = false
let logSeq = 0
let marks: { seq: number; at: number }[] = []

const mark = (seq: number, at: number) => {
  if (seq > logSeq) logSeq = seq
  marks.push({ seq, at })
}

// What the row we just wrote provably contains and the log no longer has to keep. The lag is
// the point: a tab that lost the race to write the row gets a minute to notice and write again
// before the updates it was carrying stop existing anywhere else.
// shortcut: our own appends are stamped with this clock rather than the database's, so a badly
// skewed machine compacts early or late; ask the append for its timestamp if that ever bites.
export function compactableSeq(
  seen: { seq: number; at: number }[], before: number, covered: number,
) {
  let cut = 0
  for (const one of seen) if (one.at < before && one.seq <= covered && one.seq > cut) cut = one.seq
  return cut
}

async function appendLog() {
  if (logging || !logPending.length || !room || !getUser() || readOnly()) return
  logging = true
  const batch = logPending
  logPending = []
  const update = batch.length === 1 ? batch[0] : Y.mergeUpdates(batch)
  try {
    // An update too big for a log row still has somewhere to go: the row holds the whole
    // document and has no such limit, so the snapshot carries this one on its own.
    if (update.length > LOG_MAX) { schedule(); return }
    const seq = await appendUpdate(room, update)
    if (seq) mark(seq, Date.now())
    setCloudError(null)
  } catch (error) {
    logPending.unshift(update)
    setCloudError(error instanceof Error ? error.message : String(error))
    if (!logTimer) logTimer = window.setTimeout(() => { logTimer = 0; void appendLog() }, RETRY_AFTER)
  } finally {
    logging = false
  }
}

function logLater() {
  if (logTimer || !room || !getUser() || readOnly()) return
  logTimer = window.setTimeout(() => { logTimer = 0; void appendLog() }, LOG_AFTER)
}

// Everything written to this board that this tab has not seen. A dropped broadcast, a tab that
// died holding the only copy of a chunk, an update queued at the instant the channel went: all
// of them end here rather than in a repair that depends on somebody else still being online.
export async function catchUp() {
  if (!room || !getUser()) return
  const rows = await pullUpdates(room, logSeq)
  for (const one of rows) {
    if (one.update.length) Y.applyUpdate(ydoc, one.update, 'cloud')
    mark(one.seq, one.at)
  }
}

// The row is a compaction of the log, so losing the race to write it costs a rewrite, not work.
// Whatever moved under us is merged in first, which keeps the row from going backwards.
async function merge() {
  try {
    const seen = await snapshotStamp(room)
    if (seen === stamp) return null
    const update = await pullSnapshot(room)
    if (update?.length) Y.applyUpdate(ydoc, update, 'cloud')
    return null
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
}

async function save() {
  timer = 0
  if (!room || !dirty || !restored || !getUser() || readOnly()) return
  const untouched = !stamp && !getItems().length && !getMeta().name
  if (untouched) return
  const saving = revision
  await appendLog()
  const conflict = await merge()
  const { items, frames } = counts()
  const name = (getMeta().name as string) ?? ''
  const error = conflict
    ?? await claimBoard(room, name)
    ?? await pushSnapshot(room, Y.encodeStateAsUpdate(ydoc), items, frames, makeThumb(getItems()))
  if (error) {
    setCloudError(error)
    dirty = true
    console.warn('[tuval] cloud save failed:', error)
    if (!timer) timer = window.setTimeout(() => { void save() }, RETRY_AFTER)
    return
  }
  setCloudError(null)
  stamp = await snapshotStamp(room).catch(() => null)
  const cut = compactableSeq(marks, Date.now() - COMPACT_LAG, logSeq)
  if (cut) {
    await compactUpdates(room, cut).catch(() => 0)
    marks = marks.filter((one) => one.seq > cut)
  }
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
    stamp = await snapshotStamp(room)
    if (update?.length) Y.applyUpdate(ydoc, update, 'cloud')
    await catchUp()
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
  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (origin === 'cloud') return
    logPending.push(update)
    logLater()
    schedule()
  })
  window.addEventListener('pagehide', () => { if (dirty) void save() })
}

export const flushCloud = () => save()
