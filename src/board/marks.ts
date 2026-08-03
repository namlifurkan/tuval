import { getItems, patchItems } from './doc'
import type { Id, Item, TextStyle } from './types'

export type Mark = 'bold' | 'italic' | 'underline' | 'strike'

// The three every editor has spelled the same way since the first one.
export const MARK_KEYS: { [key: string]: Mark } = { b: 'bold', i: 'italic', u: 'underline' }

const marked = (item: Item, mark: Mark) => mark in item && !!(item as unknown as TextStyle)[mark]

// An item on the canvas carries one style for all of its text, so a mark is on or off for the
// whole item. A selection where some are bold and some are not goes bold rather than swapping
// each one for its opposite: that is what every editor does, and it is the only version nobody
// has to look at twice.
export const nextMark = (items: Item[], mark: Mark) => !items.every((i) => marked(i, mark))

export function toggleMark(ids: Id[], mark: Mark): boolean {
  const wanted = new Set(ids)
  const items = getItems().filter((i) => wanted.has(i.id) && !i.locked && mark in i)
  if (!items.length) return false
  const on = nextMark(items, mark)
  patchItems(items.map((i) => [i.id, { [mark]: on }] as [Id, Record<string, unknown>]))
  return true
}
