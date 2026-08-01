import type { Id, Item } from './types'

// What a long afternoon leaves behind. A double-click that made a text box nobody typed in, a
// pen that touched down and lifted, a connector dragged from nothing to nothing: none of them
// are visible on a busy board and all of them go into the export.
//
// This only finds them. Deleting is the person's, because "empty" is a guess about intent and a
// guess should never be the thing that removes work.

// A dot rather than a stroke. Anything wider or taller than this was drawn on purpose.
const SPECK = 6

// A connector this short, attached to nothing at either end, is a slipped drag.
const STUB = 24

const blank = (text: string | undefined) => !text || !text.trim()

const loose = (item: Item & { type: 'connector' }) =>
  !item.from.itemId && !item.to.itemId
  && Math.hypot(item.to.x - item.from.x, item.to.y - item.from.y) < STUB

export function isLeftover(item: Item, hasChildren: (id: Id) => boolean): boolean {
  if (item.locked) return false

  switch (item.type) {
    case 'text':
      return blank(item.text)
    case 'sticky':
      return blank(item.text) && blank(item.label)
    case 'code':
      return blank(item.text)
    case 'connector':
      return blank(item.text) && loose(item)
    case 'draw':
      return item.w < SPECK && item.h < SPECK
    // An empty frame is somewhere to put things, which is the whole point of making one before
    // there is anything to put in it. Only an unnamed one that never got used counts.
    case 'frame':
      return blank(item.title) && !hasChildren(item.id)
    default:
      return false
  }
}

export function leftovers(items: Item[]): Id[] {
  const parents = new Set(items.map((i) => i.parentId).filter(Boolean) as Id[])
  const hasChildren = (id: Id) => parents.has(id)
  return items.filter((i) => isLeftover(i, hasChildren)).map((i) => i.id)
}
