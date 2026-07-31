import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Awareness } from 'y-protocols/awareness'
import { authReady, getUser, supabase } from './supabase'

// The name BlockNote gives its own fragment. Matching it means the library's own conversion
// helpers work on our documents without being told where to look.
const FRAGMENT = 'prosemirror'

const SAVE_AFTER = 2000

let doc = new Y.Doc()
let awareness = new Awareness(doc)
let persistence: IndexeddbPersistence | null = null
let current = ''
let opening: Promise<void> = Promise.resolve()
let saving = 0
let dirty = false

export const pageFragment = () => doc.getXmlFragment(FRAGMENT)
export const pageAwareness = () => awareness

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
  const [id, saved] = [current, doc]
  dirty = false
  await supabase.from('record_docs').upsert({
    record_id: id,
    doc: hex(Y.encodeStateAsUpdate(saved)),
    updated_at: new Date().toISOString(),
  })
}

function schedule() {
  dirty = true
  if (saving || !getUser()) return
  saving = window.setTimeout(() => void push(), SAVE_AFTER)
}

// Both copies are merged into the document rather than assigned, so a page written offline on
// one machine and online on another converges instead of one side winning.
//
// The editor is not built until this resolves. y-prosemirror does read a fragment that already
// has content, so a later arrival would not be lost, but an editor mounted on an empty document
// writes an empty paragraph into it first, and that paragraph then outlives the page.
async function load(id: string) {
  const mine = doc
  const store = new IndexeddbPersistence(`tuval:doc:${id}`, mine)
  persistence = store
  await Promise.all([store.whenSynced, authReady])
  const stored = await pull(id)
  if (stored?.length && doc === mine) Y.applyUpdate(mine, stored, 'cloud')
  mine.on('update', (_u: Uint8Array, origin: unknown) => {
    if (origin !== 'cloud') schedule()
  })
}

export function openPage(id: string): Promise<void> {
  if (current === id) return opening
  if (current) {
    void push()
    void persistence?.destroy()
    persistence = null
    awareness.destroy()
    doc.destroy()
    doc = new Y.Doc()
    awareness = new Awareness(doc)
  }
  current = id
  opening = load(id)
  return opening
}

addEventListener('pagehide', () => { void push() })
