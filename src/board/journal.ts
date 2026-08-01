import { go } from './boards'
import { today } from './database'
import { createRecord, getRecords, loadPages, patchRecord } from './records'
import type { Record as Row } from './records'
import { getLang, t } from './../i18n'
import { getWorkspace } from './workspace'

// One page a day, a keystroke away. The page is an ordinary page — it sits in the tree, it can be
// linked to and put on a board like any other — and all that makes it a journal is a mark saying
// which day it belongs to. The mark is what is looked up, never the title, because a title is
// written in whatever language the person reads and can be changed by them afterwards.
const dayOf = (row: Row) => (row.data?.journal as string) ?? ''

export const isJournalRoot = (row: Row) => dayOf(row) === 'root'

const nameOf = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(
  getLang() === 'tr' ? 'tr-TR' : 'en-GB',
  { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' },
)

async function rootId(): Promise<string | null> {
  const held = getRecords('doc').find(isJournalRoot)
  if (held) return held.id
  const made = await createRecord(t('Journal'), 'doc')
  if (made) patchRecord(made, { data: { journal: 'root' } })
  return made
}

// Today's page, made if this is the first time today. Called from a shortcut, so it settles on
// its own rather than reporting: pressing g j twice in a row must not leave two pages behind.
let opening: Promise<void> | null = null

export function openJournal(day = today()): Promise<void> {
  opening ??= journalFor(day).finally(() => { opening = null })
  return opening
}

async function journalFor(day: string) {
  if (!getWorkspace()) return
  await loadPages()

  const held = getRecords('doc').find((r) => dayOf(r) === day)
  if (held) { go(`/d/${held.id}`); return }

  const parent = await rootId()
  const made = await createRecord(nameOf(day), 'doc', parent)
  if (!made) return
  patchRecord(made, { data: { journal: day } })
  go(`/d/${made}`)
}
