export type Role = 'owner' | 'editor' | 'viewer' | null

let role: Role = null
const listeners = new Set<() => void>()

export const getRole = () => role
export const readOnly = () => role === 'viewer'

export const subscribeAccess = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setRole(next: Role) {
  if (next === role) return
  role = next
  listeners.forEach((l) => l())
}
