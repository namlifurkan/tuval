import { today } from './database'
import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// Minutes, not hours, because twenty minutes is a real amount of work and 0.33 is not a real
// number. Read back as hours wherever a person looks at them.
export interface Stint {
  id: string
  record_id: string
  user_id: string
  minutes: number
  spent_on: string
  note: string
}

const COLUMNS = 'id, record_id, user_id, minutes, spent_on, note'
const KEEP = 400

let stints: Stint[] = []
let version = 0
const listeners = new Set<() => void>()

export const getStints = () => stints
export const timeVersion = () => version

export function subscribeTime(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function announce() {
  version += 1
  listeners.forEach((fn) => fn())
}

export async function loadTime() {
  const ws = getWorkspace()
  if (!supabase || !ws) return
  const { data } = await supabase
    .from('time_entries').select(COLUMNS)
    .eq('workspace_id', ws.id)
    .order('spent_on', { ascending: false })
    .limit(KEEP)
  stints = (data ?? []) as Stint[]
  announce()
}

// "1h30", "90", "1.5h", "45m" — people write time in whatever way is quickest, and refusing all
// but one of them is a way of making somebody stop logging it.
export function readMinutes(typed: string): number {
  const held = typed.trim().toLowerCase().replace(',', '.')
  if (!held) return 0

  const both = /^(\d+)\s*h\s*(\d+)\s*m?$/.exec(held)
  if (both) return Number(both[1]) * 60 + Number(both[2])

  const hours = /^(\d+(?:\.\d+)?)\s*(h|s|sa|saat)$/.exec(held)
  if (hours) return Math.round(Number(hours[1]) * 60)

  const mins = /^(\d+)\s*(m|d|dk|dakika)$/.exec(held)
  if (mins) return Number(mins[1])

  // A bare number is minutes, which is what somebody typing 45 into a box beside "minutes" means.
  const bare = /^\d+$/.exec(held)
  return bare ? Number(held) : 0
}

export function readable(minutes: number): string {
  if (!minutes) return '0'
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h && m ? `${h}h ${m}m` : h ? `${h}h` : `${m}m`
}

export const minutesOn = (record: string) =>
  stints.filter((s) => s.record_id === record).reduce((sum, s) => sum + s.minutes, 0)

export const stintsOn = (record: string) => stints.filter((s) => s.record_id === record)

export async function logTime(record: string, minutes: number, note = '', day = today()) {
  const ws = getWorkspace()
  const me = getUser()?.id
  if (!supabase || !ws || !me || minutes <= 0) return

  const { data } = await supabase.from('time_entries').insert({
    workspace_id: ws.id,
    record_id: record,
    user_id: me,
    minutes,
    note: note.trim(),
    spent_on: day,
  }).select(COLUMNS).single()

  if (data) { stints = [data as Stint, ...stints]; announce() }
}

export async function dropStint(id: string) {
  if (!supabase) return
  stints = stints.filter((s) => s.id !== id)
  announce()
  await supabase.from('time_entries').delete().eq('id', id)
}

// The week somebody is asking about, Monday first, because that is the week a working week is.
export function weekOf(day: string): string[] {
  const at = new Date(`${day}T00:00:00Z`)
  const back = (at.getUTCDay() + 6) % 7
  const monday = new Date(at.getTime() - back * 86400000)
  return Array.from({ length: 7 }, (_, i) =>
    new Date(monday.getTime() + i * 86400000).toISOString().slice(0, 10))
}

export interface Row { user: string; days: number[]; total: number }

// A week as a table: a line per person, a column per day. Everything is read from the stints, so
// there is no total anywhere that could disagree with the entries it came from.
export function weekTable(days: string[], people: string[]): Row[] {
  return people.map((user) => {
    const cells = days.map((day) => stints
      .filter((s) => s.user_id === user && s.spent_on === day)
      .reduce((sum, s) => sum + s.minutes, 0))
    return { user, days: cells, total: cells.reduce((a, b) => a + b, 0) }
  })
}
