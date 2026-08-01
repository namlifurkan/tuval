import { connectorsFor, createItems, getItems, patchItems, removeItems, transact } from './doc'
import { makeRecordItem, RECORD_H, RECORD_W } from './items'
import { createRecord, getRecords, loadRecords } from './records'
import type { Kind, Record as Row } from './records'
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
    // The card keeps the sticky's place and its own proportions. Taking the sticky's height as
    // well turned a square note into a square card, which is not what a card is and which pushed
    // the bottom row of a retro straight out of the frame it was drawn in.
    card.w = Math.max(item.w, RECORD_W)
    card.h = RECORD_H
    card.parentId = item.parentId
    made.push(card)
    spent.push(item.id)
  }

  if (!made.length) return

  // An arrow drawn between two stickies is part of the thinking, and removing the sticky it was
  // anchored to used to take the arrow with it. The card stands where the sticky stood, so the
  // connector should land on the card.
  const moved = new Map(spent.map((id, at) => [id, made[at].id]))
  const rewired: [Id, Record<string, unknown>][] = []
  for (const line of connectorsFor(new Set(spent))) {
    if (line.type !== 'connector') continue
    const from = moved.get(line.from.itemId ?? '')
    const to = moved.get(line.to.itemId ?? '')
    if (!from && !to) continue
    rewired.push([line.id, {
      ...(from ? { from: { ...line.from, itemId: from } } : {}),
      ...(to ? { to: { ...line.to, itemId: to } } : {}),
    }])
  }

  // One transaction, so undo puts the stickies back in a single step rather than one at a time.
  transact(() => {
    createItems(made)
    if (rewired.length) patchItems(rewired)
    removeItems(spent)
  })
  useBoardStore.getState().setSelection(made.map((i) => i.id))
  requestRender()
}

// The other half of the same idea: a piece of work that already exists is put on a canvas, so a
// board can be drawn out of the things the team is actually doing rather than a copy of them.
export const recordItemsFor = (rows: Row[], x: number, y: number): Item[] =>
  rows.map((row, i) => makeRecordItem(
    x + (i % 3) * (RECORD_W + 20),
    y + Math.floor(i / 3) * (RECORD_H + 20),
    row.id, row.title || 'Untitled', row.status, '#FCFBF8', row.kind,
  ))

// Where the card leads when it is opened. A page and an issue are the same kind of thing here
// and different screens there.
export const recordHref = (item: Item & { type: 'record' }) =>
  (item.kind === 'doc' || item.kind === 'database' ? `/d/${item.recordId}` : `/i/${item.recordId}`)

// The row is the truth and the snapshot is a copy, so on arriving at a board the copies are
// brought up to date. Only what actually differs is written: an unconditional write would put
// a change into every board on every load.
export async function refreshSnapshots() {
  const cards = getItems().filter((i) => i.type === 'record')
  if (!cards.length || !getWorkspace()) return

  const kinds = [...new Set(cards.map((c) => c.kind as Kind))]
  await Promise.all(kinds.map((k) => loadRecords(k)))
  const rows = new Map(kinds.flatMap((k) => getRecords(k)).map((r) => [r.id, r]))

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
