import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { Awareness } from 'y-protocols/awareness'
import { linkMentions, peopleIn } from './mention'
import { notifyMentions } from './notifications'
import { authReady, getUser, supabase } from './supabase'

// The name BlockNote gives its own fragment. Matching it means the library's own conversion
// helpers work on our documents without being told where to look.
export const FRAGMENT = 'prosemirror'

const SAVE_AFTER = 2000

let doc = new Y.Doc()
let awareness = new Awareness(doc)
let persistence: IndexeddbPersistence | null = null
let current = ''
let opening: Promise<void> = Promise.resolve()
let saving = 0
let dirty = false

export const pageDoc = () => doc
export const pageFragment = () => doc.getXmlFragment(FRAGMENT)
export const pageAwareness = () => awareness

export const hex = (bytes: Uint8Array) =>
  `\\x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`

// No account needed to ask. A published page is readable by anybody, and the policy is what
// decides that — requiring a signed-in user here would have meant a published page with a title
// and nothing under it.
async function pull(id: string): Promise<Uint8Array | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('record_docs').select('doc').eq('record_id', id).maybeSingle()
  if (error) throw new Error('That page could not be loaded.')
  const raw = data?.doc as string | undefined
  if (!raw) return null
  return decodePageDoc(raw)
}

export function decodePageDoc(raw: string): Uint8Array {
  if (!/^\\x(?:[0-9a-f]{2})*$/i.test(raw)) throw new Error('The stored page is damaged.')
  const body = raw.slice(2)
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16)
  return out
}

// The words in a page, flattened so the server can index what it cannot read. Walked from the
// shared type rather than the editor, because saving happens whether or not one is mounted.
export function textOf(from: Y.Doc): string {
  const parts: string[] = []
  const walk = (node: Y.XmlElement | Y.XmlFragment | Y.XmlText | Y.XmlHook) => {
    if (node instanceof Y.XmlText) parts.push(node.toString().replace(/<[^>]*>/g, ' '))
    else if (node instanceof Y.XmlElement || node instanceof Y.XmlFragment) node.toArray().forEach(walk)
  }
  walk(from.getXmlFragment(FRAGMENT))
  return parts.join(' ').replace(/\s+/g, ' ').trim().slice(0, 20000)
}

// The editor on screen is the only thing that can turn this document into markdown, and it is
// also the only thing that can have changed it. So it lends the ability while it is mounted and
// takes it back when it goes.
let toMarkdown: (() => string | Promise<string>) | null = null

export function lendMarkdown(make: (() => string | Promise<string>) | null) {
  toMarkdown = make
}

async function push() {
  saving = 0
  if (!dirty || !current || !supabase || !getUser()) return
  const [id, saved] = [current, doc]
  const at = new Date().toISOString()
  dirty = false
  await Promise.all([
    supabase.from('record_docs').upsert({ record_id: id, doc: hex(Y.encodeStateAsUpdate(saved)), updated_at: at }),
    // Writing the body is editing the page. Without this the record keeps the timestamp of the
    // last time somebody changed its title, and a page written all afternoon looks untouched.
    supabase.from('records').update({
      updated_at: at,
      body: textOf(saved),
      // Left alone rather than blanked when no editor is mounted: a stale rendition of the page
      // is worth more to whoever asks than nothing at all.
      ...(toMarkdown ? { markdown: (await Promise.resolve(toMarkdown()).catch(() => '')).slice(0, 200_000) } : {}),
    }).eq('id', id),
    linkMentions(id, saved),
    notifyMentions(id, peopleIn(saved)),
  ])
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

export function openPage(id: string, retry = false): Promise<void> {
  if (current === id && !retry) return opening
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

// The same guard doc.ts carries, for the same reason: this module holds one Y.Doc and one
// persistence handle, and a hot replacement makes a second of each while the editor on screen
// is still bound to the first. The page then looks empty although nothing was lost.
if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot!.invalidate())
}
