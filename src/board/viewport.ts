import { clampZoom } from './camera'
import type { Camera } from './camera'

// The camera is personal, not part of the document: two people looking at the same board
// should keep their own place. So it lives in localStorage, keyed by room.
const key = (room: string) => `tuval:camera:${room}`

const sane = (c: unknown): c is Camera => {
  const v = c as Camera
  return !!v && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z) && v.z > 0
}

export function loadCamera(room: string): Camera | null {
  try {
    const raw = localStorage.getItem(key(room))
    if (!raw) return null
    const parsed = JSON.parse(raw) as unknown
    if (!sane(parsed)) return null
    return { ...parsed, z: clampZoom(parsed.z) }
  } catch {
    return null
  }
}

let pending: Camera | null = null
let timer = 0

function flush(room: string) {
  if (!pending) return
  try { localStorage.setItem(key(room), JSON.stringify(pending)) } catch { /* ignore */ }
  pending = null
}

// Panning and zooming change the camera every frame; writing that often would be wasteful.
export function saveCamera(room: string, cam: Camera) {
  pending = cam
  if (timer) return
  timer = window.setTimeout(() => { timer = 0; flush(room) }, 400)
}

export function flushCamera(room: string) {
  if (timer) { clearTimeout(timer); timer = 0 }
  flush(room)
}
