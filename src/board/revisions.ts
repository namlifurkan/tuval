import { supabase } from './supabase'
import { patchRecord } from './records'
import type { Record as Row } from './records'

// What a record used to be. Written by the database on every change, so it is the same trail
// whether the change came from this screen, from somebody else's, or from a key held by a robot.

export interface Revision {
  id: number
  at: string
  actor: string | null
  via: string | null
  changed: string[]
  was: { [key: string]: unknown }
}

export async function listRevisions(record: string): Promise<Revision[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('record_revisions').select('id, at, actor, via, changed, was')
    .eq('record_id', record).order('id', { ascending: false }).limit(30)
  return (data ?? []) as Revision[]
}

// Going back means putting those columns back to what they were, and touching nothing else. A
// version here is one change rather than a whole row, so undoing an old one keeps the newer ones.
export const undoRevision = (record: string, revision: Revision) =>
  patchRecord(record, revision.was as Partial<Row>)
