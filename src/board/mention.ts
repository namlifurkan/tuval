import * as Y from 'yjs'
import { supabase } from './supabase'

export const MENTION = 'mention'

// A mention lives in the document, which the server cannot read. Backlinks are a question asked
// of the server — "what points here" — so the answer is kept beside the document as rows.
//
// Reconciled rather than appended: writing a link and deleting it again should leave nothing,
// and the document is the truth about what it mentions.
export async function linkMentions(from: string, doc: Y.Doc) {
  if (!supabase) return
  const wanted = mentionsIn(doc)

  const { data } = await supabase
    .from('record_links').select('to_id').eq('from_id', from).eq('kind', 'mentions')
  const had = new Set((data ?? []).map((r) => r.to_id as string))

  const gone = [...had].filter((id) => !wanted.has(id))
  const fresh = [...wanted].filter((id) => !had.has(id))
  if (!gone.length && !fresh.length) return

  await Promise.all([
    gone.length
      ? supabase.from('record_links').delete()
        .eq('from_id', from).eq('kind', 'mentions').in('to_id', gone)
      : null,
    fresh.length
      ? supabase.from('record_links')
        .insert(fresh.map((to) => ({ from_id: from, to_id: to, kind: 'mentions' })))
      : null,
  ])
}

// Walking the shared type rather than the editor: saving happens whether or not an editor is
// mounted, and a document that arrived from somebody else has mentions too.
export function mentionsIn(doc: Y.Doc): Set<string> {
  const found = new Set<string>()
  const walk = (node: Y.XmlElement | Y.XmlFragment | Y.XmlText | Y.XmlHook) => {
    if (node instanceof Y.XmlElement) {
      if (node.nodeName === MENTION) {
        const id = node.getAttribute('pageId')
        if (id) found.add(id)
      }
      node.toArray().forEach(walk)
    } else if (node instanceof Y.XmlFragment) {
      node.toArray().forEach(walk)
    } else if (node instanceof Y.XmlText) {
      for (const delta of node.toDelta() as { insert?: unknown }[]) {
        const insert = delta.insert
        if (insert instanceof Y.XmlElement) walk(insert)
      }
    }
  }
  walk(doc.getXmlFragment('prosemirror'))
  return found
}

export interface Backlink { id: string; title: string }

export async function backlinks(to: string): Promise<Backlink[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('record_links')
    .select('from_id, records!record_links_from_id_fkey (id, title, archived_at)')
    .eq('to_id', to).eq('kind', 'mentions')
  // PostgREST returns an embedded row as an object or as an array depending on how it reads the
  // relationship, and it has been both here before. Both are accepted rather than guessed at.
  type Side = { id: string; title: string; archived_at: string | null }
  return ((data ?? []) as { records?: Side | Side[] | null }[])
    .flatMap((r) => (Array.isArray(r.records) ? r.records : r.records ? [r.records] : []))
    .filter((r) => !r.archived_at)
    .map((r) => ({ id: r.id, title: r.title }))
}
