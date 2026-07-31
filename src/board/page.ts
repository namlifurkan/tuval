import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Awareness } from 'y-protocols/awareness'
import type { Provider } from '@lexical/yjs'
import { getUser, supabase } from './supabase'

// A page has its own document, the way a board does. Switching to one is a navigation, so it is
// bound at load and never has to share a module with another.
export const pageDoc = new Y.Doc()

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
  dirty = false
  await supabase.from('record_docs').upsert({
    record_id: current,
    doc: hex(Y.encodeStateAsUpdate(pageDoc)),
    updated_at: new Date().toISOString(),
  })
}

function schedule() {
  dirty = true
  if (saving || !getUser()) return
  saving = window.setTimeout(() => void push(), SAVE_AFTER)
}

// The editor binds to an empty document and the content arrives afterwards, as updates. That
// order matters: a binding only learns about content through change events, so anything loaded
// before it exists is content the editor never hears about. A network provider behaves this
// way by nature; local storage has to be made to.
//
// The stored copy is merged rather than assigned, so a page written offline on one machine and
// online on another converges instead of one side winning.
export function openPage(id: string) {
  if (current === id) return
  current = id

  persistence = new IndexeddbPersistence(`tuval:doc:${id}`, pageDoc)
  void persistence.whenSynced.then(() => pull(id)).then((stored) => {
    if (stored?.length) Y.applyUpdate(pageDoc, stored, 'cloud')
  })

  pageDoc.on('update', (_u: Uint8Array, origin: unknown) => {
    if (origin !== 'cloud') schedule()
  })

  addEventListener('pagehide', () => { void push() })
}

// Lexical's collaboration plugin wants a provider even when there is nobody else connected:
// it is what binds the editor to a document. The document has to be put into the map it is
// given, or the plugin makes one of its own and everything typed goes into a doc that is never
// stored. Sharing a page live comes next, over the same channel boards use.
// Lexical reads what is already in the document only when the provider says it has synced.
// A provider that never says so leaves the editor empty, and the empty editor is then written
// back over the page. So this one is a real, if very small, provider: it has nothing to
// connect to, and it does have to announce that it is ready.
//
// The awareness cast is the seam where y-protocols' generic state meets the shape Lexical
// keeps in it. Lexical is the only thing writing that state.
export function localProvider(id: string, docs: Map<string, Y.Doc>): Provider {
  docs.set(id, pageDoc)

  const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  let synced = false

  const emit = (event: string, ...args: unknown[]) => {
    handlers.get(event)?.forEach((fn) => fn(...args))
  }

  return {
    awareness: new Awareness(pageDoc) as unknown as Provider['awareness'],
    connect: () => {
      synced = true
      emit('status', { status: 'connected' })
      emit('sync', true)
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
