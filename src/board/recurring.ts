import { today } from './database'
import { loadRecords } from './records'
import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// Work that comes back. The rule is the whole definition — there is no template issue to keep in
// step with it — and making the due ones is keyed on the date, so asking twice makes nothing
// twice. A schedule asks each night; the app asks on the way in, so a workspace somebody opens
// each morning keeps up even where the schedule could not be installed.
export type Every = 'day' | 'week' | 'month'

export interface Rule {
  id: string
  title: string
  every: Every
  weekday: number | null
  monthday: number | null
  assignee: string | null
  estimate: number | null
  next_on: string
  active: boolean
}

const COLUMNS = 'id, title, every, weekday, monthday, assignee, estimate, next_on, active'

let rules: Rule[] = []
const listeners = new Set<() => void>()

export const getRules = () => rules
export const subscribeRules = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

const announce = () => listeners.forEach((fn) => fn())

export async function loadRules() {
  const ws = getWorkspace()
  if (!supabase || !ws) return
  // Catching up first, so what is owed is on the list before the list is drawn.
  await supabase.rpc('make_due_recurrences')
  const { data } = await supabase
    .from('recurrences').select(COLUMNS).eq('workspace_id', ws.id).order('next_on')
  rules = (data ?? []) as Rule[]
  announce()
  await loadRecords('issue')
}

export async function addRule(title: string, every: Every) {
  const ws = getWorkspace()
  if (!supabase || !ws || !title.trim()) return
  await supabase.from('recurrences').insert({
    workspace_id: ws.id,
    title: title.trim(),
    every,
    next_on: today(),
    created_by: getUser()?.id ?? null,
  })
  await loadRules()
}

export async function setRule(id: string, changes: Partial<Rule>) {
  if (!supabase) return
  rules = rules.map((r) => (r.id === id ? { ...r, ...changes } : r))
  announce()
  await supabase.from('recurrences').update(changes).eq('id', id)
}

export async function dropRule(id: string) {
  if (!supabase) return
  rules = rules.filter((r) => r.id !== id)
  announce()
  await supabase.from('recurrences').delete().eq('id', id)
}
