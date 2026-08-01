import * as Y from 'yjs'
import { bodyOf } from './notion'
import { FRAGMENT, openPage, pageDoc } from './page'
import { patchRecord } from './records'
import type { Record as Row } from './records'

// An issue used to keep its description in a column, as one flat string. It keeps it in the same
// CRDT a page uses now, so it can hold headings, code, checklists and comments — and so that a
// description and a page are one thing to maintain rather than two.
//
// The old column is not dropped and forgotten: the first time an issue with a description is
// opened, the text becomes the first paragraphs of the body and the column is cleared. Nothing
// is lost, and it happens once per issue.
export async function openIssueBody(issue: Row): Promise<void> {
  await openPage(issue.id)

  const held = issue.description?.trim()
  if (!held) return

  const doc = pageDoc()
  if (doc.getXmlFragment(FRAGMENT).length) {
    // Somebody has already written in the body. The column is stale rather than unmigrated.
    patchRecord(issue.id, { description: '' })
    return
  }

  const made = bodyOf(held)
  if (made) Y.applyUpdate(doc, made.update)
  patchRecord(issue.id, { description: '' })
}
