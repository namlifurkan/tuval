export type Role = 'owner' | 'editor' | 'viewer' | null

let role: Role = null
// A board this browser has a copy of and the cloud will not let us write: the row belongs to
// another account. Nothing typed here would ever be saved, so nothing is typed here.
let foreign = false
const listeners = new Set<() => void>()

export const getRole = () => role
export const isForeign = () => foreign
export const readOnly = () => role === 'viewer' || foreign

export function setForeign(next: boolean) {
  if (next === foreign) return
  foreign = next
  listeners.forEach((l) => l())
}

export const subscribeAccess = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setRole(next: Role) {
  if (next === role) return
  role = next
  listeners.forEach((l) => l())
}
