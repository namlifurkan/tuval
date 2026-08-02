import * as Y from 'yjs'
import { applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { awareness, provider, room, ydoc } from './doc'
import { requestRender } from './store'
import { getUser, subscribeAuth, supabase } from './supabase'
import { catchUp } from './sync'

const ORIGIN = 'realtime'
const FLUSH = 130
const CHUNK = 150_000
const RETRY_MAX = 15_000
const PART_WAIT = 2_000
const RESYNC_AFTER = 15_000

type Kind = 'u' | 'a' | 'sv' | 'd'
interface Wire { k: Kind; d: string; id: string; i: number; n: number; r?: number }

const encode = (bytes: Uint8Array) => {
  let out = ''
  for (let i = 0; i < bytes.length; i += 8192) {
    out += String.fromCharCode(...bytes.subarray(i, i + 8192))
  }
  return btoa(out)
}

const decode = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0))

let channel: RealtimeChannel | null = null
let pending: Uint8Array[] = []
let awarePending = false
let timer = 0
let seq = 0
let connected = false
let retryTimer = 0
let retryCount = 0
let resyncTimer = 0
const connectionListeners = new Set<() => void>()

const parts = new Map<string, {
  got: string[]; left: number; k: Kind; r?: number; timer: number
}>()
const clientOf = new Map<string, number>()

function setConnected(next: boolean) {
  if (connected === next) return
  connected = next
  connectionListeners.forEach((listener) => listener())
}

function retry() {
  if (retryTimer || !getUser()) return
  const delay = Math.min(RETRY_MAX, 1000 * 2 ** retryCount++)
  retryTimer = window.setTimeout(() => {
    retryTimer = 0
    connect()
  }, delay)
}

function clearParts() {
  for (const slot of parts.values()) window.clearTimeout(slot.timer)
  parts.clear()
}

function resyncLater() {
  if (resyncTimer || !channel || !connected) return
  resyncTimer = window.setTimeout(() => {
    resyncTimer = 0
    if (!channel || !connected) return
    // shortcut: Realtime broadcast has no delivery acknowledgements. A periodic state-vector
    // exchange repairs a completely dropped message; upgrade to an acknowledged transport if
    // boards ever need sub-second delivery guarantees across unreliable networks.
    send('sv', Y.encodeStateVector(ydoc), 1)
    resyncLater()
  }, RESYNC_AFTER)
}

function send(k: Kind, bytes: Uint8Array, r?: number) {
  if (!channel) return
  const body = encode(bytes)
  const id = `${awareness.clientID}-${seq++}`
  const n = Math.max(1, Math.ceil(body.length / CHUNK))
  for (let i = 0; i < n; i++) {
    const payload: Wire = { k, d: body.slice(i * CHUNK, (i + 1) * CHUNK), id, i, n, r }
    void channel.send({ type: 'broadcast', event: 'y', payload })
  }
}

// Nothing is dropped for want of a channel: what was queued as it went waits here, and the
// subscribe handler schedules another flush the moment there is somewhere to send it.
function flush() {
  timer = 0
  if (!channel) return
  if (pending.length) {
    send('u', pending.length === 1 ? pending[0] : Y.mergeUpdates(pending))
    pending = []
  }
  if (awarePending) {
    awarePending = false
    send('a', encodeAwarenessUpdate(awareness, [awareness.clientID]))
  }
}

// Supabase Realtime meters messages per second, so updates are merged into one message per
// tick instead of one per keystroke or drag frame.
function schedule() {
  if (!timer) timer = window.setTimeout(flush, FLUSH)
}

function handle(k: Kind, bytes: Uint8Array, r?: number) {
  if (k === 'u' || k === 'd') {
    Y.applyUpdate(ydoc, bytes, ORIGIN)
    requestRender()
    return
  }
  if (k === 'a') {
    applyAwarenessUpdate(awareness, bytes, ORIGIN)
    requestRender()
    return
  }
  send('d', Y.encodeStateAsUpdate(ydoc, bytes))
  if (!r) send('sv', Y.encodeStateVector(ydoc), 1)
}

function receive(w: Wire) {
  if (w.n === 1) { handle(w.k, decode(w.d), w.r); return }
  let slot = parts.get(w.id)
  if (!slot) {
    const timer = window.setTimeout(() => {
      const incomplete = parts.get(w.id)
      if (!incomplete) return
      parts.delete(w.id)
      // Asking for the current diff repairs the edit whose broadcast lost one of its chunks —
      // but only while the tab that sent it is still there to answer. The log answers either way.
      send('sv', Y.encodeStateVector(ydoc), 1)
      void catchUp().catch(() => {})
    }, PART_WAIT)
    slot = { got: new Array<string>(w.n).fill(''), left: w.n, k: w.k, r: w.r, timer }
    parts.set(w.id, slot)
  }
  if (slot.got[w.i]) return
  slot.got[w.i] = w.d
  if (--slot.left) return
  parts.delete(w.id)
  window.clearTimeout(slot.timer)
  handle(slot.k, decode(slot.got.join('')), slot.r)
}

// The channel is private: realtime.messages carries its own RLS, checked against the same
// can_read_board / can_write_board the tables use. A public channel would hand the live
// document to anyone who knows the room id, including somebody just removed from the board.
function connect() {
  if (!supabase || provider || channel || !getUser()) return

  void supabase.realtime.setAuth()

  const next = supabase.channel(`board:${room}`, {
    config: {
      private: true,
      broadcast: { self: false },
      presence: { key: String(awareness.clientID) },
    },
  })
  channel = next

  next.on('broadcast', { event: 'y' }, ({ payload }) => receive(payload as Wire))

  next.on('presence', { event: 'sync' }, () => {
    const state = next.presenceState()
    clientOf.clear()
    for (const key of Object.keys(state)) clientOf.set(key, Number(key))
  })

  next.on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
    const id = clientOf.get(key) ?? Number(key)
    if (Number.isFinite(id) && id !== awareness.clientID) {
      removeAwarenessStates(awareness, [id], ORIGIN)
      requestRender()
    }
  })

  void next.subscribe((status) => {
    if (channel !== next) return
    if (status === 'SUBSCRIBED') {
      retryCount = 0
      setConnected(true)
      void next.track({ c: awareness.clientID })
      send('sv', Y.encodeStateVector(ydoc))
      awarePending = true
      schedule()
      resyncLater()
      void catchUp().catch(() => {})
      return
    }
    if (!['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED'].includes(status)) return
    setConnected(false)
    if (resyncTimer) window.clearTimeout(resyncTimer)
    resyncTimer = 0
    clearParts()
    channel = null
    void next.unsubscribe()
    retry()
  })
}

function disconnect() {
  if (retryTimer) window.clearTimeout(retryTimer)
  retryTimer = 0
  retryCount = 0
  if (resyncTimer) window.clearTimeout(resyncTimer)
  resyncTimer = 0
  setConnected(false)
  if (!channel) return
  const old = channel
  channel = null
  removeAwarenessStates(awareness, [awareness.clientID], ORIGIN)
  void old.unsubscribe()
  pending = []
  clearParts()
  clientOf.clear()
}

export function startRealtime() {
  if (!supabase || provider) return

  ydoc.on('update', (update: Uint8Array, origin: unknown) => {
    if (!channel || origin === ORIGIN || origin === 'cloud') return
    pending.push(update)
    schedule()
  })

  awareness.on('update', (_changes: unknown, origin: unknown) => {
    if (!channel || origin === ORIGIN) return
    awarePending = true
    schedule()
  })

  addEventListener('pagehide', disconnect)
  connect()
  subscribeAuth(() => { if (getUser()) connect(); else disconnect() })
}

export const realtimeOn = () => connected
export const subscribeRealtime = (listener: () => void) => {
  connectionListeners.add(listener)
  return () => { connectionListeners.delete(listener) }
}
