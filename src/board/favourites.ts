import { getUser, supabase } from './supabase'

// What this person keeps at hand. Held as a set because every row of the tree asks "is this one
// of mine", and that question should not be a scan.
let mine = new Set<string>()
const listeners = new Set<() => void>()

// The set is replaced rather than mutated: React is told the world changed by the identity of
// what it is handed, and a set edited in place is the same set.
export const getFavourites = () => mine

export function subscribeFavourites(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function publish(next: Set<string>) {
  mine = next
  listeners.forEach((fn) => fn())
}

export async function loadFavourites() {
  if (!supabase || !getUser()) return
  const { data } = await supabase
    .from('record_favourites').select('record_id').order('position', { ascending: true })
  publish(new Set((data ?? []).map((r) => r.record_id as string)))
}

export async function toggleFavourite(id: string) {
  const me = getUser()?.id
  if (!supabase || !me) return

  const next = new Set(mine)
  const had = next.delete(id)
  if (!had) next.add(id)
  publish(next)

  if (had) await supabase.from('record_favourites').delete().eq('record_id', id).eq('user_id', me)
  else await supabase.from('record_favourites').insert({ user_id: me, record_id: id, position: next.size })
}
