import * as Y from 'yjs'
import { Awareness } from 'y-protocols/awareness'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

interface Wire { k: string; d: string; id: string; i: number; n: number; r?: number }
type Handler = (message: { payload: unknown }) => void

interface Channel {
  handlers: Map<string, Handler>
  subscribed?: (status: string) => void
}

interface Peer {
  name: string
  doc: Y.Doc
  awareness: Awareness
  channel: Channel
  alive: boolean
}

interface Sent { from: Peer; wire: Wire }

const shared = vi.hoisted(() => ({
  room: 'stress',
  current: null as unknown,
  wires: [] as unknown[],
  row: { doc: null as string | null, stamp: 0 },
  log: [] as { seq: number; at: number; update: Uint8Array }[],
  seq: 0,
  ids: 0,
}))

const wires = shared.wires as Sent[]
const row = shared.row
const peers: Peer[] = []
let drop: (sent: Sent, to: Peer) => boolean = () => false
let briefToItems: typeof import('./importer').briefToItems

vi.mock('./store', () => ({ requestRender: () => {} }))
vi.mock('./access', () => ({ readOnly: () => false }))
vi.mock('./thumb', () => ({ makeThumb: () => 'thumb' }))
vi.mock('./storage', () => ({ BUCKET: 'board-images', storagePath: () => null }))
vi.mock('./workspace', () => ({ loadWorkspace: async () => ({ id: 'workspace-1' }) }))
// One bytea per board, overwritten whole, exactly as save_board_snapshot does it. The encoding
// is the real one, so a byte the transport mangles fails here and not in production.
vi.mock('./cloud', async () => {
  const actual = await vi.importActual<typeof import('./cloud')>('./cloud')
  return {
    ...actual,
    claimBoard: async () => null,
    sweepImages: async () => 0,
    pushSnapshot: async (_room: string, doc: Uint8Array) => {
      shared.row.doc = await actual.snapshotBase64(doc)
      shared.row.stamp += 1
      return null
    },
    pullSnapshot: async () => (
      shared.row.doc ? Uint8Array.from(atob(shared.row.doc), (c) => c.charCodeAt(0)) : null
    ),
    snapshotStamp: async () => (shared.row.doc ? String(shared.row.stamp) : null),
    // One row per update, numbered with no gaps, exactly as append_board_update does it.
    appendUpdate: async (_room: string, update: Uint8Array) => {
      if (update.length > 1_048_576) throw new Error('board_updates_size')
      shared.seq += 1
      shared.log.push({ seq: shared.seq, at: Date.now(), update })
      return shared.seq
    },
    pullUpdates: async (_room: string, after: number) => shared.log.filter((one) => one.seq > after),
    compactUpdates: async (_room: string, through: number) => {
      const before = shared.log.length
      shared.log = shared.log.filter((one) => one.seq > through)
      return before - shared.log.length
    },
  }
})
vi.mock('./supabase', async () => ({
  ...await vi.importActual<typeof import('./supabase')>('./supabase'),
  getUser: () => ({ id: 'user-1' }),
  subscribeAuth: () => {},
  supabase: {
    realtime: { setAuth: () => {} },
    channel: () => {
      const peer = shared.current as Peer
      const channel = {
        handlers: new Map<string, Handler>(),
        subscribed: undefined as ((status: string) => void) | undefined,
        on(type: string, filter: { event: string }, handler: Handler) {
          this.handlers.set(`${type}:${filter.event}`, handler)
          return this
        },
        subscribe(handler: (status: string) => void) {
          this.subscribed = handler
          return this
        },
        send(message: { payload: unknown }) {
          shared.wires.push({ from: peer, wire: message.payload })
          return Promise.resolve('ok')
        },
        track: () => Promise.resolve('ok'),
        presenceState: () => ({}),
        unsubscribe: () => Promise.resolve('ok'),
      }
      peer.channel = channel
      return channel
    },
  },
}))

const born: Peer[] = []

function make(name: string): Peer {
  const doc = new Y.Doc()
  const awareness = new Awareness(doc)
  awareness.setLocalState({ name })
  const peer: Peer = { name, doc, awareness, channel: null!, alive: true }
  born.push(peer)
  return peer
}

const settle = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }

// A hoisted vi.mock factory is evaluated once and reused, so every tab would end up sharing the
// first tab's document. doMock after resetModules gives each tab a factory closed over its own.
function bind(peer: Peer) {
  vi.resetModules()
  shared.current = peer
  vi.doMock('./doc', () => ({
    room: shared.room,
    provider: null,
    ydoc: peer.doc,
    awareness: peer.awareness,
    getItems: () => [...peer.doc.getMap('items').keys()].map((id) => ({ id, type: 'sticky' })),
    getMeta: () => ({ name: 'Stress', surface: 'paper' }),
    newId: () => `i${(shared.ids += 1).toString(36)}`,
    nextZ: () => (shared.ids += 1),
  }))
}

async function spawn(name: string) {
  const peer = make(name)
  bind(peer)
  const realtime = await import('./realtime')
  realtime.startRealtime()
  peer.channel.subscribed?.('SUBSCRIBED')
  peers.push(peer)
  return peer
}

async function tab(name: string) {
  const peer = make(name)
  bind(peer)
  const sync = await import('./sync')
  sync.startCloudSync()
  await settle()
  return { peer, sync }
}

// A real tab is both halves at once: the transport and the thing that writes the log.
async function both(name: string) {
  const peer = make(name)
  bind(peer)
  const sync = await import('./sync')
  const realtime = await import('./realtime')
  sync.startCloudSync()
  realtime.startRealtime()
  peer.channel.subscribed?.('SUBSCRIBED')
  peers.push(peer)
  await settle()
  return { peer, sync }
}

function pump() {
  for (let guard = 0; wires.length; guard++) {
    // A repair that answers itself would loop for ever; a bounded drain turns that into a
    // failure instead of a hung suite.
    if (guard > 20_000) throw new Error('broadcast storm')
    const sent = wires.shift()!
    for (const peer of peers) {
      if (peer === sent.from || !peer.alive) continue
      if (drop(sent, peer)) continue
      peer.channel.handlers.get('broadcast:y')?.({ payload: sent.wire })
    }
  }
}

async function tick(ms = 130) {
  await vi.advanceTimersByTimeAsync(ms)
  pump()
  await settle()
}

const brief = (n: number, notes = 6) => [
  `# Brief ${n}`,
  '',
  `## Section ${n}`,
  'Owner: Ada',
  '',
  ...Array.from({ length: notes }, (_, i) => `- [n${i}] Note ${n}.${i} with enough text to be real`),
  '',
  '## Flow',
  '',
  '```mermaid',
  'flowchart TD',
  '  n0["Note"]',
  '  n1["Note"]',
  '  n0 --> n1',
  '```',
].join('\n')

// The importer writes a whole brief in one transaction; that is the update the transport has to
// carry intact.
function importBrief(peer: Peer, n: number, notes = 6) {
  const { items } = briefToItems(brief(n, notes), { x: n * 3_000, y: 0 })
  const map = peer.doc.getMap<Y.Map<unknown>>('items')
  peer.doc.transact(() => {
    for (const item of items) map.set(item.id, new Y.Map(Object.entries(item)))
  })
  return items.length
}

const ids = (peer: Peer) => [...peer.doc.getMap('items').keys()].sort()

function rowItems() {
  if (!row.doc) return []
  const doc = new Y.Doc()
  Y.applyUpdate(doc, Uint8Array.from(atob(row.doc), (c) => c.charCodeAt(0)))
  return [...doc.getMap('items').keys()].sort()
}

beforeEach(async () => {
  vi.useFakeTimers()
  born.length = 0
  peers.length = 0
  wires.length = 0
  row.doc = null
  row.stamp = 0
  shared.log.length = 0
  shared.seq = 0
  drop = () => false
  bind(make('importer'))
  briefToItems = (await import('./importer')).briefToItems
})

afterEach(() => {
  for (const peer of born) { peer.awareness.destroy(); peer.doc.destroy() }
  vi.useRealTimers()
})

describe('three tabs importing at machine pace', () => {
  it('lands the same items in every surviving tab when one is killed', async () => {
    const a = await spawn('a')
    const b = await spawn('b')
    const c = await spawn('c')
    await tick()

    let written = 0
    for (let n = 0; n < 12; n++) {
      written += importBrief([a, b, c][n % 3], n)
      // Machine pace: three imports land inside a single 130ms flush window.
      if (n % 3 === 2) await tick()
    }
    await tick()

    // Killed after its last broadcast left, which is all a tab without acknowledgements can
    // promise. Its timers never fire again.
    c.alive = false

    for (let n = 12; n < 18; n++) {
      written += importBrief([a, b][n % 2], n)
      await tick()
    }
    await tick(15_000)

    expect(ids(a)).toHaveLength(written)
    expect(ids(b)).toEqual(ids(a))
  })

  it('carries an import too large for one broadcast message', async () => {
    const a = await spawn('a')
    const b = await spawn('b')
    await tick()

    const written = importBrief(a, 1, 900)
    let chunked = false
    drop = (sent) => { chunked ||= sent.wire.n > 1; return false }
    await tick()

    expect(chunked).toBe(true)
    expect(ids(b)).toHaveLength(written)
    expect(ids(b)).toEqual(ids(a))
  })

  it('repairs an import whose broadcast lost a chunk', async () => {
    const a = await spawn('a')
    const b = await spawn('b')
    await tick()

    let dropped = 0
    drop = (sent, to) => {
      const lose = to === b && sent.wire.k === 'u' && sent.wire.n > 1 && sent.wire.i === 1 && !dropped
      if (lose) dropped++
      return lose
    }

    const written = importBrief(a, 1, 900)
    await tick()
    expect(dropped).toBe(1)
    expect(ids(b)).toHaveLength(0)

    drop = () => false
    await tick(2_000)
    await tick(15_000)

    expect(ids(b)).toHaveLength(written)
    expect(ids(b)).toEqual(ids(a))
  })

  it('lets a tab that missed every broadcast catch up', async () => {
    const a = await spawn('a')
    const b = await spawn('b')
    await tick()

    drop = () => true
    const written = importBrief(a, 1) + importBrief(b, 2)
    await tick()
    expect(ids(a)).not.toEqual(ids(b))

    drop = () => false
    await tick(15_000)
    await tick(15_000)

    expect(ids(a)).toHaveLength(written)
    expect(ids(b)).toEqual(ids(a))
  })

  // A tab with no channel drops what it was about to broadcast, so the imports it took while
  // offline exist nowhere else until the two ends compare state vectors again.
  it('sends what a tab imported while its channel was down', async () => {
    const a = await spawn('a')
    const b = await spawn('b')
    await tick()

    b.channel.subscribed?.('CHANNEL_ERROR')
    const written = importBrief(a, 1) + importBrief(b, 2)
    await tick()
    expect(ids(a)).not.toEqual(ids(b))

    shared.current = b
    await tick(1_000)
    await tick(15_000)

    expect(ids(a)).toHaveLength(written)
    expect(ids(b)).toEqual(ids(a))
  })
})

describe('the snapshot row two tabs write to', () => {
  it('keeps both tabs when each saves a document the other never saw', async () => {
    const a = await tab('a')
    const b = await tab('b')

    // Realtime is down: neither document carries the other's import.
    const written = importBrief(a.peer, 1) + importBrief(b.peer, 2)

    await a.sync.flushCloud()
    await settle()
    await b.sync.flushCloud()
    await settle()

    expect(rowItems()).toHaveLength(written)
  })

  // The row is a compaction of the log, not the record. A row that never landed, or landed
  // holding an older document, costs a rewrite rather than the work it was missing.
  it('opens a board the row never held', async () => {
    const a = await both('a')
    const written = importBrief(a.peer, 1)
    await tick()
    await a.sync.flushCloud()
    await settle()

    row.doc = null
    const late = await tab('late')

    expect(shared.log.length).toBeGreaterThan(0)
    expect(ids(late.peer)).toHaveLength(written)
  })

  it('keeps what a row written from a stale tab left out', async () => {
    const a = await both('a')
    const b = await both('b')

    drop = () => true
    const written = importBrief(a.peer, 1) + importBrief(b.peer, 2)
    // Long enough for both tabs to have written to the log, and neither to have written the row.
    await tick(200)

    await a.sync.flushCloud()
    await settle()
    // Exactly what the round trip between the stamp and the write allows: a document with no
    // knowledge of b lands on top of one that had it.
    row.doc = await (await import('./cloud')).snapshotBase64(Y.encodeStateAsUpdate(a.peer.doc))
    row.stamp += 1

    drop = () => false
    const late = await tab('late')

    expect(ids(late.peer)).toHaveLength(written)
  })
})

describe('a tab that dies holding the only copy', () => {
  it('gives the board up to the log rather than to the tab that left', async () => {
    const a = await both('a')
    const b = await spawn('b')
    await tick()

    let dropped = 0
    drop = (sent, to) => {
      const lose = to === b && sent.wire.k === 'u' && sent.wire.n > 1 && sent.wire.i === 1 && !dropped
      if (lose) dropped++
      return lose
    }

    const written = importBrief(a.peer, 1, 900)
    await tick()
    expect(dropped).toBe(1)
    expect(ids(b)).toHaveLength(0)

    // The only tab that could answer a repair is gone, and its timers never fire again.
    a.peer.alive = false
    drop = () => false
    await tick(2_000)

    expect(ids(b)).toHaveLength(written)
  })
})

describe('an update queued as the channel goes', () => {
  it('is still sent when the channel comes back', async () => {
    const a = await spawn('a')
    const b = await spawn('b')
    await tick()

    // Queued, then the channel drops before the flush window closes.
    const written = importBrief(b, 1)
    b.channel.subscribed?.('CHANNEL_ERROR')
    await tick()
    expect(ids(a)).toHaveLength(0)

    // Only the queue can deliver this: the state-vector handshake is cut, so nothing depends on
    // another tab being there to answer for what this one was holding.
    drop = (sent) => sent.wire.k !== 'u'
    shared.current = b
    await tick(1_000)
    b.channel.subscribed?.('SUBSCRIBED')
    await tick()

    expect(ids(a)).toHaveLength(written)
  })
})

// The harness is only evidence if a tab that hears nothing really does diverge.
describe('the harness itself', () => {
  it('shows divergence when the transport is cut', async () => {
    const a = await spawn('a')
    const b = await spawn('b')
    await tick()

    drop = () => true
    importBrief(a, 1)
    await tick()

    expect(ids(a).length).toBeGreaterThan(0)
    expect(ids(b)).toHaveLength(0)
  })
})
