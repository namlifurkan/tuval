import * as Y from 'yjs'
import { applyAwarenessUpdate, encodeAwarenessUpdate, removeAwarenessStates } from 'y-protocols/awareness'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { awareness, provider, room, ydoc } from './doc'
import { requestRender } from './store'
import { getUser, subscribeAuth, supabase } from './supabase'

const ORIGIN = 'realtime'
const FLUSH = 130
const CHUNK = 150_000

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

const parts = new Map<string, { got: string[]; left: number; k: Kind; r?: number }>()
const clientOf = new Map<string, number>()

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

function flush() {
  timer = 0
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
    slot = { got: new Array<string>(w.n).fill(''), left: w.n, k: w.k, r: w.r }
    parts.set(w.id, slot)
  }
  if (slot.got[w.i]) return
  slot.got[w.i] = w.d
  if (--slot.left) return
  parts.delete(w.id)
  handle(slot.k, decode(slot.got.join('')), slot.r)
}

// The channel is private: realtime.messages carries its own RLS, checked against the same
// can_read_board / can_write_board the tables use. A public channel would hand the live
// document to anyone who knows the room id, including somebody just removed from the board.
function connect() {
  if (!supabase || provider || channel || !getUser()) return

  void supabase.realtime.setAuth()

  channel = supabase.channel(`board:${room}`, {
    config: {
      private: true,
      broadcast: { self: false },
      presence: { key: String(awareness.clientID) },
    },
  })

  channel.on('broadcast', { event: 'y' }, ({ payload }) => receive(payload as Wire))

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel!.presenceState()
    clientOf.clear()
    for (const key of Object.keys(state)) clientOf.set(key, Number(key))
  })

  channel.on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
    const id = clientOf.get(key) ?? Number(key)
    if (Number.isFinite(id) && id !== awareness.clientID) {
      removeAwarenessStates(awareness, [id], ORIGIN)
      requestRender()
    }
  })

  void channel.subscribe((status) => {
    if (status !== 'SUBSCRIBED') return
    void channel!.track({ c: awareness.clientID })
    send('sv', Y.encodeStateVector(ydoc))
    awarePending = true
    schedule()
  })
}

function disconnect() {
  if (!channel) return
  removeAwarenessStates(awareness, [awareness.clientID], ORIGIN)
  void channel.unsubscribe()
  channel = null
  pending = []
  parts.clear()
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

export const realtimeOn = () => !!channel
