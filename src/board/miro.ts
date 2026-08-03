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
    imageUrl?: string
  }
  // A connector keeps its ends and its labels at the top level rather than under `data`, which
  // is the shape the items endpoint uses for everything else.
  startItem?: { id: string }
  endItem?: { id: string }
  captions?: { content?: string }[]
  shape?: string
  style?: Record<string, string | number>
  position?: { x: number; y: number; origin?: string; relativeTo?: string }
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
    // Miro writes most punctuation as a number rather than a name: &#34; for a quote, &#43; for
    // the plus in "T+15". Naming them one at a time leaves the next one on screen as itself.
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
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

// Miro positions from the centre, and a child of a frame is measured from that frame's TOP LEFT
// rather than from its centre — `position.relativeTo` says which. Adding the parent's centre to a
// top-left offset puts every child half a frame down and to the right of where it belongs, which
// on a 2500x3900 frame is far enough that nothing lands inside the frame at all.
function topLeft(item: MiroItem, frames: Map<string, MiroItem>) {
  const w = num(item.geometry?.width, 200)
  const h = num(item.geometry?.height, 200)
  let cx = num(item.position?.x, 0)
  let cy = num(item.position?.y, 0)
  const parent = item.parent?.id ? frames.get(item.parent.id) : null
  if (parent) {
    const pw = num(parent.geometry?.width, 0)
    const ph = num(parent.geometry?.height, 0)
    const anchored = item.position?.relativeTo === 'parent_top_left'
    cx += num(parent.position?.x, 0) - (anchored ? pw / 2 : 0)
    cy += num(parent.position?.y, 0) - (anchored ? ph / 2 : 0)
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
      case 'preview': {
        const src = m.data?.imageUrl ?? m.data?.url
        // A picture on api.miro.com is only served to a token, and the browser drawing this board
        // has none. Counting it says six pictures did not come rather than leaving six holes.
        if (src && !/^https?:\/\/api\.miro\.com\//.test(src)) {
          made = makeImage(box.x, box.y, box.w, box.h, src)
        } else {
          skipped[m.type] = (skipped[m.type] ?? 0) + 1
        }
        break
      }
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
    const ends = m as { startItem?: { id: string }; endItem?: { id: string } }
    const from = ends.startItem?.id && idOf.get(ends.startItem.id)
    const to = ends.endItem?.id && idOf.get(ends.endItem.id)
    if (!from || !to) { skipped.connector = (skipped.connector ?? 0) + 1; continue }
    const c = makeConnector(
      { itemId: from, anchor: null, x: 0, y: 0 },
      { itemId: to, anchor: null, x: 0, y: 0 },
      {
        shape: m.shape === 'elbowed' ? 'elbow' : m.shape === 'straight' ? 'straight' : 'curved',
        stroke: hex(String(m.style?.strokeColor ?? '')) ?? '#141310',
        strokeWidth: num(Number(m.style?.strokeWidth), 2),
        strokeStyle: 'solid',
        capStart: 'none',
        capEnd: 'arrow',
      },
    )
    // "EVET" and "HAYIR" on the branches of a flow chart are captions, not content, and a
    // decision diagram that loses them is a diagram nobody can read.
    const [first, ...rest] = m.captions ?? []
    c.text = plain(first?.content)
    if (rest.length) c.labels = rest.map((cap) => ({ t: 0.5, text: plain(cap.content) }))
    items.push(c)
  }

  // The items endpoint carries no z-order — not a field being ignored, one Miro does not send —
  // so the stack is rebuilt rather than restored. Frames hold everything, then the big thing is
  // the backdrop and what sits on it is smaller, then arrows over the top. Same size keeps the
  // order it was made in, which is the one thing the API does say.
  const rank = (i: Item) => (i.type === 'frame' ? 0 : i.type === 'connector' ? 2 : 1)
  items.sort((a, b) => rank(a) - rank(b) || b.w * b.h - a.w * a.h)
  return { items, skipped }
}
