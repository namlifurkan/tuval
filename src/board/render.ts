import getStroke from 'perfect-freehand'
import type { Camera } from './camera'
import { toScreen, viewportRect } from './camera'
import {
  ANCHOR_SIDES, aabb, anchorPoint, bendControl, connectorBends, connectorPath, corners,
  curveControls, midpoint, overlaps,
} from './geometry'
import type { Handle } from './geometry'
import { cellRect, resolveEndpoint } from './items'
import { shapePath, STROKE_ONLY, textInsetFor } from './shapes'
import type { Session } from './store'
import { fontString, layoutText, URL_RE } from './text'
import type { Cap, Id, Item, Rect, TextStyle, Vec } from './types'
import { BRAND } from './types'

const images = new Map<string, HTMLImageElement>()
export function getImage(src: string, onLoad: () => void) {
  let img = images.get(src)
  if (!img) {
    img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = onLoad
    img.src = src
    images.set(src, img)
  }
  return img.complete ? img : null
}

export interface Scene {
  ctx: CanvasRenderingContext2D
  cam: Camera
  width: number
  height: number
  items: Item[]
  selection: Set<Id>
  hover: Id | null
  editing: Id | null
  editingCell: [number, number] | null
  session: Session
  showGrid: boolean
  showAnchors: boolean
  dpr: number
}

export function render(s: Scene) {
  const { ctx, cam, width, height, dpr } = s
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.fillStyle = '#F2EFE9'
  ctx.fillRect(0, 0, width, height)
  if (s.showGrid) drawGrid(s)

  ctx.save()
  ctx.scale(cam.z, cam.z)
  ctx.translate(-cam.x, -cam.y)
  const view = viewportRect(cam, width, height)
  const pad = 200 / cam.z
  const visible = { x: view.x - pad, y: view.y - pad, w: view.w + pad * 2, h: view.h + pad * 2 }

  for (const item of s.items) {
    if (item.type !== 'connector' && !overlaps(aabb(item), visible)) continue
    drawItem(s, item)
  }
  ctx.restore()

  drawOverlay(s)
}

function drawGrid(s: Scene) {
  const { ctx, cam, width, height } = s
  let step = 25
  while (step * cam.z < 16) step *= 4
  const start = toScreen(cam, Math.floor(cam.x / step) * step, Math.floor(cam.y / step) * step)
  const gap = step * cam.z
  const alpha = Math.min(1, (gap - 12) / 18)
  if (alpha <= 0) return
  ctx.fillStyle = `rgba(20, 19, 16, ${0.16 * alpha})`
  const size = cam.z > 2 ? 2 : 1.6
  for (let x = start.x; x < width + gap; x += gap) {
    for (let y = start.y; y < height + gap; y += gap) {
      ctx.fillRect(x - size / 2, y - size / 2, size, size)
    }
  }
}

function withTransform(ctx: CanvasRenderingContext2D, item: Item, fn: () => void) {
  if (!item.rotation) return fn()
  const cx = item.x + item.w / 2, cy = item.y + item.h / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(item.rotation)
  ctx.translate(-cx, -cy)
  fn()
  ctx.restore()
}

function dash(ctx: CanvasRenderingContext2D, style: string, width: number) {
  if (style === 'dashed') ctx.setLineDash([width * 3, width * 2.2])
  else if (style === 'dotted') ctx.setLineDash([0.1, width * 2.4])
  else ctx.setLineDash([])
}

function drawItem(s: Scene, item: Item) {
  const { ctx } = s
  ctx.globalAlpha = item.opacity ?? 1
  withTransform(ctx, item, () => {
    switch (item.type) {
      case 'frame': drawFrame(s, item); break
      case 'sticky': drawSticky(s, item); break
      case 'shape': drawShape(s, item); break
      case 'text': drawTextItem(s, item); break
      case 'draw': drawStroke(s, item); break
      case 'image': drawImage(s, item); break
      case 'connector': drawConnector(s, item); break
      case 'table': drawTable(s, item); break
      case 'comment': break
    }
  })
  ctx.globalAlpha = 1
}

function drawFrame(s: Scene, item: Item & { type: 'frame' }) {
  const { ctx, cam } = s
  ctx.fillStyle = item.fill
  ctx.fillRect(item.x, item.y, item.w, item.h)
  ctx.lineWidth = 1 / cam.z
  ctx.strokeStyle = '#DDD8CD'
  ctx.setLineDash([])
  ctx.strokeRect(item.x, item.y, item.w, item.h)
  const size = 13 / cam.z
  ctx.fillStyle = s.selection.has(item.id) ? BRAND.selection : '#8A867C'
  ctx.font = fontString({ bold: false, italic: false, fontFamily: 'Instrument Sans' }, size)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(item.title, item.x, item.y - 6 / cam.z)
}

function drawSticky(s: Scene, item: Item & { type: 'sticky' }) {
  const { ctx } = s
  ctx.save()
  ctx.shadowColor = 'rgba(20, 19, 16, 0.18)'
  ctx.shadowBlur = 6
  ctx.shadowOffsetY = 3
  ctx.fillStyle = item.fill
  ctx.fillRect(item.x, item.y, item.w, item.h)
  ctx.restore()
  if (s.editing === item.id) return
  const inset = Math.min(item.w, item.h) * 0.1
  drawText(s, item, {
    x: item.x + inset, y: item.y + inset,
    w: item.w - inset * 2, h: item.h - inset * 2,
  })
}

function drawShape(s: Scene, item: Item & { type: 'shape' }) {
  const { ctx } = s
  const path = shapePath(item.kind, item.x, item.y, item.w, item.h)
  if (item.fill !== 'transparent' && !STROKE_ONLY.has(item.kind)) {
    ctx.fillStyle = item.fill
    ctx.fill(path)
  }
  if (item.strokeWidth > 0 && item.stroke !== 'transparent') {
    ctx.lineWidth = item.strokeWidth
    ctx.strokeStyle = item.stroke
    ctx.lineJoin = 'round'
    dash(ctx, item.strokeStyle, item.strokeWidth)
    ctx.stroke(path)
    ctx.setLineDash([])
  }
  if (s.editing === item.id) return
  const box = textInsetFor(item.kind, item.w, item.h)
  drawText(s, item, { x: item.x + box.x, y: item.y + box.y, w: box.w, h: box.h })
}

function drawTextItem(s: Scene, item: Item & { type: 'text' }) {
  if (s.editing === item.id) return
  if (item.fill && item.fill !== 'transparent') {
    s.ctx.fillStyle = item.fill
    s.ctx.fillRect(item.x, item.y, item.w, item.h)
  }
  drawText(s, item, { x: item.x, y: item.y, w: item.w, h: item.h })
}

function drawStroke(s: Scene, item: Item & { type: 'draw' }) {
  const { ctx } = s
  const pts: number[][] = []
  for (let i = 0; i < item.points.length; i += 3) {
    pts.push([item.x + item.points[i] * item.w, item.y + item.points[i + 1] * item.h, item.points[i + 2]])
  }
  if (!pts.length) return
  const outline = getStroke(pts, {
    size: item.strokeWidth,
    thinning: item.highlighter ? 0 : 0.55,
    smoothing: 0.6,
    streamline: 0.4,
    simulatePressure: false,
    last: true,
  })
  const path = new Path2D()
  outline.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
  path.closePath()
  ctx.globalAlpha = (item.opacity ?? 1) * (item.highlighter ? 0.4 : 1)
  ctx.fillStyle = item.stroke
  ctx.fill(path)
  ctx.globalAlpha = 1
}

function drawImage(s: Scene, item: Item & { type: 'image' }) {
  const img = getImage(item.src, () => s.session && requestAnimationFrame(() => {}))
  if (img) s.ctx.drawImage(img, item.x, item.y, item.w, item.h)
  else {
    s.ctx.fillStyle = '#E9E9EE'
    s.ctx.fillRect(item.x, item.y, item.w, item.h)
  }
}

function capLength(cap: Cap, width: number) {
  return cap === 'none' ? 0 : width * 4
}

function drawCap(ctx: CanvasRenderingContext2D, cap: Cap, at: Vec, dir: Vec, width: number, color: string) {
  if (cap === 'none') return
  const len = width * 4
  const a = Math.atan2(dir.y, dir.x)
  ctx.save()
  ctx.translate(at.x, at.y)
  ctx.rotate(a)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.setLineDash([])
  ctx.beginPath()
  if (cap === 'arrow') {
    ctx.lineWidth = width
    ctx.lineCap = 'round'
    ctx.moveTo(-len, -len * 0.62)
    ctx.lineTo(0, 0)
    ctx.lineTo(-len, len * 0.62)
    ctx.stroke()
  } else if (cap === 'triangle') {
    ctx.moveTo(0, 0)
    ctx.lineTo(-len, -len * 0.55)
    ctx.lineTo(-len, len * 0.55)
    ctx.closePath()
    ctx.fill()
  } else if (cap === 'circle') {
    ctx.arc(-len * 0.4, 0, len * 0.42, 0, Math.PI * 2)
    ctx.fill()
  } else if (cap === 'diamond') {
    ctx.moveTo(0, 0)
    ctx.lineTo(-len * 0.5, -len * 0.45)
    ctx.lineTo(-len, 0)
    ctx.lineTo(-len * 0.5, len * 0.45)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()
}

export function connectorMid(item: Item & { type: 'connector' }): Vec {
  const bends = connectorBends(item)
  if (bends.length) return bends[Math.floor(bends.length / 2)]
  const pts = connectorPath(item, resolveEndpoint)
  return pts[Math.floor(pts.length / 2)]
}

export function connectorHandles(item: Item & { type: 'connector' }) {
  const a = resolveEndpoint(item.from), b = resolveEndpoint(item.to)
  const bends = connectorBends(item)
  const through = [a, ...bends, b]
  const ghosts: { at: Vec; index: number }[] = []
  for (let i = 0; i < through.length - 1; i++) ghosts.push({ at: midpoint(through[i], through[i + 1]), index: i })
  return { bends, ghosts }
}

export function connectorGeometry(item: Item & { type: 'connector' }) {
  const a = resolveEndpoint(item.from)
  const b = resolveEndpoint(item.to)
  return { a, b }
}

function drawConnector(s: Scene, item: Item & { type: 'connector' }) {
  const { ctx } = s
  const { a, b } = connectorGeometry(item)
  const path = new Path2D()
  const startTrim = capLength(item.capStart, item.strokeWidth)
  const endTrim = capLength(item.capEnd, item.strokeWidth)

  const bendList = connectorBends(item)
  if (item.shape === 'curved' && bendList.length === 1) {
    const c = bendControl(a, b, bendList[0])
    path.moveTo(a.x, a.y)
    path.quadraticCurveTo(c.x, c.y, b.x, b.y)
  } else if (item.shape === 'curved' && bendList.length === 0) {
    const [c1, c2] = curveControls(item, a, b)
    path.moveTo(a.x, a.y)
    path.bezierCurveTo(c1.x, c1.y, c2.x, c2.y, b.x, b.y)
  } else {
    const pts = connectorPath(item, resolveEndpoint)
    pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)))
  }
  ctx.lineWidth = item.strokeWidth
  ctx.strokeStyle = item.stroke
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  dash(ctx, item.strokeStyle, item.strokeWidth)
  ctx.stroke(path)
  ctx.setLineDash([])

  const pts = connectorPath(item, resolveEndpoint)
  const dirEnd = { x: b.x - pts[pts.length - 2].x, y: b.y - pts[pts.length - 2].y }
  const dirStart = { x: a.x - pts[1].x, y: a.y - pts[1].y }
  drawCap(ctx, item.capEnd, b, dirEnd, item.strokeWidth, item.stroke)
  drawCap(ctx, item.capStart, a, dirStart, item.strokeWidth, item.stroke)
  void startTrim; void endTrim

  if (item.text && s.editing !== item.id) {
    const mid = pts[Math.floor(pts.length / 2)]
    const font = fontString(item, item.fontSize)
    ctx.font = font
    const w = ctx.measureText(item.text).width
    ctx.fillStyle = '#FCFBF8'
    ctx.fillRect(mid.x - w / 2 - 4, mid.y - item.fontSize * 0.75, w + 8, item.fontSize * 1.5)
    ctx.fillStyle = item.textColor
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(item.text, mid.x, mid.y)
  }
}

function drawTable(s: Scene, item: Item & { type: 'table' }) {
  const { ctx } = s
  ctx.fillStyle = item.fill
  ctx.fillRect(item.x, item.y, item.w, item.h)
  if (item.headerRow) {
    const head = cellRect(item, 0, 0)
    ctx.fillStyle = item.headerFill
    ctx.fillRect(item.x, item.y, item.w, head.h)
  }

  ctx.strokeStyle = item.stroke
  ctx.lineWidth = item.strokeWidth
  ctx.setLineDash([])
  ctx.beginPath()
  for (let r = 0; r <= item.rows; r++) {
    const y = r === item.rows ? item.y + item.h : cellRect(item, r, 0).y
    ctx.moveTo(item.x, y)
    ctx.lineTo(item.x + item.w, y)
  }
  for (let c = 0; c <= item.cols; c++) {
    const x = c === item.cols ? item.x + item.w : cellRect(item, 0, c).x
    ctx.moveTo(x, item.y)
    ctx.lineTo(x, item.y + item.h)
  }
  ctx.stroke()

  const editing = s.editing === item.id ? s.editingCell : null
  for (let r = 0; r < item.rows; r++) {
    for (let c = 0; c < item.cols; c++) {
      if (editing && editing[0] === r && editing[1] === c) continue
      const text = item.cells[r]?.[c]
      if (!text) continue
      const rect = cellRect(item, r, c)
      const pad = 8
      drawText(
        s,
        { ...item, text, bold: item.bold || (item.headerRow && r === 0) },
        { x: rect.x + pad, y: rect.y + pad / 2, w: rect.w - pad * 2, h: rect.h - pad },
      )
    }
  }
}

interface Run { text: string; link: boolean }

function splitRuns(text: string): Run[] {
  const runs: Run[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const at = m.index ?? 0
    if (at > last) runs.push({ text: text.slice(last, at), link: false })
    runs.push({ text: m[0], link: true })
    last = at + m[0].length
  }
  if (last < text.length) runs.push({ text: text.slice(last), link: false })
  return runs.length ? runs : [{ text, link: false }]
}

function drawText(s: Scene, item: Item & TextStyle & { text: string }, box: Rect) {
  if (!item.text) return
  const { ctx } = s
  const layout = layoutText(item.text, box.w, box.h, item)
  ctx.font = fontString(item, layout.fontSize)

  if (layout.fontSize * s.cam.z < 3.5) {
    ctx.fillStyle = item.textColor
    ctx.globalAlpha = 0.35
    const rows = Math.min(layout.lines.length, Math.floor(box.h / layout.lineHeight))
    for (let i = 0; i < rows; i++) {
      ctx.fillRect(box.x, box.y + i * layout.lineHeight, box.w * 0.86, layout.fontSize * 0.62)
    }
    ctx.globalAlpha = 1
    return
  }

  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  const total = layout.lines.length * layout.lineHeight
  const startY =
    item.valign === 'top' ? box.y : item.valign === 'bottom' ? box.y + box.h - total : box.y + (box.h - total) / 2
  const rule = Math.max(1, layout.fontSize / 16)

  layout.lines.forEach((line, i) => {
    const y = startY + i * layout.lineHeight + layout.lineHeight / 2
    const runs = splitRuns(line.text)
    const widths = runs.map((r) => ctx.measureText(r.text).width)
    const lineWidth = widths.reduce((a, b) => a + b, 0)

    let x: number
    if (line.marker) {
      x = box.x + line.indent
      ctx.fillStyle = item.textColor
      ctx.fillText(line.marker, box.x, y)
    } else if (item.align === 'left') x = box.x
    else if (item.align === 'right') x = box.x + box.w - lineWidth
    else x = box.x + (box.w - lineWidth) / 2

    runs.forEach((run, j) => {
      ctx.fillStyle = run.link ? BRAND.pigment : item.textColor
      ctx.fillText(run.text, x, y)
      if (run.link || item.underline) ctx.fillRect(x, y + layout.fontSize * 0.42, widths[j], rule)
      if (item.strike) ctx.fillRect(x, y - layout.fontSize * 0.05, widths[j], rule)
      x += widths[j]
    })
  })
}

export const PIN_R = 15
export const PIN_LIFT = 26

export function commentPinScreen(cam: Camera, item: Item): Vec {
  const p = toScreen(cam, item.x, item.y)
  return { x: p.x + PIN_R, y: p.y - PIN_LIFT }
}

function drawCommentPin(s: Scene, item: Item & { type: 'comment' }) {
  const { ctx, cam } = s
  const c = commentPinScreen(cam, item)
  const tip = toScreen(cam, item.x, item.y)
  const selected = s.selection.has(item.id)
  ctx.save()
  ctx.globalAlpha = item.resolved ? 0.42 : 1
  ctx.beginPath()
  ctx.moveTo(tip.x, tip.y)
  ctx.lineTo(c.x - PIN_R * 0.55, c.y + PIN_R * 0.5)
  ctx.lineTo(c.x + PIN_R * 0.2, c.y + PIN_R * 0.92)
  ctx.closePath()
  ctx.fillStyle = '#FCFBF8'
  ctx.strokeStyle = selected ? BRAND.selection : 'rgba(20,19,16,0.16)'
  ctx.lineWidth = selected ? 2 : 1
  ctx.fill()
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(c.x, c.y, PIN_R, 0, Math.PI * 2)
  ctx.fillStyle = '#FCFBF8'
  ctx.fill()
  ctx.stroke()
  const first = item.replies[0]
  ctx.fillStyle = first?.color ?? '#8A867C'
  ctx.beginPath()
  ctx.arc(c.x, c.y, PIN_R - 4, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#FCFBF8'
  ctx.font = '700 11px "Instrument Sans", system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    item.replies.length > 1 ? String(item.replies.length) : (first?.author?.[0] ?? '?').toUpperCase(),
    c.x, c.y + 0.5,
  )
  ctx.restore()
}

export type QuickSide = 'top' | 'right' | 'bottom' | 'left'
const QUICK_OFFSET = 26
const QUICK_R = 11

export function quickArrowScreens(cam: Camera, item: Item): { side: QuickSide; x: number; y: number }[] {
  const c = toScreen(cam, item.x + item.w / 2, item.y + item.h / 2)
  const hw = (item.w / 2) * cam.z + QUICK_OFFSET
  const hh = (item.h / 2) * cam.z + QUICK_OFFSET
  const cos = Math.cos(item.rotation), sin = Math.sin(item.rotation)
  const at = (lx: number, ly: number) => ({ x: c.x + lx * cos - ly * sin, y: c.y + lx * sin + ly * cos })
  return [
    { side: 'top' as const, ...at(0, -hh) },
    { side: 'right' as const, ...at(hw, 0) },
    { side: 'bottom' as const, ...at(0, hh) },
    { side: 'left' as const, ...at(-hw, 0) },
  ]
}

export const QUICK_TYPES = new Set(['sticky', 'shape', 'text', 'image'])

function drawQuickArrows(s: Scene, item: Item) {
  const { ctx } = s
  for (const a of quickArrowScreens(s.cam, item)) {
    ctx.beginPath()
    ctx.arc(a.x, a.y, QUICK_R, 0, Math.PI * 2)
    ctx.fillStyle = '#FCFBF8'
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,19,16,0.14)'
    ctx.lineWidth = 1
    ctx.stroke()
    ctx.save()
    ctx.translate(a.x, a.y)
    ctx.rotate(
      a.side === 'right' ? 0 : a.side === 'bottom' ? Math.PI / 2 : a.side === 'left' ? Math.PI : -Math.PI / 2,
    )
    ctx.strokeStyle = BRAND.selection
    ctx.lineWidth = 1.8
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(-3.5, 0)
    ctx.lineTo(3, 0)
    ctx.moveTo(0.2, -3.2)
    ctx.lineTo(3.4, 0)
    ctx.lineTo(0.2, 3.2)
    ctx.stroke()
    ctx.restore()
  }
}

export const quickHit = (cam: Camera, item: Item, screen: Vec): QuickSide | null => {
  for (const a of quickArrowScreens(cam, item)) {
    if (Math.hypot(a.x - screen.x, a.y - screen.y) <= QUICK_R + 2) return a.side
  }
  return null
}

const HANDLE_SIZE = 9

export function handleScreenRects(cam: Camera, box: Rect & { rotation: number }) {
  const out: { handle: Handle; x: number; y: number }[] = []
  const hs: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  for (const h of hs) {
    const hw = box.w / 2, hh = box.h / 2
    const local = {
      x: h.includes('w') ? -hw : h.includes('e') ? hw : 0,
      y: h.includes('n') ? -hh : h.includes('s') ? hh : 0,
    }
    const c = { x: box.x + hw, y: box.y + hh }
    const cos = Math.cos(box.rotation), sin = Math.sin(box.rotation)
    const p = toScreen(cam, c.x + local.x * cos - local.y * sin, c.y + local.x * sin + local.y * cos)
    out.push({ handle: h, x: p.x, y: p.y })
  }
  return out
}

function drawOverlay(s: Scene) {
  const { ctx, cam, session } = s
  ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0)
  ctx.lineCap = 'butt'

  if (session.dropFrame) {
    const frame = s.items.find((i) => i.id === session.dropFrame)
    if (frame) {
      const p = toScreen(cam, frame.x, frame.y)
      ctx.strokeStyle = BRAND.selection
      ctx.lineWidth = 2
      ctx.setLineDash([])
      ctx.strokeRect(p.x, p.y, frame.w * cam.z, frame.h * cam.z)
    }
  }

  for (const mark of session.spacing) {
    const p = toScreen(cam, mark.x, mark.y)
    ctx.fillStyle = BRAND.guide
    ctx.fillRect(p.x, p.y, Math.max(2, mark.w * cam.z), Math.max(2, mark.h * cam.z))
  }

  for (const [a, b] of session.guides) {
    const p = toScreen(cam, a.x, a.y), q = toScreen(cam, b.x, b.y)
    ctx.strokeStyle = BRAND.guide
    ctx.lineWidth = 1
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
    ctx.lineTo(q.x, q.y)
    ctx.stroke()
    ctx.setLineDash([])
  }

  for (const item of s.items) {
    if (item.type === 'comment') drawCommentPin(s, item)
  }

  const selected = s.items.filter((i) => s.selection.has(i.id))
  if (s.hover && !s.selection.has(s.hover)) {
    const item = s.items.find((i) => i.id === s.hover)
    if (item && item.type !== 'connector' && item.type !== 'comment') {
      outline(ctx, cam, item, 'rgba(66, 98, 255, 0.55)', 1.5)
    }
  }

  if (selected.length === 1 && s.editing !== selected[0].id) {
    const item = selected[0]
    if (item.type === 'comment') { /* pin drawn above */ }
    else if (item.type === 'connector') {
      const { a, b } = connectorGeometry(item)
      for (const p of [a, b]) {
        const sp = toScreen(cam, p.x, p.y)
        dot(ctx, sp.x, sp.y, 5)
      }
      const handles = connectorHandles(item)
      for (const g of handles.ghosts) {
        const sp = toScreen(cam, g.at.x, g.at.y)
        ctx.globalAlpha = 0.45
        dot(ctx, sp.x, sp.y, 4)
        ctx.globalAlpha = 1
      }
      for (const bendAt of handles.bends) {
        const sp = toScreen(cam, bendAt.x, bendAt.y)
        dot(ctx, sp.x, sp.y, 4.5)
      }
    } else {
      outline(ctx, cam, item, BRAND.selection, 2)
      if (item.locked) drawLockBadge(ctx, cam, item)
      else {
        drawHandles(ctx, cam, item)
        if (QUICK_TYPES.has(item.type)) drawQuickArrows(s, item)
      }
    }
  } else if (selected.length > 1) {
    for (const item of selected) {
      if (item.type === 'connector') continue
      outline(ctx, cam, item, 'rgba(66, 98, 255, 0.7)', 1.5)
    }
    const box = boxOf(selected)
    const p = toScreen(cam, box.x, box.y)
    ctx.strokeStyle = BRAND.selection
    ctx.lineWidth = 2
    ctx.strokeRect(p.x, p.y, box.w * cam.z, box.h * cam.z)
    drawHandles(ctx, cam, { ...box, rotation: 0 })
  }

  if (s.showAnchors && s.hover) {
    const item = s.items.find((i) => i.id === s.hover)
    if (item && item.type !== 'connector' && item.type !== 'frame' && item.type !== 'comment') {
      for (const side of ANCHOR_SIDES) {
        const p = toScreen(cam, ...(({ x, y }) => [x, y] as [number, number])(anchorPoint(item, side)))
        dot(ctx, p.x, p.y, 5)
      }
    }
  }

  if (session.connectorDraft) {
    const a = toScreen(cam, session.connectorDraft.from.x, session.connectorDraft.from.y)
    const b = toScreen(cam, session.connectorDraft.to.x, session.connectorDraft.to.y)
    ctx.strokeStyle = BRAND.selection
    ctx.lineWidth = 2
    ctx.setLineDash([6, 4])
    ctx.beginPath()
    ctx.moveTo(a.x, a.y)
    ctx.lineTo(b.x, b.y)
    ctx.stroke()
    ctx.setLineDash([])
    dot(ctx, b.x, b.y, 5)
  }

  if (session.marquee) {
    const m = session.marquee
    const p = toScreen(cam, m.x, m.y)
    ctx.fillStyle = 'rgba(66, 98, 255, 0.08)'
    ctx.strokeStyle = BRAND.selection
    ctx.lineWidth = 1
    ctx.fillRect(p.x, p.y, m.w * cam.z, m.h * cam.z)
    ctx.strokeRect(p.x, p.y, m.w * cam.z, m.h * cam.z)
  }

  if (session.badge) {
    const box = selected.length ? boxOf(selected) : null
    if (box) {
      const at = toScreen(cam, box.x + box.w / 2, box.y + box.h)
      ctx.font = '600 12px "Instrument Sans", system-ui, sans-serif'
      const w = ctx.measureText(session.badge).width + 16
      ctx.beginPath()
      ctx.roundRect(at.x - w / 2, at.y + 12, w, 24, 6)
      ctx.fillStyle = BRAND.selection
      ctx.fill()
      ctx.fillStyle = '#FCFBF8'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(session.badge, at.x, at.y + 24.5)
    }
  }

  for (const user of session.remote) {
    if (!user.cursor) continue
    const p = toScreen(cam, user.cursor.x, user.cursor.y)
    drawCursor(ctx, p, user.color, user.name)
  }
}

export function boxOf(items: Item[]): Rect {
  const rects = items.map(aabb)
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const r of rects) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y)
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function outline(ctx: CanvasRenderingContext2D, cam: Camera, item: Item, color: string, width: number) {
  if (item.type === 'connector') return
  const pts = corners(item).map((p) => toScreen(cam, p.x, p.y))
  ctx.setLineDash([])
  ctx.beginPath()
  pts.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)))
  ctx.closePath()
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.lineWidth = width + 2
  ctx.stroke()
  ctx.strokeStyle = color
  ctx.lineWidth = width
  ctx.stroke()
}

function drawHandles(ctx: CanvasRenderingContext2D, cam: Camera, box: Rect & { rotation: number }) {
  for (const h of handleScreenRects(cam, box)) {
    const small = h.handle.length === 1
    const w = small ? HANDLE_SIZE - 2 : HANDLE_SIZE
    ctx.save()
    ctx.translate(h.x, h.y)
    ctx.rotate(box.rotation)
    ctx.fillStyle = '#FCFBF8'
    ctx.strokeStyle = BRAND.selection
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.roundRect(-w / 2, -w / 2, w, w, 2)
    ctx.fill()
    ctx.stroke()
    ctx.restore()
  }
}

function drawLockBadge(ctx: CanvasRenderingContext2D, cam: Camera, item: Item) {
  const p = toScreen(cam, item.x + item.w, item.y)
  ctx.save()
  ctx.translate(p.x + 2, p.y - 2)
  ctx.beginPath()
  ctx.arc(0, 0, 11, 0, Math.PI * 2)
  ctx.fillStyle = BRAND.selection
  ctx.fill()
  ctx.strokeStyle = '#FCFBF8'
  ctx.lineWidth = 1.6
  ctx.beginPath()
  ctx.arc(0, -1.6, 3.1, Math.PI, 0)
  ctx.stroke()
  ctx.fillStyle = '#FCFBF8'
  ctx.beginPath()
  ctx.roundRect(-4.4, -1.6, 8.8, 6.6, 1.6)
  ctx.fill()
  ctx.restore()
}

function dot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number) {
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fillStyle = '#FCFBF8'
  ctx.fill()
  ctx.lineWidth = 2
  ctx.strokeStyle = BRAND.selection
  ctx.stroke()
}

function drawCursor(ctx: CanvasRenderingContext2D, p: Vec, color: string, name: string) {
  ctx.save()
  ctx.translate(p.x, p.y)
  ctx.beginPath()
  ctx.moveTo(0, 0)
  ctx.lineTo(0, 17)
  ctx.lineTo(4.5, 12.8)
  ctx.lineTo(10.5, 12.2)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.strokeStyle = '#FCFBF8'
  ctx.lineWidth = 1.4
  ctx.fill()
  ctx.stroke()
  ctx.font = '600 11px "Instrument Sans", system-ui, sans-serif'
  const w = ctx.measureText(name).width
  ctx.beginPath()
  ctx.roundRect(12, 12, w + 14, 20, 10)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = '#FCFBF8'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(name, 19, 22.5)
  ctx.restore()
}
