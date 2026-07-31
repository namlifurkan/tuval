import { getUser, supabase } from './supabase'

export type NoticeKind = 'assigned' | 'mentioned'

export interface Notice {
  id: string
  kind: NoticeKind
  record_id: string | null
  actor: string | null
  created_at: string
  read_at: string | null
}

const COLUMNS = 'id, kind, record_id, actor, created_at, read_at'
const KEEP = 100

let inbox: Notice[] = []
const listeners = new Set<() => void>()

export const getInbox = () => inbox
export const unreadCount = () => inbox.filter((n) => !n.read_at).length

export function subscribeInbox(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function publish(next: Notice[]) {
  inbox = next
  listeners.forEach((fn) => fn())
}

export async function loadInbox() {
  if (!supabase || !getUser()) return
  const { data } = await supabase
    .from('notifications').select(COLUMNS).order('created_at', { ascending: false }).limit(KEEP)
  publish((data ?? []) as Notice[])
}

// Marked here first so the badge goes out under the finger rather than after the round trip.
export async function markRead(ids: string[]) {
  if (!supabase || !ids.length) return
  const at = new Date().toISOString()
  publish(inbox.map((n) => (ids.includes(n.id) ? { ...n, read_at: n.read_at ?? at } : n)))
  await supabase.from('notifications').update({ read_at: at }).in('id', ids).is('read_at', null)
}

export const markAllRead = () =>
  markRead(inbox.filter((n) => !n.read_at).map((n) => n.id))

export async function clearInbox() {
  if (!supabase) return
  const ids = inbox.map((n) => n.id)
  publish([])
  if (ids.length) await supabase.from('notifications').delete().in('id', ids)
}

// Who this browser has already named in which page. The database refuses a second notification
// on its own; this is so that a page saved every few seconds is not also a request every few
// seconds saying nothing new.
const told = new Map<string, string>()

export async function notifyMentions(record: string, people: Set<string>) {
  const me = getUser()?.id
  const named = [...people].filter((id) => id && id !== me).sort()
  if (!supabase || !named.length) return
  const key = named.join(',')
  if (told.get(record) === key) return
  told.set(record, key)
  await supabase.rpc('notify_mentions', { record, people: named })
}
