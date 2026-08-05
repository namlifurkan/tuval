import * as Y from 'yjs'
import { createItems, getItems, removeItems, room, ydoc } from './doc'
import { readOnly, setForeign } from './access'
import { storagePath } from './storage'
import { makeThumb } from './thumb'
import { boardToGraph, graphToMarkdown } from './agent'
import {
  appendUpdate, claimBoard, clearPendingBrief, compactUpdates, LOG_MAX, NOT_MINE, pullSnapshot,
  pullUpdates, pushSnapshot, readPendingBrief, snapshotStamp, sweepImages,
} from './cloud'
import { getUser, subscribeAuth, supabase } from './supabase'
import { getMeta, setMeta } from './doc'
import { loadWorkspace } from './workspace'

// The mark every item a brief draws carries, and the air left between one draw and the next.
const DRAWN_BY_BRIEF = 'brief'
const BRIEF_GAP = 160

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
// An update belongs to a board, and the policy on the log asks whether you may write that board —
// which is answered from the boards row. Until that row exists there is no board to be allowed to
// write, so an append made first is refused, and a board that cannot log cannot be claimed either.
let claimed = false

// Opening a board is not creating one: until something is on it or it has been named there is
// nothing to keep, and a row would turn every glance into a board in the list.
const untouched = () => !stamp && !getItems().length && !getMeta().name

// The log and the save both need the row, and on a new board they ask within a moment of each
// other: two asks found no row and both inserted one, and the loser was told the key was taken.
// They share the ask instead. A later save gets a fresh one, which is what keeps the name and
// the date current.
let claiming: Promise<string | null> | null = null

async function claim(): Promise<string | null> {
  if (!claiming) {
    claiming = claimBoard(room, (getMeta().name as string) ?? '')
      .finally(() => { claiming = null })
  }
  const error = await claiming
  claimed = !error
  return error
}

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
  // Nothing has been put on this board, so there is nothing to write about it yet. The updates
  // wait in the queue for whatever makes it a board.
  if (untouched()) return
  logging = true
  const batch = logPending
  logPending = []
  const update = batch.length === 1 ? batch[0] : Y.mergeUpdates(batch)
  try {
    // An update too big for a log row still has somewhere to go: the row holds the whole
    // document and has no such limit, so the snapshot carries this one on its own.
    if (update.length > LOG_MAX) { schedule(); return }
    if (!claimed) {
      const refused = await claim()
      if (refused) throw new Error(refused)
    }
    const seq = await appendUpdate(room, update)
    if (seq) mark(seq, Date.now())
    setCloudError(null)
  } catch (error) {
    logPending.unshift(update)
    const why = error instanceof Error ? error.message : String(error)
    if (why === NOT_MINE) { logPending = []; setForeign(true); return }
    setCloudError(why)
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
  if (untouched()) return
  const saving = revision
  // The board is claimed before anything is written about it, because everything written about it
  // is checked against the row the claim creates.
  const refused = await claim()
  await appendLog()
  const conflict = await merge()
  const { items, frames } = counts()
  const error = refused
    ?? conflict
    // The reading goes up with the bytes. A board is a CRDT and only a browser materialises one,
    // so anything outside — the API, an agent, a script — has no way to see what is on it. The
    // page markdown is written the same way and for the same reason: the copy is what a reader
    // that is not a browser gets, and it is exactly as old as the last time somebody had this
    // board open.
    ?? await pushSnapshot(
      room, Y.encodeStateAsUpdate(ydoc), items, frames,
      makeThumb(getItems()),
      graphToMarkdown(boardToGraph(getItems(), (getMeta().name as string) || 'Board')),
    )
  if (error) {
    // The row belongs to another account, so retrying is asking the same question for ever. The
    // board goes read-only and says why, which is the only thing left that helps.
    if (error === NOT_MINE) {
      logPending = []
      setForeign(true)
      setCloudError(null)
      dirty = false
      return
    }
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

// What an agent left on the row, drawn the first time somebody arrives. The order is the whole
// of it: parse, then claim the brief, then create. Parsing before the claim means a brief that
// cannot be read stays on the row for the next visitor, and claiming before the items are made
// means two tabs opening together draw one board rather than two overlapping ones.
//
// A brief can now arrive at a board that already has something on it, so where it lands and what
// it displaces are the brief's own to say. `replace` removes what a brief drew before — items
// carrying the mark, and nothing else, so a report can be published every sprint without taking
// anybody's notes with it. `append` draws below everything, because a second brief at the origin
// lands on top of the first and is not a board anybody can read.
export async function drawPendingBrief() {
  if (readOnly()) return
  const pending = await readPendingBrief(room)
  if (!pending) return
  const { brief, mode } = pending

  const [{ briefToItems }, { boundsOf }] = await Promise.all([
    import('./importer'),
    import('./geometry'),
  ])

  const standing = getItems()
  const drawnBefore = mode === 'replace'
    ? standing.filter((item) => item.via === DRAWN_BY_BRIEF)
    : []
  const keeping = standing.filter((item) => !drawnBefore.includes(item))

  // Where the last brief stood, if it is being taken back — a report that moves across the canvas
  // every time it is published is a report nobody keeps open. Otherwise below everything, because
  // a second brief at the origin lands on the first.
  const under = keeping.length ? boundsOf(keeping) : null
  const origin = drawnBefore.length
    ? { x: boundsOf(drawnBefore).x, y: boundsOf(drawnBefore).y }
    : { x: 0, y: under ? under.y + under.h + BRIEF_GAP : 0 }

  const { items, title } = briefToItems(brief, origin)
  if (!items.length) {
    await clearPendingBrief(room, brief)
    return
  }
  if (!await clearPendingBrief(room, brief)) return

  if (drawnBefore.length) removeItems(drawnBefore.map((item) => item.id))
  createItems(items.map((item) => ({ ...item, via: DRAWN_BY_BRIEF })))
  if (title && !getMeta().name) setMeta('name', title)
}

// IndexedDB answering is not the board arriving. On a browser that has never opened this board —
// a shared link, a second machine, a cleared profile — the local document is empty and correct,
// and everything on the board comes from the cloud a moment later. Anything drawing before then
// draws an empty board and corrects itself in front of the person watching.
//
// Resolved rather than pending when there is nothing to wait for, and resolved on failure too: a
// cloud that cannot be reached is a board to open and work in, not a reason to hold the screen.
let arrived: (() => void) | null = null
const arrival = new Promise<void>((done) => { arrived = done })
const nothingToWaitFor = () => { arrived?.(); arrived = null }
if (!supabase) nothingToWaitFor()

export const cloudArrival = () => arrival

// The cloud copy is merged, never assigned: a CRDT update applied on top of the local doc
// converges whatever each side missed while offline.
async function restore() {
  if (restored || restoring) return
  if (!getUser()) { nothingToWaitFor(); return }
  restoring = true
  try {
    if (!await loadWorkspace()) throw new Error('No workspace')
    const update = await pullSnapshot(room)
    stamp = await snapshotStamp(room)
    if (update?.length) Y.applyUpdate(ydoc, update, 'cloud')
    await catchUp()
    restored = true
    await drawPendingBrief()
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
    nothingToWaitFor()
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
