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
let damaged = ''

// The stored bytes of a page that would not decode, kept so they can be handed to whoever wants
// to look at them. Empty means the page came back whole.
export const pageDamage = () => damaged

// Saving is off while a page is damaged, and turning it back on is somebody's decision, not
// ours. What is on screen replaces the stored copy from here on.
export function overwriteDamagedPage() {
  if (!damaged) return
  damaged = ''
  schedule()
}

export const pageDoc = () => doc
export const pageFragment = () => doc.getXmlFragment(FRAGMENT)
export const pageAwareness = () => awareness

export const hex = (bytes: Uint8Array) =>
  `\\x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`

// No account needed to ask. A published page is readable by anybody, and the policy is what
// decides that — requiring a signed-in user here would have meant a published page with a title
// and nothing under it.
//
// The bytes come back undecoded: a page the network refused and a page whose stored bytes are
// damaged are two different accidents, and only the first is worth retrying.
async function pull(id: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase
    .from('record_docs').select('doc').eq('record_id', id).maybeSingle()
  if (error) throw new Error('That page could not be loaded.')
  return (data?.doc as string | undefined) ?? null
}

export function decodePageDoc(raw: string): Uint8Array {
  if (!/^\\x(?:[0-9a-f]{2})*$/i.test(raw)) throw new Error('The stored page is damaged.')
  const body = raw.slice(2)
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16)
  return out
}

// One bad byte used to be a page that never opened and never said why. It opens now, holding
// however much of itself Yjs could read before the damage — which for a document appended to all
// afternoon is nearly all of it, because the damage is usually at the end.
//
// Returns whether the stored copy went in whole. It matters more than it looks: the caller must
// not save over bytes it could not read. An empty editor mounted on a page that failed to load
// is indistinguishable from an empty page, and two seconds later it would have written that
// emptiness back and turned a recoverable file into a lost one.
export function applyStoredPage(into: Y.Doc, raw: string): boolean {
  try {
    Y.applyUpdate(into, decodePageDoc(raw), 'cloud')
    return true
  } catch {
    return false
  }
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
  if (!dirty || !current || !supabase || !getUser() || damaged) return
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
  if (saving || !getUser() || damaged) return
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
  damaged = ''
  await Promise.all([store.whenSynced, authReady])
  const stored = await pull(id)
  if (stored && doc === mine && !applyStoredPage(mine, stored)) damaged = stored
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
