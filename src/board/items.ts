import { getIndex, newId, nextZ } from './doc'
import { session } from './store'
import { anchorPoint, nearestAnchor } from './geometry'
import { me } from './me'
import type {
  CommentItem, CommentReply, ConnectorItem, DrawItem, Endpoint, FrameItem, ImageItem, Item,
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

export function makeDraw(
  points: number[], x: number, y: number, w: number, h: number,
  opts: { stroke: string; strokeWidth: number; highlighter: boolean },
): DrawItem {
  return { ...base(x, y, w, h), type: 'draw', points, ...opts }
}

export function makeFrame(x: number, y: number, w: number, h: number, title: string): FrameItem {
  return { ...base(x, y, w, h), type: 'frame', title, fill: '#FCFBF8', z: -1000 - Math.random() }
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
      if (p.x >= rect.x && p.x <= rect.x + rect.w && p.y >= rect.y && p.y <= rect.y + rect.h) return [r, c]
    }
  }
  return null
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
  return { rows: t.rows + 1, heights, cells, h: heights.reduce((a, b) => a + b, 0) * scale }
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
  return { cols: t.cols + 1, widths, cells, w: widths.reduce((a, b) => a + b, 0) * scale }
}

export function dropRow(t: TableItem, at: number): Partial<TableItem> | null {
  if (t.rows <= 1) return null
  const heights = t.heights.filter((_, i) => i !== at)
  const cells = t.cells.filter((_, i) => i !== at)
  const scale = t.h / t.heights.reduce((a, b) => a + b, 0)
  return { rows: t.rows - 1, heights, cells, h: heights.reduce((a, b) => a + b, 0) * scale }
}

export function dropCol(t: TableItem, at: number): Partial<TableItem> | null {
  if (t.cols <= 1) return null
  const widths = t.widths.filter((_, i) => i !== at)
  const cells = t.cells.map((row) => row.filter((_, i) => i !== at))
  const scale = t.w / t.widths.reduce((a, b) => a + b, 0)
  return { cols: t.cols - 1, widths, cells, w: widths.reduce((a, b) => a + b, 0) * scale }
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

export function resolveEndpoint(e: Endpoint, other?: Vec): Vec {
  if (!e.itemId) return { x: e.x, y: e.y }
  const raw = getIndex().get(e.itemId)
  if (!raw) return { x: e.x, y: e.y }
  const item = withPreview(raw)
  const side = e.anchor ?? nearestAnchor(item, other ?? { x: item.x, y: item.y })
  return anchorPoint(item, side)
}

export function makeResolver() {
  return (e: Endpoint) => resolveEndpoint(e)
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
