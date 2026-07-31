import { makeConnector, makeFrame, makeImage, makeShape, makeSticky, makeText } from './items'
import { DEFAULT_TEXT_STYLE, STICKY_COLORS } from './types'
import type { Id, Item, ShapeKind } from './types'

// Miro board export, as returned by GET /v2/boards/{id}/items. Only the fields we map are
// described here; everything else in the payload is ignored.
export interface MiroItem {
  id: string
  type: string
  parent?: { id: string } | null
  data?: {
    content?: string
    title?: string
    shape?: string
    url?: string
    startItem?: { id: string }
    endItem?: { id: string }
  }
  style?: Record<string, string | number>
  position?: { x: number; y: number; origin?: string }
  geometry?: { width?: number; height?: number; rotation?: number }
}

const SHAPES: Record<string, ShapeKind> = {
  rectangle: 'rect',
  round_rectangle: 'roundRect',
  circle: 'ellipse',
  triangle: 'triangle',
  rhombus: 'diamond',
  star: 'star',
  pentagon: 'pentagon',
  hexagon: 'hexagon',
  octagon: 'octagon',
  right_arrow: 'arrowRight',
  arrow_shape: 'arrowRight',
  cloud: 'cloud',
  cross: 'cross',
  can: 'cylinder',
  parallelogram: 'parallelogram',
  trapezoid: 'trapezoid',
  wedge_round_rectangle_callout: 'speech',
  flow_chart_predefined_process: 'rect',
  flow_chart_decision: 'diamond',
  flow_chart_terminator: 'stadium',
  flow_chart_document: 'document',
  flow_chart_manual_input: 'manualInput',
  flow_chart_display: 'display',
  flow_chart_delay: 'delay',
  flow_chart_process: 'rect',
}

// Miro writes item text as HTML fragments.
export function plain(html: string | undefined): string {
  if (!html) return ''
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim()
}

const hex = (c: string) => {
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim())
  return m ? `#${m[1].toUpperCase()}` : null
}

// Miro's own palette is not ours, so a colour lands on the nearest guache tone rather than
// being copied. Named colours arrive as words, everything else as hex.
export function nearestSticky(color: string | undefined): string {
  if (!color) return STICKY_COLORS[0]
  const target = hex(color) ?? NAMED[color.toLowerCase()]
  if (!target) return STICKY_COLORS[0]
  const [tr, tg, tb] = rgb(target)
  let best: string = STICKY_COLORS[0]
  let bestD = Infinity
  for (const c of STICKY_COLORS) {
    const [r, g, b] = rgb(c)
    const d = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2
    if (d < bestD) { bestD = d; best = c }
  }
  return best
}

const rgb = (c: string): [number, number, number] => [
  parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16),
]

const NAMED: Record<string, string> = {
  gray: '#C6C2B6', light_yellow: '#F0E3B0', yellow: '#E8C55A', orange: '#DE9A4E',
  light_green: '#CBD79A', green: '#8FA96B', dark_green: '#5E9A8A', cyan: '#5E9A8A',
  light_pink: '#E7B7B4', pink: '#B9718A', violet: '#8A7FB0', red: '#C8664A',
  light_blue: '#7FA5BE', blue: '#3E5C93', dark_blue: '#3E5C93', black: '#1F1D1A',
}

const num = (v: unknown, fallback: number) => (typeof v === 'number' ? v : fallback)

// Miro positions from the centre; children are placed relative to their parent frame.
function topLeft(item: MiroItem, frames: Map<string, MiroItem>) {
  const w = num(item.geometry?.width, 200)
  const h = num(item.geometry?.height, 200)
  let cx = num(item.position?.x, 0)
  let cy = num(item.position?.y, 0)
  const parent = item.parent?.id ? frames.get(item.parent.id) : null
  if (parent) {
    cx += num(parent.position?.x, 0)
    cy += num(parent.position?.y, 0)
  }
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

export interface MiroImport { items: Item[]; skipped: Record<string, number> }

export function miroToItems(raw: unknown): MiroImport {
  const list: MiroItem[] = Array.isArray(raw)
    ? (raw as MiroItem[])
    : ((raw as { data?: MiroItem[]; items?: MiroItem[] })?.data
      ?? (raw as { items?: MiroItem[] })?.items ?? [])

  const frames = new Map<string, MiroItem>()
  for (const m of list) if (m.type === 'frame') frames.set(m.id, m)

  const idOf = new Map<string, Id>()
  const items: Item[] = []
  const nesting: [Item, string][] = []
  const skipped: Record<string, number> = {}

  const place = (m: MiroItem) => topLeft(m, frames)

  for (const m of list) {
    const box = place(m)
    const text = plain(m.data?.content ?? m.data?.title)
    let made: Item | null = null

    switch (m.type) {
      case 'frame':
        made = makeFrame(box.x, box.y, box.w, box.h, text || 'Frame')
        break
      case 'sticky_note':
        made = makeSticky(box.x, box.y, nearestSticky(m.style?.fillColor as string), text)
        made.w = box.w
        made.h = box.h
        break
      case 'text': {
        const t = makeText(box.x, box.y, box.w, { ...DEFAULT_TEXT_STYLE })
        t.text = text
        t.h = box.h
        made = t
        break
      }
      case 'shape': {
        const s = makeShape(box.x, box.y, box.w, box.h, {
          kind: SHAPES[m.data?.shape ?? ''] ?? 'rect',
          fill: hex(String(m.style?.fillColor ?? '')) ?? '#EFEDE6',
          stroke: hex(String(m.style?.borderColor ?? '')) ?? '#141310',
          strokeWidth: num(Number(m.style?.borderWidth), 2),
          strokeStyle: 'solid',
        })
        s.text = text
        made = s
        break
      }
      case 'image':
      case 'document':
      case 'preview':
        if (m.data?.url) made = makeImage(box.x, box.y, box.w, box.h, m.data.url)
        break
      case 'card':
      case 'app_card':
        made = makeSticky(box.x, box.y, STICKY_COLORS[12], text)
        made.w = box.w
        made.h = box.h
        break
      case 'connector':
        break
      default:
        skipped[m.type] = (skipped[m.type] ?? 0) + 1
    }

    if (made) {
      idOf.set(m.id, made.id)
      if (m.parent?.id && m.type !== 'frame') nesting.push([made, m.parent.id])
      items.push(made)
    }
  }

  // A child can appear before its frame, so parents are resolved once every id is known.
  for (const [child, parent] of nesting) child.parentId = idOf.get(parent) ?? null

  // Connectors last: both endpoints must already have a Tuval id.
  for (const m of list) {
    if (m.type !== 'connector') continue
    const from = m.data?.startItem?.id && idOf.get(m.data.startItem.id)
    const to = m.data?.endItem?.id && idOf.get(m.data.endItem.id)
    if (!from || !to) { skipped.connector = (skipped.connector ?? 0) + 1; continue }
    const c = makeConnector(
      { itemId: from, anchor: null, x: 0, y: 0 },
      { itemId: to, anchor: null, x: 0, y: 0 },
      {
        shape: 'curved',
        stroke: hex(String(m.style?.strokeColor ?? '')) ?? '#141310',
        strokeWidth: num(Number(m.style?.strokeWidth), 2),
        strokeStyle: 'solid',
        capStart: 'none',
        capEnd: 'arrow',
      },
    )
    c.text = plain(m.data?.content)
    items.push(c)
  }

  // Frames first so children paint on top of them.
  items.sort((a, b) => Number(b.type === 'frame') - Number(a.type === 'frame'))
  return { items, skipped }
}
