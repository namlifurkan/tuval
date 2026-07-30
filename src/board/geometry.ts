import type { AnchorSide, Item, Rect, Vec } from './types'

export const TAU = Math.PI * 2

export function rotate(p: Vec, a: number): Vec {
  if (!a) return { x: p.x, y: p.y }
  const c = Math.cos(a), s = Math.sin(a)
  return { x: p.x * c - p.y * s, y: p.x * s + p.y * c }
}

export const center = (r: Rect): Vec => ({ x: r.x + r.w / 2, y: r.y + r.h / 2 })

export function toLocal(item: Item, p: Vec): Vec {
  const c = center(item)
  return rotate({ x: p.x - c.x, y: p.y - c.y }, -item.rotation)
}

export function corners(item: Rect & { rotation: number }): Vec[] {
  const c = center(item)
  const hw = item.w / 2, hh = item.h / 2
  return [
    { x: -hw, y: -hh }, { x: hw, y: -hh }, { x: hw, y: hh }, { x: -hw, y: hh },
  ].map((p) => {
    const r = rotate(p, item.rotation)
    return { x: c.x + r.x, y: c.y + r.y }
  })
}

export function aabb(item: Item): Rect {
  if (!item.rotation) return { x: item.x, y: item.y, w: item.w, h: item.h }
  const pts = corners(item)
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const x = Math.min(...xs), y = Math.min(...ys)
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y }
}

export function union(rects: Rect[]): Rect {
  if (!rects.length) return { x: 0, y: 0, w: 0, h: 0 }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of rects) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

export const boundsOf = (items: Item[]): Rect => union(items.map(aabb))

export const overlaps = (a: Rect, b: Rect) =>
  a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y

export const contains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y &&
  inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

export const pointInRect = (r: Rect, p: Vec) =>
  p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h

function distToSegment(p: Vec, a: Vec, b: Vec): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = dx * dx + dy * dy
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export function distToPolyline(p: Vec, pts: Vec[]): number {
  let min = Infinity
  for (let i = 1; i < pts.length; i++) min = Math.min(min, distToSegment(p, pts[i - 1], pts[i]))
  return pts.length === 1 ? Math.hypot(p.x - pts[0].x, p.y - pts[0].y) : min
}

export function hitTest(item: Item, p: Vec, tolerance: number, ends: (c: Item & { type: 'connector' }) => Ends): boolean {
  if (item.type === 'connector') {
    return distToPolyline(p, connectorPath(item, ends(item))) <= Math.max(tolerance, item.strokeWidth / 2 + 4)
  }
  const l = toLocal(item, p)
  const hw = item.w / 2, hh = item.h / 2
  if (item.type === 'draw') {
    const pts = drawPoints(item)
    return distToPolyline(p, pts) <= Math.max(tolerance, item.strokeWidth / 2 + 3)
  }
  if (item.type === 'frame') {
    const edge = tolerance + 2
    const inside = Math.abs(l.x) <= hw + edge && Math.abs(l.y) <= hh + edge
    const inner = Math.abs(l.x) <= hw - edge && Math.abs(l.y) <= hh - edge
    const onTitle = l.y < -hh && l.y > -hh - 28 && Math.abs(l.x) <= hw
    return onTitle || (inside && !inner)
  }
  if (item.type === 'shape' && item.kind === 'ellipse') {
    return (l.x / hw) ** 2 + (l.y / hh) ** 2 <= 1
  }
  if (item.type === 'shape' && item.fill === 'transparent') {
    const edge = Math.max(tolerance, item.strokeWidth)
    const inside = Math.abs(l.x) <= hw + edge && Math.abs(l.y) <= hh + edge
    const inner = Math.abs(l.x) <= hw - edge && Math.abs(l.y) <= hh - edge
    return inside && !inner
  }
  return Math.abs(l.x) <= hw && Math.abs(l.y) <= hh
}

export function drawPoints(item: Item & { type: 'draw' }): Vec[] {
  const out: Vec[] = []
  for (let i = 0; i < item.points.length; i += 3) {
    out.push({ x: item.x + item.points[i] * item.w, y: item.y + item.points[i + 1] * item.h })
  }
  return out
}

export type Handle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'
export const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

export const HANDLE_CURSOR: Record<Handle, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
}

export function handlePoint(r: Rect & { rotation: number }, h: Handle): Vec {
  const hw = r.w / 2, hh = r.h / 2
  const local: Vec = {
    x: h.includes('w') ? -hw : h.includes('e') ? hw : 0,
    y: h.includes('n') ? -hh : h.includes('s') ? hh : 0,
  }
  const c = center(r)
  const rp = rotate(local, r.rotation)
  return { x: c.x + rp.x, y: c.y + rp.y }
}

export interface Box { x: number; y: number; w: number; h: number; rotation: number }

export function resizeBox(orig: Box, handle: Handle, pointer: Vec, keepRatio: boolean, fromCenter = false): Box {
  const c = center(orig)
  const l = rotate({ x: pointer.x - c.x, y: pointer.y - c.y }, -orig.rotation)
  let left = -orig.w / 2, right = orig.w / 2, top = -orig.h / 2, bottom = orig.h / 2
  const ratio = orig.w / Math.max(1e-6, orig.h)

  if (handle.includes('w')) left = l.x
  if (handle.includes('e')) right = l.x
  if (handle.includes('n')) top = l.y
  if (handle.includes('s')) bottom = l.y

  if (fromCenter) {
    if (handle.includes('w')) right = -left
    if (handle.includes('e')) left = -right
    if (handle.includes('n')) bottom = -top
    if (handle.includes('s')) top = -bottom
  }

  let w = right - left, h = bottom - top
  if (keepRatio && handle.length === 2) {
    const scale = Math.max(Math.abs(w) / orig.w, Math.abs(h) / orig.h)
    const nw = orig.w * scale * Math.sign(w || 1), nh = orig.h * scale * Math.sign(h || 1)
    if (handle.includes('w')) left = right - nw; else right = left + nw
    if (handle.includes('n')) top = bottom - nh; else bottom = top + nh
    w = right - left; h = bottom - top
  }
  if (keepRatio && handle.length === 1) {
    if (handle === 'e' || handle === 'w') {
      h = Math.abs(w) / ratio * Math.sign(h || 1)
      const mid = (top + bottom) / 2
      top = mid - h / 2; bottom = mid + h / 2
    } else {
      w = Math.abs(h) * ratio * Math.sign(w || 1)
      const mid = (left + right) / 2
      left = mid - w / 2; right = mid + w / 2
    }
  }

  const lc = { x: (left + right) / 2, y: (top + bottom) / 2 }
  const wc = rotate(lc, orig.rotation)
  const nx = c.x + wc.x - Math.abs(w) / 2
  const ny = c.y + wc.y - Math.abs(h) / 2
  return { x: nx, y: ny, w: Math.abs(w), h: Math.abs(h), rotation: orig.rotation }
}

export function snapAngle(a: number, step = Math.PI / 12): number {
  return Math.round(a / step) * step
}

export interface SnapResult { dx: number; dy: number; guides: [Vec, Vec][] }

export function snapMove(moving: Rect, others: Rect[], threshold: number): SnapResult {
  const mv = [moving.x, moving.x + moving.w / 2, moving.x + moving.w]
  const mh = [moving.y, moving.y + moving.h / 2, moving.y + moving.h]
  let best = { d: threshold, v: 0, i: -1, target: null as Rect | null }
  let bestH = { d: threshold, v: 0, i: -1, target: null as Rect | null }

  for (const o of others) {
    const ov = [o.x, o.x + o.w / 2, o.x + o.w]
    const oh = [o.y, o.y + o.h / 2, o.y + o.h]
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const dx = ov[j] - mv[i]
      if (Math.abs(dx) < Math.abs(best.d)) best = { d: dx, v: ov[j], i, target: o }
      const dy = oh[j] - mh[i]
      if (Math.abs(dy) < Math.abs(bestH.d)) bestH = { d: dy, v: oh[j], i, target: o }
    }
  }

  const guides: [Vec, Vec][] = []
  const dx = best.target ? best.d : 0
  const dy = bestH.target ? bestH.d : 0
  if (best.target) {
    const y0 = Math.min(moving.y + dy, best.target.y)
    const y1 = Math.max(moving.y + moving.h + dy, best.target.y + best.target.h)
    guides.push([{ x: best.v, y: y0 }, { x: best.v, y: y1 }])
  }
  if (bestH.target) {
    const x0 = Math.min(moving.x + dx, bestH.target.x)
    const x1 = Math.max(moving.x + moving.w + dx, bestH.target.x + bestH.target.w)
    guides.push([{ x: x0, y: bestH.v }, { x: x1, y: bestH.v }])
  }
  return { dx, dy, guides }
}

export interface SpacingResult { delta: number; marks: Rect[] }

function spacingOn(
  moving: Rect, others: Rect[], axis: 'x' | 'y', threshold: number,
): SpacingResult | null {
  const span = axis === 'x' ? 'w' : 'h'
  const cross = axis === 'x' ? 'y' : 'x'
  const crossSpan = axis === 'x' ? 'h' : 'w'
  const band = others.filter(
    (o) => o[cross] < moving[cross] + moving[crossSpan] && o[cross] + o[crossSpan] > moving[cross],
  )
  if (band.length < 2) return null

  const before = band.filter((o) => o[axis] + o[span] <= moving[axis] + threshold)
    .sort((a, b) => (b[axis] + b[span]) - (a[axis] + a[span]))[0]
  const after = band.filter((o) => o[axis] >= moving[axis] + moving[span] - threshold)
    .sort((a, b) => a[axis] - b[axis])[0]
  if (!before || !after) return null

  const gapBefore = moving[axis] - (before[axis] + before[span])
  const gapAfter = after[axis] - (moving[axis] + moving[span])
  if (Math.abs(gapBefore - gapAfter) > threshold) return null

  const total = after[axis] - (before[axis] + before[span]) - moving[span]
  const gap = total / 2
  const delta = before[axis] + before[span] + gap - moving[axis]
  const start = moving[cross] + moving[crossSpan] / 2 - 1
  const mk = (from: number, size: number): Rect =>
    axis === 'x'
      ? { x: from, y: start, w: size, h: 2 }
      : { x: start, y: from, w: 2, h: size }
  return {
    delta,
    marks: [
      mk(before[axis] + before[span], gap),
      mk(moving[axis] + delta + moving[span], gap),
    ],
  }
}

export function snapSpacing(moving: Rect, others: Rect[], threshold: number) {
  return {
    x: spacingOn(moving, others, 'x', threshold),
    y: spacingOn(moving, others, 'y', threshold),
  }
}

const DEFAULT_GAP = 24

function commonGap(peers: Rect[], axis: 'x' | 'y'): number {
  const span = axis === 'x' ? 'w' : 'h'
  const cross = axis === 'x' ? 'y' : 'x'
  const crossSpan = axis === 'x' ? 'h' : 'w'
  const gaps: number[] = []
  for (const a of peers) {
    for (const b of peers) {
      if (a === b) continue
      const aligned = a[cross] < b[cross] + b[crossSpan] && a[cross] + a[crossSpan] > b[cross]
      if (!aligned) continue
      const gap = b[axis] - (a[axis] + a[span])
      if (gap > 0 && gap < 400) gaps.push(Math.round(gap))
    }
  }
  if (!gaps.length) return DEFAULT_GAP
  const tally = new Map<number, number>()
  for (const g of gaps) tally.set(g, (tally.get(g) ?? 0) + 1)
  return [...tally.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]
}

export function snapLattice(moving: Rect, others: Rect[], threshold: number): { dx: number; dy: number } {
  const peers = others.filter(
    (o) => Math.abs(o.w - moving.w) <= 2 && Math.abs(o.h - moving.h) <= 2,
  )
  if (!peers.length) return { dx: 0, dy: 0 }
  const gapX = commonGap(peers, 'x')
  const gapY = commonGap(peers, 'y')

  let dx = 0, bestX = threshold
  let dy = 0, bestY = threshold
  for (const peer of peers) {
    for (const candidate of [peer.x, peer.x + peer.w + gapX, peer.x - moving.w - gapX]) {
      const delta = candidate - moving.x
      if (Math.abs(delta) < bestX) { bestX = Math.abs(delta); dx = delta }
    }
    for (const candidate of [peer.y, peer.y + peer.h + gapY, peer.y - moving.h - gapY]) {
      const delta = candidate - moving.y
      if (Math.abs(delta) < bestY) { bestY = Math.abs(delta); dy = delta }
    }
  }
  return { dx, dy }
}

export function anchorPoint(item: Item, side: AnchorSide): Vec {
  const c = center(item)
  const hw = item.w / 2, hh = item.h / 2
  const local: Vec =
    side === 'top' ? { x: 0, y: -hh } :
    side === 'bottom' ? { x: 0, y: hh } :
    side === 'left' ? { x: -hw, y: 0 } : { x: hw, y: 0 }
  const r = rotate(local, item.rotation)
  return { x: c.x + r.x, y: c.y + r.y }
}

export const ANCHOR_SIDES: AnchorSide[] = ['top', 'right', 'bottom', 'left']

export function nearestAnchor(item: Item, target: Vec): AnchorSide {
  let best: AnchorSide = 'top', bd = Infinity
  for (const s of ANCHOR_SIDES) {
    const p = anchorPoint(item, s)
    const d = Math.hypot(p.x - target.x, p.y - target.y)
    if (d < bd) { bd = d; best = s }
  }
  return best
}

const NORMALS: Record<AnchorSide, Vec> = {
  top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
}

// A doc can carry an anchor this build does not know: an older schema, a newer peer, an
// import. Never let one unknown value take the whole render down.
const normalOf = (side: AnchorSide | null): Vec | null => (side ? NORMALS[side] ?? null : null)

export interface Ends { a: Vec; b: Vec }

export function resolveConnector(
  item: Item & { type: 'connector' },
  lookup: (id: string) => Item | undefined,
): Ends {
  const ia = item.from.itemId ? lookup(item.from.itemId) : undefined
  const ib = item.to.itemId ? lookup(item.to.itemId) : undefined
  const freeA = { x: item.from.x, y: item.from.y }
  const freeB = { x: item.to.x, y: item.to.y }
  const bends = connectorBends(item)
  const towardA = bends[0] ?? (ib ? center(ib) : freeB)
  const towardB = bends[bends.length - 1] ?? (ia ? center(ia) : freeA)
  return {
    a: ia ? anchorPoint(ia, item.from.anchor ?? nearestAnchor(ia, towardA)) : freeA,
    b: ib ? anchorPoint(ib, item.to.anchor ?? nearestAnchor(ib, towardB)) : freeB,
  }
}

export function makeResolver(index: Map<string, Item>) {
  return (item: Item & { type: 'connector' }) => resolveConnector(item, (id) => index.get(id))
}

export function connectorBounds(item: Item & { type: 'connector' }, ends: Ends): Rect {
  const pts = connectorPath(item, ends)
  if (item.shape === 'curved') {
    pts.push(...curveControls(item, ends.a, ends.b))
  }
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y)
  const pad = item.strokeWidth * 3
  return {
    x: Math.min(...xs) - pad,
    y: Math.min(...ys) - pad,
    w: Math.max(...xs) - Math.min(...xs) + pad * 2,
    h: Math.max(...ys) - Math.min(...ys) + pad * 2,
  }
}

export function connectorBends(item: Item & { type: 'connector' }): Vec[] {
  if (item.bends?.length) return item.bends
  return item.bend ? [item.bend] : []
}

export function smoothThrough(points: Vec[], steps = 12): Vec[] {
  if (points.length < 3) return points
  const out: Vec[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    const prev = i === 1 ? points[0] : midpoint(points[i - 1], points[i])
    const next = i === points.length - 2 ? points[i + 1] : midpoint(points[i], points[i + 1])
    const c = bendControl(prev, next, points[i])
    for (let s = 1; s <= steps; s++) {
      const t = s / steps, u = 1 - t
      out.push({
        x: u * u * prev.x + 2 * u * t * c.x + t * t * next.x,
        y: u * u * prev.y + 2 * u * t * c.y + t * t * next.y,
      })
    }
  }
  out.push(points[points.length - 1])
  return out
}

export const midpoint = (a: Vec, b: Vec): Vec => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })

export function connectorPath(item: Item & { type: 'connector' }, ends: Ends): Vec[] {
  const { a, b } = ends
  const bends = connectorBends(item)
  if (bends.length === 1 && item.shape === 'curved') {
    const c = bendControl(a, b, bends[0])
    const out: Vec[] = []
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, u = 1 - t
      out.push({
        x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
        y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
      })
    }
    return out
  }
  if (bends.length) {
    const through = [a, ...bends, b]
    return item.shape === 'curved' ? smoothThrough(through) : through
  }
  if (item.shape === 'straight') return [a, b]
  if (item.shape === 'elbow') {
    const dir = normalOf(item.from.anchor)
    if (dir && dir.y !== 0) {
      const my = (a.y + b.y) / 2
      return [a, { x: a.x, y: my }, { x: b.x, y: my }, b]
    }
    const mx = (a.x + b.x) / 2
    return [a, { x: mx, y: a.y }, { x: mx, y: b.y }, b]
  }
  const [c1, c2] = curveControls(item, a, b)
  const out: Vec[] = []
  for (let i = 0; i <= 24; i++) out.push(cubicAt(a, c1, c2, b, i / 24))
  return out
}

export const bendControl = (a: Vec, b: Vec, through: Vec): Vec => ({
  x: 2 * through.x - (a.x + b.x) / 2,
  y: 2 * through.y - (a.y + b.y) / 2,
})

export function curveControls(item: Item & { type: 'connector' }, a: Vec, b: Vec): [Vec, Vec] {
  const d = Math.max(40, Math.hypot(b.x - a.x, b.y - a.y) * 0.4)
  const na = normalOf(item.from.anchor) ?? { x: Math.sign(b.x - a.x) || 1, y: 0 }
  const nb = normalOf(item.to.anchor) ?? { x: Math.sign(a.x - b.x) || -1, y: 0 }
  return [
    { x: a.x + na.x * d, y: a.y + na.y * d },
    { x: b.x + nb.x * d, y: b.y + nb.y * d },
  ]
}

export function cubicAt(p0: Vec, p1: Vec, p2: Vec, p3: Vec, t: number): Vec {
  const u = 1 - t
  const a = u * u * u, b = 3 * u * u * t, c = 3 * u * t * t, d = t * t * t
  return {
    x: a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    y: a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  }
}
