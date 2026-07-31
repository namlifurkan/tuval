import { getIndex, getItems, newId, nextZ } from './doc'
import { session } from './store'
import { anchorPoint, nearestAnchor, resolveConnector } from './geometry'
import type { Ends } from './geometry'
import { me } from './me'
import type {
  AnchorSide, CodeItem, CommentItem, CommentReply, ConnectorItem, DrawItem, EmbedItem, Endpoint, FrameItem,
  ImageItem, Item,
  Rect, ShapeItem, StickyItem, TableItem, TextItem, TextStyle, Vec,
} from './types'
import { DEFAULT_TEXT_STYLE } from './types'

const base = (x: number, y: number, w: number, h: number) => ({
  id: newId(), x, y, w, h, rotation: 0, z: nextZ(),
  parentId: null, groupId: null, locked: false, opacity: 1,
})

export const STICKY_SIZE = 228

export function makeSticky(x: number, y: number, fill: string, text = '', style?: Partial<TextStyle>): StickyItem {
  return {
    ...base(x, y, STICKY_SIZE, STICKY_SIZE),
    type: 'sticky',
    fill,
    text,
    shape: 'square',
    ...DEFAULT_TEXT_STYLE,
    fontSize: 36,
    align: 'center',
    valign: 'middle',
    autoFit: true,
    ...style,
  }
}

export function makeShape(
  x: number, y: number, w: number, h: number,
  opts: Pick<ShapeItem, 'kind' | 'fill' | 'stroke' | 'strokeWidth' | 'strokeStyle'>,
  style?: Partial<TextStyle>,
): ShapeItem {
  return {
    ...base(x, y, w, h),
    type: 'shape',
    text: '',
    ...DEFAULT_TEXT_STYLE,
    fontSize: 18,
    align: 'center',
    valign: 'middle',
    autoFit: true,
    ...style,
    ...opts,
  }
}

export function makeText(x: number, y: number, w: number, style: TextStyle): TextItem {
  return {
    ...base(x, y, w, style.fontSize * 1.28),
    type: 'text',
    text: '',
    fill: 'transparent',
    autoWidth: true,
    ...style,
    align: 'left',
    valign: 'top',
    autoFit: false,
  }
}

export const CODE_PAD = 16
export const CODE_LINE = 1.5

export function makeCode(x: number, y: number, w = 520, lang = 'ts'): CodeItem {
  const fontSize = 15
  return {
    ...base(x, y, w, fontSize * CODE_LINE + CODE_PAD * 2),
    type: 'code',
    text: '',
    lang,
    fontSize,
    theme: 'light',
    showLines: true,
  }
}

export function codeHeight(item: Pick<CodeItem, 'text' | 'fontSize'>) {
  const lines = Math.max(1, item.text.split('\n').length)
  return Math.ceil(lines * item.fontSize * CODE_LINE + CODE_PAD * 2)
}

export function makeDraw(
  points: number[], x: number, y: number, w: number, h: number,
  opts: { stroke: string; strokeWidth: number; highlighter: boolean },
): DrawItem {
  return { ...base(x, y, w, h), type: 'draw', points, ...opts }
}

export function makeFrame(x: number, y: number, w: number, h: number, title: string): FrameItem {
  const order = getItems().filter((i) => i.type === 'frame').length
  return { ...base(x, y, w, h), type: 'frame', title, fill: '#FCFBF8', order, z: -1000 - Math.random() }
}

export function sortedFrames(all: Item[]): FrameItem[] {
  return all
    .filter((i): i is FrameItem => i.type === 'frame')
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.id < b.id ? -1 : 1))
}

export function makeImage(x: number, y: number, w: number, h: number, src: string): ImageItem {
  return { ...base(x, y, w, h), type: 'image', src, naturalW: w, naturalH: h }
}

export const TABLE_CELL_W = 180
export const TABLE_CELL_H = 56

export function makeTable(x: number, y: number, rows = 3, cols = 3, style?: Partial<TextStyle>): TableItem {
  const widths = Array.from({ length: cols }, () => TABLE_CELL_W)
  const heights = Array.from({ length: rows }, () => TABLE_CELL_H)
  return {
    ...base(x, y, cols * TABLE_CELL_W, rows * TABLE_CELL_H),
    type: 'table',
    rows,
    cols,
    widths,
    heights,
    cells: Array.from({ length: rows }, () => Array.from({ length: cols }, () => '')),
    headerRow: true,
    fill: '#FCFBF8',
    headerFill: '#EBE7DE',
    stroke: '#D6D1C6',
    strokeWidth: 1,
    ...DEFAULT_TEXT_STYLE,
    ...style,
    fontSize: 14,
    align: 'left',
    valign: 'middle',
    autoFit: false,
  }
}

export function cellRect(t: TableItem, r: number, c: number): Rect {
  const sx = t.w / t.widths.reduce((a, b) => a + b, 0)
  const sy = t.h / t.heights.reduce((a, b) => a + b, 0)
  let x = t.x
  for (let i = 0; i < c; i++) x += t.widths[i] * sx
  let y = t.y
  for (let i = 0; i < r; i++) y += t.heights[i] * sy
  return { x, y, w: t.widths[c] * sx, h: t.heights[r] * sy }
}

export function cellAt(t: TableItem, p: Vec): [number, number] | null {
  for (let r = 0; r < t.rows; r++) {
    for (let c = 0; c < t.cols; c++) {
      const rect = cellRect(t, r, c)
      if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) {
        return anchorOf(t, r, c)
      }
    }
  }
  return null
}

export function tableEdgeAt(t: TableItem, p: Vec, tol: number): { axis: 'col' | 'row'; index: number } | null {
  const sx = t.w / t.widths.reduce((a, b) => a + b, 0)
  const sy = t.h / t.heights.reduce((a, b) => a + b, 0)
  if (p.y >= t.y - tol && p.y <= t.y + t.h + tol) {
    let x = t.x
    for (let c = 0; c < t.cols; c++) {
      x += t.widths[c] * sx
      if (Math.abs(p.x - x) <= tol) return { axis: 'col', index: c }
    }
  }
  if (p.x >= t.x - tol && p.x <= t.x + t.w + tol) {
    let y = t.y
    for (let r = 0; r < t.rows; r++) {
      y += t.heights[r] * sy
      if (Math.abs(p.y - y) <= tol) return { axis: 'row', index: r }
    }
  }
  return null
}

export function resizeTableTrack(
  t: TableItem, axis: 'col' | 'row', index: number, pointer: Vec,
): Record<string, unknown> {
  if (axis === 'col') {
    const sx = t.w / t.widths.reduce((a, b) => a + b, 0)
    let left = t.x
    for (let c = 0; c < index; c++) left += t.widths[c] * sx
    const next = [...t.widths]
    next[index] = Math.max(48, (pointer.x - left) / sx)
    return { widths: next, w: next.reduce((a, b) => a + b, 0) * sx }
  }
  const sy = t.h / t.heights.reduce((a, b) => a + b, 0)
  let top = t.y
  for (let r = 0; r < index; r++) top += t.heights[r] * sy
  const next = [...t.heights]
  next[index] = Math.max(28, (pointer.y - top) / sy)
  return { heights: next, h: next.reduce((a, b) => a + b, 0) * sy }
}

export function setCell(t: TableItem, r: number, c: number, value: string): string[][] {
  return t.cells.map((row, i) => (i === r ? row.map((cell, j) => (j === c ? value : cell)) : row))
}

export function addRow(t: TableItem, at = t.rows): Partial<TableItem> {
  const heights = [...t.heights]
  heights.splice(at, 0, t.heights[Math.min(at, t.rows - 1)] ?? TABLE_CELL_H)
  const cells = [...t.cells]
  cells.splice(at, 0, Array.from({ length: t.cols }, () => ''))
  const scale = t.h / t.heights.reduce((a, b) => a + b, 0)
  return { rows: t.rows + 1, heights, cells, merges: remapMerges(t.merges, 'row', at, 1), h: heights.reduce((a, b) => a + b, 0) * scale }
}

export function addCol(t: TableItem, at = t.cols): Partial<TableItem> {
  const widths = [...t.widths]
  widths.splice(at, 0, t.widths[Math.min(at, t.cols - 1)] ?? TABLE_CELL_W)
  const cells = t.cells.map((row) => {
    const next = [...row]
    next.splice(at, 0, '')
    return next
  })
  const scale = t.w / t.widths.reduce((a, b) => a + b, 0)
  return { cols: t.cols + 1, widths, cells, merges: remapMerges(t.merges, 'col', at, 1), w: widths.reduce((a, b) => a + b, 0) * scale }
}

export function dropRow(t: TableItem, at: number): Partial<TableItem> | null {
  if (t.rows <= 1) return null
  const heights = t.heights.filter((_, i) => i !== at)
  const cells = t.cells.filter((_, i) => i !== at)
  const scale = t.h / t.heights.reduce((a, b) => a + b, 0)
  return { rows: t.rows - 1, heights, cells, merges: remapMerges(t.merges, 'row', at, -1), h: heights.reduce((a, b) => a + b, 0) * scale }
}

export function dropCol(t: TableItem, at: number): Partial<TableItem> | null {
  if (t.cols <= 1) return null
  const widths = t.widths.filter((_, i) => i !== at)
  const cells = t.cells.map((row) => row.filter((_, i) => i !== at))
  const scale = t.w / t.widths.reduce((a, b) => a + b, 0)
  return { cols: t.cols - 1, widths, cells, merges: remapMerges(t.merges, 'col', at, -1), w: widths.reduce((a, b) => a + b, 0) * scale }
}

const EMBED_RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/youtube\.com\/watch\?v=([\w-]+)/i, (m) => `https://www.youtube.com/embed/${m[1]}`],
  [/youtu\.be\/([\w-]+)/i, (m) => `https://www.youtube.com/embed/${m[1]}`],
  [/vimeo\.com\/(\d+)/i, (m) => `https://player.vimeo.com/video/${m[1]}`],
  [/loom\.com\/share\/([\w-]+)/i, (m) => `https://www.loom.com/embed/${m[1]}`],
  [/figma\.com\/(file|design|board)\/(.+)/i, (m) => `https://www.figma.com/embed?embed_host=tuval&url=https://www.figma.com/${m[1]}/${m[2]}`],
]

export function embedUrl(raw: string): string {
  const url = raw.startsWith('http') ? raw : `https://${raw}`
  for (const [re, build] of EMBED_RULES) {
    const match = url.match(re)
    if (match) return build(match)
  }
  return url
}

export function embedTitle(raw: string): string {
  try {
    return new URL(raw.startsWith('http') ? raw : `https://${raw}`).hostname.replace(/^www\./, '')
  } catch {
    return raw.slice(0, 40)
  }
}

export function makeEmbed(x: number, y: number, raw: string): EmbedItem {
  const w = 640, h = 400
  return {
    ...base(x - w / 2, y - h / 2, w, h),
    type: 'embed',
    url: embedUrl(raw),
    title: embedTitle(raw),
  }
}

export function makeComment(x: number, y: number, text: string): CommentItem {
  return {
    ...base(x, y, 1, 1),
    type: 'comment',
    resolved: false,
    replies: text ? [makeReply(text)] : [],
    z: 1e6 + Math.random(),
  }
}

export function makeReply(text: string): CommentReply {
  return { id: newId(), author: me.name, color: me.color, text, at: Date.now() }
}

export function makeConnector(
  from: Endpoint, to: Endpoint,
  opts: Pick<ConnectorItem, 'shape' | 'stroke' | 'strokeWidth' | 'strokeStyle' | 'capStart' | 'capEnd'>,
): ConnectorItem {
  return {
    ...base(0, 0, 0, 0),
    type: 'connector',
    from,
    to,
    text: '',
    bend: null,
    bends: [],
    ...DEFAULT_TEXT_STYLE,
    fontSize: 14,
    ...opts,
  }
}

export const freeEndpoint = (p: Vec): Endpoint => ({ itemId: null, anchor: null, x: p.x, y: p.y })

export function withPreview<T extends Item>(item: T): T {
  const p = session.preview.get(item.id)
  return p ? ({ ...item, ...p } as T) : item
}

const livePreview = (id: string) => {
  const raw = getIndex().get(id)
  return raw ? withPreview(raw) : undefined
}

export function connectorEnds(item: Item & { type: 'connector' }): Ends {
  return resolveConnector(item, livePreview)
}

export function anchorTowards(target: Item, toward: Vec, side: AnchorSide | null): Vec {
  return anchorPoint(target, side ?? nearestAnchor(target, toward))
}

export function cloneItems(items: Item[], dx: number, dy: number): Item[] {
  const idMap = new Map(items.map((i) => [i.id, newId()]))
  const groupMap = new Map<string, string>()
  let z = nextZ()
  return items.map((i) => {
    const copy = { ...i, id: idMap.get(i.id)!, x: i.x + dx, y: i.y + dy, z: z++ } as Item
    if (copy.groupId) {
      if (!groupMap.has(copy.groupId)) groupMap.set(copy.groupId, newId())
      copy.groupId = groupMap.get(copy.groupId)!
    }
    if (copy.parentId && idMap.has(copy.parentId)) copy.parentId = idMap.get(copy.parentId)!
    if (copy.type === 'connector') {
      copy.from = { ...copy.from, x: copy.from.x + dx, y: copy.from.y + dy }
      copy.to = { ...copy.to, x: copy.to.x + dx, y: copy.to.y + dy }
      if (copy.from.itemId && idMap.has(copy.from.itemId)) copy.from.itemId = idMap.get(copy.from.itemId)!
      else if (copy.from.itemId) copy.from = { ...copy.from, itemId: copy.from.itemId }
      if (copy.to.itemId && idMap.has(copy.to.itemId)) copy.to.itemId = idMap.get(copy.to.itemId)!
    }
    return copy
  })
}

export const isTextual = (i: Item): i is StickyItem | ShapeItem | TextItem | ConnectorItem =>
  i.type === 'sticky' || i.type === 'shape' || i.type === 'text' || i.type === 'connector'

// Merged cells ------------------------------------------------------------------------------
// A merge is a rectangle anchored at its top-left cell. That cell keeps the text and is the
// only one drawn; the rest are covered and every lookup redirects to the anchor.

export function mergeAt(t: TableItem, r: number, c: number): number[] | null {
  return t.merges?.find((m) => m[0] === r && m[1] === c) ?? null
}

export function anchorOf(t: TableItem, r: number, c: number): [number, number] {
  for (const [mr, mc, rs, cs] of t.merges ?? []) {
    if (r >= mr && r < mr + rs && c >= mc && c < mc + cs) return [mr, mc]
  }
  return [r, c]
}

export const isCovered = (t: TableItem, r: number, c: number) => {
  const [ar, ac] = anchorOf(t, r, c)
  return ar !== r || ac !== c
}

export function spanRect(t: TableItem, r: number, c: number) {
  const span = mergeAt(t, r, c)
  const rect = cellRect(t, r, c)
  if (!span) return rect
  const last = cellRect(t, r + span[2] - 1, c + span[3] - 1)
  return { x: rect.x, y: rect.y, w: last.x + last.w - rect.x, h: last.y + last.h - rect.y }
}

const overlaps1d = (a: number, an: number, b: number, bn: number) => a < b + bn && b < a + an

// Growing a block swallows whatever it now covers, including other merges. Their text is kept
// rather than dropped: losing a cell's contents to a layout change is not a fair trade.
export function growMerge(t: TableItem, r: number, c: number, axis: 'row' | 'col'): Partial<TableItem> | null {
  const [ar, ac] = anchorOf(t, r, c)
  const own = mergeAt(t, ar, ac) ?? [ar, ac, 1, 1]
  const rs = own[2] + (axis === 'row' ? 1 : 0)
  const cs = own[3] + (axis === 'col' ? 1 : 0)
  if (ar + rs > t.rows || ac + cs > t.cols) return null

  const eaten = (t.merges ?? []).filter((m) =>
    !(m[0] === ar && m[1] === ac) && overlaps1d(m[0], m[2], ar, rs) && overlaps1d(m[1], m[3], ac, cs))

  const words: string[] = []
  const cells = t.cells.map((row, i) => row.map((cell, j) => {
    if (i === ar && j === ac) return cell
    if (i < ar || i >= ar + rs || j < ac || j >= ac + cs) return cell
    if (cell) words.push(cell)
    return ''
  }))
  if (words.length) cells[ar][ac] = [cells[ar][ac], ...words].filter(Boolean).join(' ')

  const merges = (t.merges ?? [])
    .filter((m) => !eaten.includes(m) && !(m[0] === ar && m[1] === ac))
    .concat([[ar, ac, rs, cs]])
  return { merges, cells }
}

export function splitMerge(t: TableItem, r: number, c: number): Partial<TableItem> | null {
  const [ar, ac] = anchorOf(t, r, c)
  if (!mergeAt(t, ar, ac)) return null
  return { merges: (t.merges ?? []).filter((m) => !(m[0] === ar && m[1] === ac)) }
}

// A row or column appearing or disappearing under a block would leave it describing cells that
// no longer line up, so anything the change cuts through is split rather than left wrong.
export function remapMerges(
  merges: number[][] | undefined, axis: 'row' | 'col', at: number, delta: 1 | -1,
): number[][] {
  const i = axis === 'row' ? 0 : 1
  const n = i + 2
  const out: number[][] = []
  for (const m of merges ?? []) {
    const start = m[i]
    const span = m[n]
    if (delta === 1) {
      if (at <= start) { const next = [...m]; next[i] = start + 1; out.push(next); continue }
      if (at < start + span) { const next = [...m]; next[n] = span + 1; out.push(next); continue }
      out.push([...m])
      continue
    }
    if (at < start) { const next = [...m]; next[i] = start - 1; out.push(next); continue }
    if (at < start + span) {
      if (span <= 2) continue
      const next = [...m]; next[n] = span - 1; out.push(next); continue
    }
    out.push([...m])
  }
  return out.filter((m) => m[2] > 1 || m[3] > 1)
}

// Connector labels --------------------------------------------------------------------------
// `text` stays the main label so double clicking a connector still edits it; anything else is
// an extra with a position of its own.

export interface ConnectorLabel { t: number; text: string }

export function connectorLabels(c: ConnectorItem): ConnectorLabel[] {
  const main = c.text ? [{ t: c.labelT ?? 0.5, text: c.text }] : []
  return [...main, ...(c.labels ?? []).filter((l) => l.text)]
}

// A point a fraction of the way along a polyline, measured by length rather than by vertex
// count so a label does not drift when a bend is added.
export function pointAlong(pts: Vec[], t: number): Vec {
  if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 }
  const spans: number[] = []
  let total = 0
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    spans.push(d)
    total += d
  }
  if (!total) return pts[0]
  let want = Math.min(Math.max(t, 0), 1) * total
  for (let i = 0; i < spans.length; i++) {
    if (want <= spans[i] || i === spans.length - 1) {
      const f = spans[i] ? want / spans[i] : 0
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * f,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * f,
      }
    }
    want -= spans[i]
  }
  return pts[pts.length - 1]
}
