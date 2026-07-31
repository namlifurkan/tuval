import getStroke from 'perfect-freehand'
import type { Camera } from './camera'
import { toScreen, viewportRect } from './camera'
import {
  ANCHOR_SIDES, aabb, anchorPoint, bendControl, connectorBends, connectorPath, corners,
  curveControls, midpoint, overlaps,
} from './geometry'
import type { Handle } from './geometry'
import { CODE_LINE, CODE_PAD, cellRect, connectorEnds, isCovered, spanRect } from './items'
import { CODE_THEME, tokenize } from './code'
import { labelColor, labelFontSize, labelHeight, labelInk } from './labels'
import { initials } from './me'
import { drawPaper } from './paper'
import type { TextureId } from './paper'
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
  surface: string
  texture: TextureId
  showAnchors: boolean
  dpr: number
}

export function render(s: Scene) {
  const { ctx, cam, width, height, dpr } = s
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  drawPaper(ctx, cam, width, height, s.surface, s.texture)

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
  if (s.session.draft) drawDraftStroke(ctx, s.session.draft)
  ctx.restore()

  drawOverlay(s)
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
      case 'embed': drawEmbed(s, item); break
      case 'code': drawCode(s, item); break
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
  const size = 11 / cam.z
  ctx.fillStyle = s.selection.has(item.id) ? BRAND.selection : '#8A867C'
  ctx.font = fontString({ bold: true, italic: false, fontFamily: 'Instrument Sans' }, size)
  ctx.letterSpacing = `${1.4 / cam.z}px`
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(item.title.toUpperCase(), item.x, item.y - 7 / cam.z)
  const titleW = ctx.measureText(item.title.toUpperCase()).width
  ctx.letterSpacing = '0px'

  const crew = item.assignees ?? []
  if (crew.length) {
    const chip = 16 / cam.z
    let x = item.x + titleW + 10 / cam.z
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const person of crew) {
      const box = new Path2D()
      box.roundRect(x, item.y - 7 / cam.z - chip * 0.78, chip, chip, chip * 0.28)
      ctx.fillStyle = person.color
      ctx.fill(box)
      ctx.fillStyle = '#FCFBF8'
      ctx.font = `700 ${chip * 0.5}px "Instrument Sans", system-ui, sans-serif`
      ctx.fillText(initials(person.name), x + chip / 2, item.y - 7 / cam.z - chip * 0.28)
      x += chip + 3 / cam.z
    }
    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
  }
}

function drawSticky(s: Scene, item: Item & { type: 'sticky' }) {
  const { ctx } = s
  ctx.save()
  const off = Math.min(item.w, item.h) * 0.022
  ctx.fillStyle = 'rgba(20, 19, 16, 0.10)'
  ctx.fillRect(item.x + off, item.y + off, item.w, item.h)
  ctx.fillStyle = item.fill
  ctx.fillRect(item.x, item.y, item.w, item.h)
  ctx.restore()
  ctx.strokeStyle = 'rgba(20, 19, 16, 0.10)'
  ctx.lineWidth = Math.max(1, Math.min(item.w, item.h) * 0.008)
  ctx.strokeRect(item.x, item.y, item.w, item.h)

  if (s.editing === item.id) return
  const inset = Math.min(item.w, item.h) * 0.1
  let top = item.y + inset
  let room = item.h - inset * 2
  if (item.label) {
    const chipH = labelHeight(item.w, item.h, item.labelSize)
    const font = `700 ${labelFontSize(item.w, item.h, item.labelSize)}px "Instrument Sans", system-ui, sans-serif`
    ctx.font = font
    ctx.letterSpacing = `${chipH * 0.07}px`
    const text = item.label.toUpperCase()
    const chipW = Math.min(item.w - inset * 2, ctx.measureText(text).width + chipH * 0.9)
    const chip = new Path2D()
    chip.roundRect(item.x + inset, top, chipW, chipH, chipH * 0.28)
    ctx.fillStyle = labelColor(item.label)
    ctx.fill(chip)
    ctx.fillStyle = labelInk(labelColor(item.label))
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, item.x + inset + chipH * 0.45, top + chipH * 0.55, chipW - chipH * 0.9)
    ctx.letterSpacing = '0px'
    top += chipH + chipH * 0.35
    room -= chipH + chipH * 0.35
  }
  drawText(s, item, { x: item.x + inset, y: top, w: item.w - inset * 2, h: Math.max(room, 1) })
}

function drawShape(s: Scene, item: Item & { type: 'shape' }) {
  const { ctx } = s
  const path = shapePath(item.kind, item.x, item.y, item.w, item.h)
  const inked = item.strokeWidth > 0 && item.stroke !== 'transparent'
  if (item.fill !== 'transparent' && !STROKE_ONLY.has(item.kind)) {
    ctx.fillStyle = item.fill
    ctx.fill(path)
    if (!inked) {
      ctx.strokeStyle = 'rgba(20, 19, 16, 0.12)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([])
      ctx.stroke(path)
    }
  }
  if (inked) {
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
  const path = strokeOutline(pts, item.strokeWidth, item.highlighter)
  ctx.globalAlpha = (item.opacity ?? 1) * (item.highlighter ? 0.4 : 1)
  ctx.fillStyle = item.stroke
  ctx.fill(path)
  ctx.globalAlpha = 1
}

function strokeOutline(pts: number[][], size: number, highlighter: boolean) {
  const outline = getStroke(pts, {
    size,
    thinning: highlighter ? 0 : 0.55,
    smoothing: 0.6,
    streamline: 0.4,
    simulatePressure: false,
    last: true,
  })
  const path = new Path2D()
  outline.forEach(([x, y], i) => (i ? path.lineTo(x, y) : path.moveTo(x, y)))
  path.closePath()
  return path
}

function drawDraftStroke(
  ctx: CanvasRenderingContext2D,
  draft: { pts: number[][]; stroke: string; strokeWidth: number; highlighter: boolean },
) {
  if (draft.pts.length < 2) return
  ctx.save()
  ctx.globalAlpha = draft.highlighter ? 0.4 : 1
  ctx.fillStyle = draft.stroke
  ctx.fill(strokeOutline(draft.pts, draft.strokeWidth, draft.highlighter))
  ctx.restore()
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
  const pts = connectorPath(item, connectorEnds(item))
  return pts[Math.floor(pts.length / 2)]
}

export function connectorHandles(item: Item & { type: 'connector' }) {
  const { a, b } = connectorEnds(item)
  const bends = connectorBends(item)
  const through = [a, ...bends, b]
  const ghosts: { at: Vec; index: number }[] = []
  for (let i = 0; i < through.length - 1; i++) ghosts.push({ at: midpoint(through[i], through[i + 1]), index: i })
  return { bends, ghosts }
}

export const connectorGeometry = connectorEnds

function drawConnector(s: Scene, item: Item & { type: 'connector' }) {
  const { ctx } = s
  const ends = connectorEnds(item)
  const { a, b } = ends
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
    const pts = connectorPath(item, ends)
    pts.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)))
  }
  ctx.lineWidth = item.strokeWidth
  ctx.strokeStyle = item.stroke
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  dash(ctx, item.strokeStyle, item.strokeWidth)
  ctx.stroke(path)
  ctx.setLineDash([])

  const pts = connectorPath(item, ends)
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

function drawCode(s: Scene, item: Item & { type: 'code' }) {
  const { ctx } = s
  const t = CODE_THEME[item.theme]
  const path = new Path2D()
  path.roundRect(item.x, item.y, item.w, item.h, 8)
  ctx.fillStyle = t.bg
  ctx.fill(path)
  ctx.strokeStyle = t.edge
  ctx.lineWidth = 1
  ctx.setLineDash([])
  ctx.stroke(path)
  if (s.editing === item.id) return

  const lines = item.text.split('\n')
  const lh = item.fontSize * CODE_LINE
  const gutterW = item.showLines
    ? Math.max(2, String(lines.length).length) * item.fontSize * 0.62 + 10
    : 0

  ctx.save()
  ctx.beginPath()
  ctx.rect(item.x, item.y, item.w, item.h)
  ctx.clip()
  ctx.font = `${item.fontSize}px "JetBrains Mono", ui-monospace, "SF Mono", Menlo, monospace`
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'

  lines.forEach((line, n) => {
    const y = item.y + CODE_PAD + lh * n + lh / 2
    if (y < item.y - lh || y > item.y + item.h + lh) return
    if (item.showLines) {
      ctx.fillStyle = t.gutter
      ctx.textAlign = 'right'
      ctx.fillText(String(n + 1), item.x + CODE_PAD + gutterW - 10, y)
      ctx.textAlign = 'left'
    }
    let x = item.x + CODE_PAD + gutterW
    for (const token of tokenize(line, item.lang)) {
      ctx.fillStyle = t[token.kind]
      ctx.fillText(token.text, x, y)
      x += ctx.measureText(token.text).width
    }
  })
  ctx.restore()

  ctx.fillStyle = t.gutter
  ctx.font = '600 10px "Instrument Sans", system-ui, sans-serif'
  ctx.textAlign = 'right'
  ctx.textBaseline = 'alphabetic'
  ctx.letterSpacing = '1px'
  ctx.fillText(item.lang.toUpperCase(), item.x + item.w - 10, item.y + 15)
  ctx.letterSpacing = '0px'
  ctx.textAlign = 'left'
}

function drawEmbed(s: Scene, item: Item & { type: 'embed' }) {
  const { ctx, cam } = s
  ctx.fillStyle = '#EBE7DE'
  ctx.beginPath()
  ctx.roundRect(item.x, item.y, item.w, item.h, 8)
  ctx.fill()
  ctx.strokeStyle = '#DDD8CD'
  ctx.lineWidth = 1 / cam.z
  ctx.stroke()
  const size = Math.min(item.h * 0.16, 26)
  ctx.fillStyle = '#8A867C'
  ctx.font = fontString({ bold: false, italic: false, fontFamily: 'Instrument Sans' }, size)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(item.title, item.x + item.w / 2, item.y + item.h / 2)
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

  // Each visible cell draws its own outline. Ruling the whole grid would put lines through
  // the middle of a merged block.
  ctx.strokeStyle = item.stroke
  ctx.lineWidth = item.strokeWidth
  ctx.setLineDash([])
  ctx.beginPath()
  for (let r = 0; r < item.rows; r++) {
    for (let c = 0; c < item.cols; c++) {
      if (isCovered(item, r, c)) continue
      const rect = spanRect(item, r, c)
      ctx.rect(rect.x, rect.y, rect.w, rect.h)
    }
  }
  ctx.stroke()

  const editing = s.editing === item.id ? s.editingCell : null
  for (let r = 0; r < item.rows; r++) {
    for (let c = 0; c < item.cols; c++) {
      if (editing && editing[0] === r && editing[1] === c) continue
      if (isCovered(item, r, c)) continue
      const text = item.cells[r]?.[c]
      if (!text) continue
      const rect = spanRect(item, r, c)
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
  ctx.roundRect(c.x - PIN_R, c.y - PIN_R, PIN_R * 2, PIN_R * 2, 4)
  ctx.fillStyle = '#FCFBF8'
  ctx.fill()
  ctx.stroke()
  const first = item.replies[0]
  ctx.fillStyle = first?.color ?? '#8A867C'
  ctx.fillRect(c.x - PIN_R + 4, c.y - PIN_R + 4, (PIN_R - 4) * 2, (PIN_R - 4) * 2)
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
  const { ctx, cam } = s
  const c = toScreen(cam, item.x + item.w / 2, item.y + item.h / 2)
  for (const a of quickArrowScreens(cam, item)) {
    const len = Math.hypot(a.x - c.x, a.y - c.y) || 1
    const dx = (a.x - c.x) / len, dy = (a.y - c.y) / len
    ctx.save()
    ctx.lineCap = 'butt'
    ctx.strokeStyle = 'rgba(20,19,16,0.35)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(a.x - dx * (QUICK_R + 9), a.y - dy * (QUICK_R + 9))
    ctx.lineTo(a.x - dx * (QUICK_R + 1), a.y - dy * (QUICK_R + 1))
    ctx.stroke()

    ctx.beginPath()
    ctx.roundRect(a.x - QUICK_R, a.y - QUICK_R, QUICK_R * 2, QUICK_R * 2, 4)
    ctx.fillStyle = '#FCFBF8'
    ctx.fill()
    ctx.strokeStyle = 'rgba(20,19,16,0.22)'
    ctx.stroke()

    ctx.strokeStyle = BRAND.selection
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(a.x - 4, a.y)
    ctx.lineTo(a.x + 4, a.y)
    ctx.moveTo(a.x, a.y - 4)
    ctx.lineTo(a.x, a.y + 4)
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
      outline(ctx, cam, item, 'rgba(20, 19, 16, 0.30)', 1.5)
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
      outline(ctx, cam, item, 'rgba(20, 19, 16, 0.45)', 1.5)
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
    ctx.fillStyle = 'rgba(200, 69, 45, 0.06)'
    ctx.strokeStyle = BRAND.guide
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
    if (user.chat && Date.now() - user.chat.at < 12000) {
      drawChatBubble(ctx, p, user.color, user.chat.text)
    }
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
  const arm = 9
  const edge = 7
  for (const h of handleScreenRects(cam, box)) {
    ctx.save()
    ctx.translate(h.x, h.y)
    ctx.rotate(box.rotation)
    ctx.lineCap = 'butt'

    const path = new Path2D()
    if (h.handle.length === 2) {
      const sx = h.handle.includes('w') ? -1 : 1
      const sy = h.handle.includes('n') ? -1 : 1
      path.moveTo(sx * arm, 0)
      path.lineTo(0, 0)
      path.lineTo(0, sy * arm)
    } else if (h.handle === 'n' || h.handle === 's') {
      path.moveTo(-edge, 0)
      path.lineTo(edge, 0)
    } else {
      path.moveTo(0, -edge)
      path.lineTo(0, edge)
    }

    ctx.strokeStyle = 'rgba(252, 251, 248, 0.9)'
    ctx.lineWidth = 4
    ctx.stroke(path)
    ctx.strokeStyle = BRAND.selection
    ctx.lineWidth = h.handle.length === 2 ? 2 : 1.5
    ctx.stroke(path)
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
  const box = new Path2D()
  box.roundRect(x - r, y - r, r * 2, r * 2, 1.5)
  ctx.fillStyle = '#FCFBF8'
  ctx.fill(box)
  ctx.lineWidth = 1.6
  ctx.strokeStyle = BRAND.selection
  ctx.stroke(box)
}

function drawChatBubble(ctx: CanvasRenderingContext2D, p: Vec, color: string, text: string) {
  ctx.save()
  ctx.font = '500 12px "Instrument Sans", system-ui, sans-serif'
  const w = Math.min(260, ctx.measureText(text).width + 20)
  const x = p.x + 12
  const y = p.y + 36
  ctx.beginPath()
  ctx.roundRect(x, y, w, 26, 7)
  ctx.fillStyle = '#FCFBF8'
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()
  ctx.fillStyle = '#141310'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text.slice(0, 44), x + 10, y + 13.5)
  ctx.restore()
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
  ctx.roundRect(12, 12, w + 14, 20, 6)
  ctx.fillStyle = color
  ctx.fill()
  ctx.fillStyle = '#FCFBF8'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(name, 19, 22.5)
  ctx.restore()
}
