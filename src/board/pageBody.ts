import * as Y from 'yjs'
import { bodyOf } from './notion'
import { FRAGMENT, openPage, pageDamage, pageDoc } from './page'
import { patchRecord } from './records'
import { supabase } from './supabase'

// A page's text lives in a CRDT the server cannot read. `description` is the one column outside
// it that becomes page text, and it has two jobs.
//
// The first is history. An issue used to keep its description in that column, as one flat
// string; it keeps it in the same document a page uses now, so it can hold headings, code,
// checklists and comments. The column is not dropped and forgotten — the first time such an
// issue is opened, the text becomes paragraphs in the body and the column is cleared.
//
// The second is the door. The HTTP API and the MCP server cannot touch the document, so prose
// written from outside waits in the same column, and the same fold carries it in. That is why
// this runs for every page rather than only for issues, and why it appends to a page that is
// already written instead of throwing the text away: a paragraph that arrived after somebody
// started writing is not stale, it is new.
export async function openRecordBody(id: string, retry = false): Promise<void> {
  const [, held] = await Promise.all([openPage(id, retry), pending(id)])
  if (!held) return
  // The fold is one-way: the column is cleared once the text is in the document. On a page whose
  // stored copy is damaged the document is not being saved, so clearing the column would move
  // the text from somewhere to nowhere. It waits for the next open instead.
  if (pageDamage()) return

  const made = bodyOf(held)
  if (made) append(pageDoc(), made.update)
  patchRecord(id, { description: '' })
}

async function pending(id: string): Promise<string> {
  if (!supabase) return ''
  const { data } = await supabase.from('records').select('description').eq('id', id).maybeSingle()
  return ((data?.description as string | null) ?? '').trim()
}

// Blocks rather than whole documents. An update applied to an empty page is the page; applied to
// one that already has blocks it would leave the editor with a second block group, which its
// schema does not have. So the arriving containers are cloned into the group already there.
export function append(doc: Y.Doc, update: Uint8Array) {
  const live = doc.getXmlFragment(FRAGMENT)
  if (!live.length) {
    Y.applyUpdate(doc, update)
    return
  }

  const from = new Y.Doc()
  Y.applyUpdate(from, update)
  const group = live.get(0)
  const arriving = from.getXmlFragment(FRAGMENT).get(0)
  if (group instanceof Y.XmlElement && arriving instanceof Y.XmlElement) {
    group.insert(group.length, arriving.toArray()
      .filter((node): node is Y.XmlElement => node instanceof Y.XmlElement)
      .map((node) => node.clone()))
  }
  from.destroy()
}
