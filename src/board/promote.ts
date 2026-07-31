import { createItems, getItems, patchItems, removeItems, transact } from './doc'
import { makeRecordItem } from './items'
import { createRecord, getRecords, loadRecords } from './records'
import { requestRender, useBoardStore } from './store'
import { getWorkspace } from './workspace'
import type { Id, Item } from './types'

export const canPromote = (item: Item) =>
  (item.type === 'sticky' || item.type === 'text') && !!getWorkspace()

// The thing this whole product is for: an idea on a canvas becomes a piece of work, in place,
// without opening anything. The card stays where the sticky was, because where you put it was
// part of the thought.
export async function promoteToIssue(ids: Id[]) {
  const index = new Map(getItems().map((i) => [i.id, i]))
  const chosen = ids.map((id) => index.get(id)).filter((i): i is Item => !!i && canPromote(i))
  if (!chosen.length) return

  const made: Item[] = []
  const spent: Id[] = []

  for (const item of chosen) {
    const title = ('text' in item ? item.text : '').trim()
    const recordId = await createRecord(title || 'Untitled')
    if (!recordId) continue

    const fill = item.type === 'sticky' ? item.fill : '#FCFBF8'
    const card = makeRecordItem(item.x, item.y, recordId, title || 'Untitled', 'todo', fill)
    card.w = Math.max(item.w, 220)
    card.h = Math.max(item.h, 96)
    card.parentId = item.parentId
    made.push(card)
    spent.push(item.id)
  }

  if (!made.length) return

  // One transaction, so undo puts the stickies back in a single step rather than one at a time.
  transact(() => {
    createItems(made)
    removeItems(spent)
  })
  useBoardStore.getState().setSelection(made.map((i) => i.id))
  requestRender()
}

// The row is the truth and the snapshot is a copy, so on arriving at a board the copies are
// brought up to date. Only what actually differs is written: an unconditional write would put
// a change into every board on every load.
export async function refreshSnapshots() {
  const cards = getItems().filter((i) => i.type === 'record')
  if (!cards.length || !getWorkspace()) return

  await loadRecords('issue')
  const rows = new Map(getRecords().map((r) => [r.id, r]))

  const stale: [Id, Record<string, unknown>][] = []
  for (const card of cards) {
    const row = rows.get(card.recordId)
    if (!row) continue
    if (row.title === card.snapshot.title && row.status === card.snapshot.status) continue
    stale.push([card.id, { snapshot: { title: row.title, status: row.status } }])
  }

  if (stale.length) {
    patchItems(stale)
    requestRender()
  }
}
