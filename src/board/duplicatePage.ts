import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { getPages, loadPages } from './records'
import type { Record as Row } from './records'
import { getWorkspace } from './workspace'
import { getUser, supabase } from './supabase'

const hex = (bytes: Uint8Array) =>
  `\\x${[...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')}`

const unhex = (raw: string) => {
  const body = raw.slice(2)
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16)
  return out
}

// Reading a page that is not the one on screen: whatever this browser has, topped up from the
// server. Either may be missing on its own, so both are tried.
async function readBody(id: string): Promise<Uint8Array | null> {
  const doc = new Y.Doc()
  const local = new IndexeddbPersistence(`tuval:doc:${id}`, doc)
  await local.whenSynced
  if (supabase && getUser()) {
    const { data } = await supabase
      .from('record_docs').select('doc').eq('record_id', id).maybeSingle()
    const raw = data?.doc as string | undefined
    if (raw?.startsWith('\\x')) Y.applyUpdate(doc, unhex(raw), 'cloud')
  }
  const update = Y.encodeStateAsUpdate(doc)
  await local.destroy()
  doc.destroy()
  return update.length ? update : null
}

// A copy is the page and everything under it, because half a subtree is not a copy of anything.
// Depth first, so a child is made after the parent whose new id it needs.
async function copyOne(row: Row, parent: string | null, title: string): Promise<string | null> {
  const ws = getWorkspace()
  if (!supabase || !ws) return null

  const { data, error } = await supabase.from('records').insert({
    workspace_id: ws.id,
    kind: row.kind,
    title,
    description: row.description,
    icon: row.icon,
    // The cover object is shared rather than copied: both pages are in the same workspace, so
    // the same people may read it, and a second file would only be a second thing to pay for.
    cover: row.cover,
    parent_id: parent,
    status: row.status,
    priority: row.priority,
    due_at: row.due_at,
    position: row.position,
    data: row.data,
    created_by: getUser()?.id ?? null,
  }).select('id').single()
  if (error || !data) return null

  const made = (data as { id: string }).id
  const body = await readBody(row.id)
  if (body?.length) {
    await supabase.from('record_docs').insert({ record_id: made, doc: hex(body) })
  }
  return made
}

// The root of the copy can be given a different name, a different parent and different data.
// Corrected at creation rather than patched afterwards: the new page is opened immediately, and
// a page that loads itself from the server would read the state the patch has not reached yet.
export interface Override {
  title?: string
  parent?: string | null
  data?: { [key: string]: unknown }
}

export async function duplicatePage(id: string, over: Override = {}): Promise<string | null> {
  const rows = getPages()
  const source = rows.find((r) => r.id === id)
  if (!source) return null

  const made = await copyOne(
    { ...source, ...(over.data ? { data: over.data } : {}) },
    over.parent === undefined ? source.parent_id : over.parent,
    over.title ?? `${source.title || 'Untitled'} (copy)`,
  )
  if (!made) return null

  // Breadth first from the top, keeping a map from the old id to the new one so each child is
  // hung off the copy of its own parent rather than off the root.
  const renamed = new Map<string, string>([[id, made]])
  const queue = [id]
  while (queue.length) {
    const at = queue.shift()!
    for (const child of rows.filter((r) => r.parent_id === at)) {
      const copy = await copyOne(child, renamed.get(at)!, child.title)
      if (!copy) continue
      renamed.set(child.id, copy)
      queue.push(child.id)
    }
  }

  await loadPages()
  return made
}
