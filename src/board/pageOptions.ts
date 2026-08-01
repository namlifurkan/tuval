import { patchRecord } from './records'
import type { Record as Row } from './records'

// Two switches that belong to the page rather than to the person reading it, so they live in the
// same jsonb the rest of a page's settings live in and follow the page everywhere.
const LOCKED = '__locked'
const WIDE = '__wide'

const flag = (row: Row | undefined, key: string) =>
  !!(row?.data as { [k: string]: unknown } | undefined)?.[key]

// A lock stops the editing, not the access: anybody who could open the page could unlock it. It
// is a guard against a stray keystroke in a page people read, which is what Notion's is too.
export const isLocked = (row: Row | undefined) => flag(row, LOCKED)
export const isWide = (row: Row | undefined) => flag(row, WIDE)

function set(row: Row, key: string, on: boolean) {
  const next = { ...(row.data ?? {}) }
  if (on) next[key] = true
  else delete next[key]
  patchRecord(row.id, { data: next } as unknown as Partial<Row>)
}

export const setLocked = (row: Row, on: boolean) => set(row, LOCKED, on)
export const setWide = (row: Row, on: boolean) => set(row, WIDE, on)
