import type { Rect, Vec } from './types'

export interface Camera { x: number; y: number; z: number }

export const MIN_ZOOM = 0.02
export const MAX_ZOOM = 20

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

export const toBoard = (cam: Camera, sx: number, sy: number): Vec => ({
  x: sx / cam.z + cam.x,
  y: sy / cam.z + cam.y,
})

export const toScreen = (cam: Camera, bx: number, by: number): Vec => ({
  x: (bx - cam.x) * cam.z,
  y: (by - cam.y) * cam.z,
})

export function zoomAt(cam: Camera, sx: number, sy: number, nextZ: number): Camera {
  const z = clampZoom(nextZ)
  const b = toBoard(cam, sx, sy)
  return { z, x: b.x - sx / z, y: b.y - sy / z }
}

export function viewportRect(cam: Camera, vw: number, vh: number): Rect {
  return { x: cam.x, y: cam.y, w: vw / cam.z, h: vh / cam.z }
}

export function fitRect(target: Rect, vw: number, vh: number, padding = 80): Camera {
  const z = clampZoom(Math.min((vw - padding * 2) / target.w, (vh - padding * 2) / target.h))
  return {
    z,
    x: target.x + target.w / 2 - vw / 2 / z,
    y: target.y + target.h / 2 - vh / 2 / z,
  }
}

const bezier = (a: number, b: number, u: number) =>
  ((3 * a - 3 * b + 1) * u + (3 * b - 6 * a)) * u * u + 3 * a * u

export function ease(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  let lo = 0
  let hi = 1
  let u = t
  for (let i = 0; i < 24; i++) {
    u = (lo + hi) / 2
    if (bezier(0.16, 0.3, u) < t) lo = u
    else hi = u
  }
  return bezier(1, 1, u)
}

export const skipsMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

let tween = 0

export function animateCamera(
  from: Camera, to: Camera, apply: (c: Camera) => void, ms = 420,
) {
  cancelAnimationFrame(tween)
  if (skipsMotion()) { apply(to); return }
  const start = performance.now()
  const step = (now: number) => {
    const t = (now - start) / ms
    if (t >= 1) { apply(to); return }
    const k = ease(t)
    apply({
      x: from.x + (to.x - from.x) * k,
      y: from.y + (to.y - from.y) * k,
      z: from.z + (to.z - from.z) * k,
    })
    tween = requestAnimationFrame(step)
  }
  tween = requestAnimationFrame(step)
}

export function centerOn(cam: Camera, p: Vec, vw: number, vh: number): Camera {
  return { ...cam, x: p.x - vw / 2 / cam.z, y: p.y - vh / 2 / cam.z }
}
