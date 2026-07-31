import { duplicatePage } from './duplicatePage'
import { getPages, patchRecord } from './records'
import type { Record as Row } from './records'

// A template is not a fourth kind of thing. It is a page somebody marked, and using one is the
// copy we already had: whatever a page can hold, a template holds, because they are the same.
const MARK = '__template'

export const isTemplate = (row: Row) =>
  !!(row.data as { [k: string]: unknown } | undefined)?.[MARK]

export function setTemplate(row: Row, on: boolean) {
  const next = { ...(row.data ?? {}) }
  if (on) next[MARK] = true
  else delete next[MARK]
  patchRecord(row.id, { data: next } as unknown as Partial<Row>)
}

const inDatabase = (row: Row) =>
  !!row.parent_id && getPages().find((r) => r.id === row.parent_id)?.kind === 'database'

// A template for the tree is a page nobody put inside a database; a template for a database is
// one of its own rows. Neither list is ever the other, which keeps a page template out of a
// table's New row menu and a half-filled row out of the sidebar.
export const pageTemplates = () =>
  getPages().filter((r) => r.kind === 'doc' && isTemplate(r) && !inDatabase(r))

export const rowTemplates = (db: string) =>
  getPages().filter((r) => r.parent_id === db && isTemplate(r))

// The copy is not a template even though what it was made from is: otherwise using one once
// would leave you with two.
export async function fromTemplate(id: string, parent: string | null): Promise<string | null> {
  const source = getPages().find((r) => r.id === id)
  if (!source) return null
  const data = { ...(source.data ?? {}) }
  delete data[MARK]
  return duplicatePage(id, { title: source.title, parent, data })
}
