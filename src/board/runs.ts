import { supabase } from './supabase'
import { getWorkspace } from './workspace'
import { patchRecord } from './records'
import type { Record as Row } from './records'

// An agent night, read as one thing. Every write an agent makes carries the name of the run it
// belonged to, so the question in the morning is "what did this run do" rather than "what are
// these forty unrelated changes".

export interface Run {
  run: string
  via: string | null
  started: string
  ended: string
  records: number
  writes: number
}

export interface Touch {
  id: number
  record_id: string
  title: string
  at: string
  changed: string[]
  was: { [key: string]: unknown }
}

export async function listRuns(since?: string): Promise<Run[]> {
  const ws = getWorkspace()
  if (!supabase || !ws) return []
  const { data } = await supabase.rpc('agent_runs', { ws: ws.id, since: since ?? null })
  return (data as Run[]) ?? []
}

// Every record the run touched, newest first, with what each one used to be. The title comes
// from the record so a run reads as a list of work rather than a list of identifiers.
export async function readRun(run: string): Promise<Touch[]> {
  const ws = getWorkspace()
  if (!supabase || !ws) return []
  const { data } = await supabase
    .from('record_revisions')
    .select('id, record_id, at, changed, was, records(title)')
    .eq('workspace_id', ws.id)
    .eq('run', run)
    .order('id', { ascending: false })
    .limit(200)
  return ((data ?? []) as unknown as (Omit<Touch, 'title'> & {
    records: { title: string } | { title: string }[] | null
  })[]).map((row) => ({
    id: row.id,
    record_id: row.record_id,
    at: row.at,
    changed: row.changed,
    was: row.was,
    title: (Array.isArray(row.records) ? row.records[0]?.title : row.records?.title) ?? 'Untitled',
  }))
}

// Putting one touch back means restoring the columns it changed and nothing else, which is the
// same thing the version history does — a run is a set of those, not a different mechanism.
export const undoTouch = (touch: Touch) => patchRecord(touch.record_id, touch.was as Partial<Row>)

export async function undoRun(touches: Touch[]) {
  // Oldest first, so a record touched twice ends up at what it was before the run started.
  for (const touch of [...touches].sort((a, b) => a.id - b.id)) await undoTouch(touch)
}

// How long it ran, in the words somebody would use. Not a duration library for two lines.
export function spanOf(run: Run): string {
  const ms = Date.parse(run.ended) - Date.parse(run.started)
  if (!Number.isFinite(ms) || ms < 1000) return 'a moment'
  const minutes = Math.round(ms / 60000)
  if (minutes < 1) return `${Math.round(ms / 1000)}s`
  if (minutes < 60) return `${minutes}m`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}
