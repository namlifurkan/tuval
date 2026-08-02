import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// One timestamp per person per workspace, and everything else here is a comparison against it.
// An agent's night of writing is only reviewable if the product knows which part of it you have
// already read.

let looked: string | null = null
const listeners = new Set<() => void>()

export const lastLooked = () => looked

export function subscribeSeen(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

const publish = (next: string | null) => {
  looked = next
  listeners.forEach((fn) => fn())
}

export async function loadSeen() {
  const workspace = getWorkspace()
  const user = getUser()
  if (!supabase || !workspace || !user) return
  const { data } = await supabase
    .from('workspace_members')
    .select('seen_at')
    .eq('workspace_id', workspace.id)
    .eq('user_id', user.id)
    .maybeSingle()
  publish((data?.seen_at as string | null) ?? null)
}

export async function markSeen() {
  const workspace = getWorkspace()
  if (!supabase || !workspace) return
  // Moved under the finger first: the badge going out is the whole point of pressing it, and a
  // failed round trip puts it back rather than leaving the list looking read when it is not.
  const before = looked
  const now = new Date().toISOString()
  publish(now)
  const { data, error } = await supabase.rpc('mark_workspace_seen', { ws: workspace.id })
  if (error || !data) publish(before)
  else publish(data as string)
}

export const changedSince = (at: string | null | undefined, since = looked) =>
  !!at && !!since && at > since

export const writtenByAgent = (via: string | null | undefined) => !!via
