import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Awareness } from 'y-protocols/awareness'
import type { Provider } from '@lexical/yjs'
import { authReady, getUser, supabase } from './supabase'

// A page has its own document, the way a board does. Moving between pages no longer reloads,
// so each one gets a fresh document and the one it replaces is torn down.
let pageDoc = new Y.Doc()
export const getPageDoc = () => pageDoc

let persistence: IndexeddbPersistence | null = null
let saving = 0
let dirty = false
let current = ''

const SAVE_AFTER = 2000

const hex = (bytes: Uint8Array) =>
  `\\x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`

async function pull(id: string): Promise<Uint8Array | null> {
  if (!supabase || !getUser()) return null
  const { data } = await supabase
    .from('record_docs').select('doc').eq('record_id', id).maybeSingle()
  const raw = data?.doc as string | undefined
  if (!raw?.startsWith('\\x')) return null
  const body = raw.slice(2)
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16)
  return out
}

async function push() {
  saving = 0
  if (!dirty || !current || !supabase || !getUser()) return
  const [id, doc] = [current, pageDoc]
  dirty = false
  await supabase.from('record_docs').upsert({
    record_id: id,
    doc: hex(Y.encodeStateAsUpdate(doc)),
    updated_at: new Date().toISOString(),
  })
}

function schedule() {
  dirty = true
  if (saving || !getUser()) return
  saving = window.setTimeout(() => void push(), SAVE_AFTER)
}

export function openPage(id: string) {
  if (current === id) return
  if (current) {
    void push()
    void persistence?.destroy()
    persistence = null
    pageDoc.destroy()
    pageDoc = new Y.Doc()
  }
  current = id

  pageDoc.on('update', (_u: Uint8Array, origin: unknown) => {
    if (origin !== 'cloud') schedule()
  })
}

// The editor binds to an empty document and the content arrives afterwards, as updates. That
// order matters: a binding only learns about content through change events, so anything loaded
// before it exists is content the editor never hears about. A network provider behaves this way
// by nature; storage has to be made to, which is why nothing is read until the editor connects.
//
// The stored copy is merged rather than assigned, so a page written offline on one machine and
// online on another converges instead of one side winning.
async function load(id: string, doc: Y.Doc) {
  const store = persistence ?? (persistence = new IndexeddbPersistence(`tuval:doc:${id}`, doc))
  // Restoring a session is asynchronous, and a pull that runs before it finishes runs signed
  // out: the row is there, the reader is nobody, and the page comes back blank.
  await Promise.all([store.whenSynced, authReady])
  const stored = await pull(id)
  if (stored?.length && doc === pageDoc) Y.applyUpdate(doc, stored, 'cloud')
}

addEventListener('pagehide', () => { void push() })

// Lexical's collaboration plugin wants a provider even when there is nobody else connected:
// it is what binds the editor to a document. The document has to be put into the map it is
// given, or the plugin makes one of its own and everything typed goes into a doc that is never
// stored. Sharing a page live comes next, over the same channel boards use.
// Announcing a sync is also what tells Lexical the document is worth reading, and an empty
// document at that moment gets an empty paragraph written into it. So the announcement waits
// for storage: connect, read, then say so. Saying it first would put a blank paragraph in front
// of the page on every single load.
//
// The awareness cast is the seam where y-protocols' generic state meets the shape Lexical
// keeps in it. Lexical is the only thing writing that state.
export function localProvider(id: string, docs: Map<string, Y.Doc>): Provider {
  const doc = pageDoc
  docs.set(id, doc)

  const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  let synced = false

  const emit = (event: string, ...args: unknown[]) => {
    handlers.get(event)?.forEach((fn) => fn(...args))
  }

  return {
    awareness: new Awareness(doc) as unknown as Provider['awareness'],
    connect: () => {
      emit('status', { status: 'connected' })
      return load(id, doc).then(() => {
        synced = true
        emit('sync', true)
      })
    },
    disconnect: () => { synced = false },
    // Registering after connect is as likely as before it, so a late listener is told at once
    // rather than waiting for a signal that has already been given.
    on: (event: string, fn: (...args: unknown[]) => void) => {
      if (!handlers.has(event)) handlers.set(event, new Set())
      handlers.get(event)!.add(fn)
      if (event === 'sync' && synced) fn(true)
    },
    off: (event: string, fn: (...args: unknown[]) => void) => {
      handlers.get(event)?.delete(fn)
    },
  } as unknown as Provider
}
