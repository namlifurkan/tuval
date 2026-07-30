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

export const isAssigned = (list: Assignee[] | undefined, id: Id) =>
  (list ?? []).some((a) => a.id === id)

export function toggleAssignee(list: Assignee[] | undefined, person: Assignee): Assignee[] {
  const current = list ?? []
  return isAssigned(current, person.id)
    ? current.filter((a) => a.id !== person.id)
    : [...current, person]
}
