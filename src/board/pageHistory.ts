import { nanoid } from 'nanoid'
import { pageDoc } from './page'
import { displayName, getUser } from './supabase'

export interface Version {
  id: string
  at: number
  by: string
  label: string
  blocks: number
}

interface Stored extends Version {
  // BlockNote's own document shape. Kept as blocks rather than as a Yjs update because putting
  // a copy of a document inside itself is how a document doubles in size every time.
  doc: unknown
}

const MAX = 20
const AUTO_AFTER = 10 * 60 * 1000

const map = () => pageDoc().getMap<Stored>('versions')

export function getVersions(): Version[] {
  const list: Version[] = []
  map().forEach((v) => list.push({ id: v.id, at: v.at, by: v.by, label: v.label, blocks: v.blocks }))
  return list.sort((a, b) => b.at - a.at)
}

export function subscribeVersions(fn: () => void) {
  const held = map()
  held.observe(fn)
  return () => held.unobserve(fn)
}

export function saveVersion(label: string, doc: unknown[]): Version {
  const made: Stored = {
    id: nanoid(10),
    at: Date.now(),
    by: displayName(getUser()?.email) || 'Anonymous',
    label,
    blocks: doc.length,
    doc,
  }
  const held = map()
  held.set(made.id, made)

  // Oldest first out. Twenty is what a person scrolls; keeping every one of them would make the
  // page carry its whole past into every load.
  const all = getVersions()
  for (const old of all.slice(MAX)) held.delete(old.id)

  const { doc: _kept, ...out } = made
  return out
}

export const versionDoc = (id: string) => map().get(id)?.doc as unknown[] | undefined

export function deleteVersion(id: string) {
  map().delete(id)
}

// A page saves itself when it has been left alone for a while and has changed since the last
// time, so the list is a record of sittings rather than of keystrokes.
export function maybeAutoSave(doc: unknown[]) {
  const last = getVersions()[0]
  if (last && Date.now() - last.at < AUTO_AFTER) return
  if (!doc.length) return
  saveVersion('', doc)
}
