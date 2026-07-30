import { awareness, getItems } from './doc'
import { me } from './me'
import type { Assignee, Id } from './types'

// There is no user directory yet. The pool is whoever is on the board right now plus anyone
// already assigned somewhere, so an offline teammate stays pickable and never disappears
// from a frame they own.
export function boardPeople(): Assignee[] {
  const byId = new Map<string, Assignee>()
  byId.set(me.id, { id: me.id, name: me.name, color: me.color })

  awareness.getStates().forEach((state) => {
    const user = (state as { user?: Assignee }).user
    if (user?.id) byId.set(user.id, { id: user.id, name: user.name, color: user.color })
  })

  for (const item of getItems()) {
    if (item.type !== 'frame') continue
    for (const a of item.assignees ?? []) if (!byId.has(a.id)) byId.set(a.id, a)
  }
  return [...byId.values()]
}

const GUEST_COLORS = ['#C8452D', '#3E5C93', '#5E9A8A', '#8A7FB0', '#DE9A4E', '#B9718A']

// A name from an imported brief may belong to someone this browser has never seen. Keep it as
// a person rather than dropping it: losing an owner on the way in is worse than a stub.
export function personNamed(name: string): Assignee {
  const trimmed = name.trim()
  const key = trimmed.toLowerCase()
  const known = boardPeople().find((p) => p.name.toLowerCase() === key)
  if (known) return known
  let hash = 0
  for (const ch of key) hash = (hash * 31 + ch.charCodeAt(0)) % 997
  return { id: `name:${key}`, name: trimmed, color: GUEST_COLORS[hash % GUEST_COLORS.length] }
}

export const isAssigned = (list: Assignee[] | undefined, id: Id) =>
  (list ?? []).some((a) => a.id === id)

export function toggleAssignee(list: Assignee[] | undefined, person: Assignee): Assignee[] {
  const current = list ?? []
  return isAssigned(current, person.id)
    ? current.filter((a) => a.id !== person.id)
    : [...current, person]
}
