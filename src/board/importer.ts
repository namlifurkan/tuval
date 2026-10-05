import { personNamed } from './people'
import { codeHeight, makeCode, makeConnector, makeFrame, makeShape, makeSticky, makeTable, STICKY_SIZE } from './items'
import { PIGMENTS } from './brand'
import { DEFAULT_TEXT_STYLE } from './types'
import type { Item, Vec } from './types'

interface Node {
  kind: 'sticky' | 'code' | 'table'
  text: string
  label?: string
  lang?: string
  rows?: string[][]
}

interface Section { title: string; owners?: string[]; nodes: Node[] }

interface Parsed {
  title: string
  sections: Section[]
  edges: { from: string; to: string; label: string }[]
  labels: Map<string, string>
}

const FLOW_HEADS = ['flow', 'akış', 'akis']
const COMMENT_HEADS = ['comments', 'yorumlar']

const norm = (s: string) => s.trim().toLowerCase()

export function parseBrief(md: string): Parsed {
  const lines = md.replace(/\r\n/g, '\n').split('\n')
  const out: Parsed = { title: '', sections: [], edges: [], labels: new Map() }
  let section: Section | null = null
  let mode: 'body' | 'flow' | 'comments' = 'body'

  const push = (node: Node) => {
    if (!section) {
      section = { title: '', nodes: [] }
      out.sections.push(section)
    }
    section.nodes.push(node)
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      const text = heading[2].trim()
      if (heading[1].length === 1 && !out.title) { out.title = text; continue }
      if (FLOW_HEADS.includes(norm(text))) { mode = 'flow'; section = null; continue }
      if (COMMENT_HEADS.includes(norm(text))) { mode = 'comments'; section = null; continue }
      mode = 'body'
      section = { title: text, nodes: [] }
      out.sections.push(section)
      continue
    }

    const fence = /^```(\w*)\s*$/.exec(line)
    if (fence) {
      const lang = fence[1] || 'txt'
      const body: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++])
      const source = body.join('\n')
      if (lang === 'mermaid' || mode === 'flow') {
        for (const raw of body) {
          const decl = /^\s*(\w+)\s*\[\s*"?(.*?)"?\s*\]\s*$/.exec(raw)
          if (decl) { out.labels.set(decl[1], decl[2]); continue }
          const edge = /^\s*(\w+)\s*(?:--\s*(.*?)\s*)?-->\s*(\w+)/.exec(raw)
          if (edge) out.edges.push({ from: edge[1], to: edge[3], label: edge[2] ?? '' })
        }
        continue
      }
      if (source.trim()) push({ kind: 'code', text: source, lang })
      continue
    }

    if (mode !== 'body') continue

    if (/^\s*\|.*\|\s*$/.test(line)) {
      const rows: string[][] = []
      while (i < lines.length && /^\s*\|.*\|\s*$/.test(lines[i])) {
        const cells = lines[i].trim().slice(1, -1).split('|').map((c) => c.trim())
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells)
        i++
      }
      i--
      if (rows.length) push({ kind: 'table', text: '', rows })
      continue
    }

    const bullet = /^\s*(?:[-*+]|\d+\.)\s+(.*)$/.exec(line)
    if (bullet) {
      const body = [bullet[1]]
      while (i + 1 < lines.length && /^\s{2,}\S/.test(lines[i + 1]) && !/^\s*(?:[-*+]|\d+\.)\s/.test(lines[i + 1])) {
        body.push(lines[++i].trim())
      }
      const joined = body.join('\n')
      const tagged = /^\[([^\]]{1,24})\]\s+([\s\S]*)$/.exec(joined)
      push(tagged
        ? { kind: 'sticky', text: tagged[2], label: tagged[1] }
        : { kind: 'sticky', text: joined })
      continue
    }

    const text = line.trim()
    const owner = /^(?:owner|sahip|atanan)\s*:\s*(.+)$/i.exec(text)
    if (owner && section) { section.owners = owner[1].split(',').map((o) => o.trim()).filter(Boolean); continue }
    if (text && section && !/^[-=_]{3,}$/.test(text)) push({ kind: 'sticky', text })
  }

  return out
}

const COL_GAP = 48
const ROW_GAP = 48
const FRAME_PAD = 96
const COLS = 3

const CODE_W = 620
const TABLE_W = 640

function sizeOf(node: Node) {
  if (node.kind === 'code') return { w: CODE_W, h: codeHeight({ text: node.text, fontSize: 15 }) }
  if (node.kind === 'table') {
    const rows = node.rows?.length ?? 1
    return { w: TABLE_W, h: Math.max(1, rows) * 44 }
  }
  return { w: STICKY_SIZE, h: STICKY_SIZE }
}

const FILLS = [PIGMENTS.naples, PIGMENTS.celadon, PIGMENTS.rose, PIGMENTS.cerulean, PIGMENTS.ochre]

const TREE_W = 248
const TREE_H = 96
const TREE_GAP_X = 40
const TREE_GAP_Y = 96
const STACK_GAP = 24
const STACK_INDENT = TREE_W / 2 + 32
const TREE_FILL = ['#3E5C93', '#7FA5BE', '#CBD79A', '#F0E3B0', '#E7B7B4']

function treeToItems(parsed: Parsed, origin: Vec): Item[] {
  const names = new Map(parsed.labels)
  for (const edge of parsed.edges) {
    if (!names.has(edge.from)) names.set(edge.from, edge.from)
    if (!names.has(edge.to)) names.set(edge.to, edge.to)
  }

  const kids = new Map<string, string[]>()
  const parent = new Map<string, string>()
  const edgeLabel = new Map<string, string>()
  for (const edge of parsed.edges) {
    if (edge.from === edge.to || parent.has(edge.to)) continue
    let up: string | undefined = edge.from
    while (up && up !== edge.to) up = parent.get(up)
    if (up) continue
    parent.set(edge.to, edge.from)
    edgeLabel.set(edge.to, edge.label)
    kids.set(edge.from, [...(kids.get(edge.from) ?? []), edge.to])
  }

  const childrenOf = (id: string) => kids.get(id) ?? []
  const stacks = (id: string) => {
    const own = childrenOf(id)
    return own.length > 1 && own.every((k) => !childrenOf(k).length)
  }
  const widthOf = (id: string): number => {
    const own = childrenOf(id)
    if (!own.length) return TREE_W
    if (stacks(id)) return STACK_INDENT + TREE_W
    const sum = own.reduce((total, k) => total + widthOf(k), 0) + (own.length - 1) * TREE_GAP_X
    return Math.max(TREE_W, sum)
  }

  const items: Item[] = []
  const made = new Map<string, Item>()
  const box = (id: string, x: number, y: number, depth: number) => {
    const fill = TREE_FILL[Math.min(depth, TREE_FILL.length - 1)]
    const node = makeShape(x, y, TREE_W, TREE_H, {
      kind: 'roundRect', fill, stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid',
    }, { fontSize: 18, bold: depth === 0, textColor: depth === 0 ? '#FCFBF8' : '#1F1D1A' })
    node.text = (names.get(id) ?? id).replace(/<br\s*\/?>/gi, '\n')
    made.set(id, node)
    items.push(node)
  }
  const link = (from: string, to: string, fromSide: 'bottom', toSide: 'top' | 'left') => {
    const a = made.get(from)!
    const b = made.get(to)!
    const connector = makeConnector(
      { itemId: a.id, anchor: fromSide, x: a.x + a.w / 2, y: a.y + a.h },
      toSide === 'top'
        ? { itemId: b.id, anchor: 'top', x: b.x + b.w / 2, y: b.y }
        : { itemId: b.id, anchor: 'left', x: b.x, y: b.y + b.h / 2 },
      { shape: 'elbow', stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid', capStart: 'none', capEnd: 'arrow' },
    )
    connector.text = edgeLabel.get(to) ?? ''
    items.push(connector)
  }

  const place = (id: string, left: number, top: number, depth: number) => {
    const own = childrenOf(id)
    if (stacks(id)) {
      box(id, left, top, depth)
      own.forEach((k, i) => {
        box(k, left + STACK_INDENT, top + (i + 1) * (TREE_H + STACK_GAP), depth + 1)
        link(id, k, 'bottom', 'left')
      })
      return
    }
    box(id, left + (widthOf(id) - TREE_W) / 2, top, depth)
    let cursor = left
    for (const k of own) {
      place(k, cursor, top + TREE_H + TREE_GAP_Y, depth + 1)
      link(id, k, 'bottom', 'top')
      cursor += widthOf(k) + TREE_GAP_X
    }
  }

  let cursor = origin.x
  for (const id of names.keys()) {
    if (parent.has(id)) continue
    place(id, cursor, origin.y, 0)
    cursor += widthOf(id) + TREE_GAP_X * 3
  }
  return items
}

export function briefToItems(md: string, origin: Vec): { items: Item[]; title: string } {
  const parsed = parseBrief(md)
  if (!parsed.sections.length && parsed.labels.size + parsed.edges.length) {
    return { items: treeToItems(parsed, origin), title: parsed.title }
  }
  const items: Item[] = []
  const order: Item[] = []
  let cursorX = origin.x

  parsed.sections.forEach((section, si) => {
    const placed: { item: Item; w: number; h: number }[] = []
    let rowW = 0
    let rowH = 0
    let x = 0
    let y = 0
    let inRow = 0

    for (const node of section.nodes) {
      const { w, h } = sizeOf(node)
      const wide = node.kind !== 'sticky'
      if (wide || inRow >= COLS) {
        if (inRow) { y += rowH + ROW_GAP; rowW = Math.max(rowW, x - COL_GAP) }
        x = 0
        inRow = 0
        rowH = 0
      }

      let item: Item
      if (node.kind === 'code') {
        item = makeCode(0, 0, w)
        Object.assign(item, { text: node.text, lang: node.lang ?? 'txt', h })
      } else if (node.kind === 'table') {
        const rows = node.rows ?? [['']]
        const table = makeTable(0, 0, rows.length, Math.max(...rows.map((r) => r.length)), DEFAULT_TEXT_STYLE)
        table.cells = table.cells.map((row, r) => row.map((_, c) => rows[r]?.[c] ?? ''))
        item = table
      } else {
        const sticky = makeSticky(0, 0, FILLS[si % FILLS.length], node.text)
        if (node.label) sticky.label = node.label
        item = sticky
      }

      item.x = x
      item.y = y
      placed.push({ item, w: item.w, h: item.h })
      order.push(item)

      if (wide) {
        y += item.h + ROW_GAP
        rowW = Math.max(rowW, item.w)
      } else {
        x += w + COL_GAP
        rowH = Math.max(rowH, h)
        inRow++
      }
    }
    if (inRow) { y += rowH + ROW_GAP; rowW = Math.max(rowW, x - COL_GAP) }

    const innerW = Math.max(rowW, STICKY_SIZE)
    const innerH = Math.max(y - ROW_GAP, STICKY_SIZE)
    const frameW = innerW + FRAME_PAD * 2
    const frameH = innerH + FRAME_PAD * 2
    const frame = makeFrame(cursorX, origin.y, frameW, frameH, section.title || `Frame ${si + 1}`)
    if (section.owners?.length) frame.assignees = section.owners.map(personNamed)
    items.push(frame)

    for (const p of placed) {
      p.item.x += cursorX + FRAME_PAD
      p.item.y += origin.y + FRAME_PAD
      p.item.parentId = frame.id
      items.push(p.item)
    }
    cursorX += frameW + 160
  })

  if (parsed.edges.length) {
    const byAlias = new Map<string, Item>()
    const used = new Set<Item>()
    for (const [alias, label] of parsed.labels) {
      const key = label.replace(/…$/, '').trim().toLowerCase()
      const hit = order.find((i) => !used.has(i)
        && 'text' in i && String(i.text).trim().toLowerCase().startsWith(key) && key.length > 0)
      if (hit) { byAlias.set(alias, hit); used.add(hit) }
    }
    for (const [alias] of parsed.labels) {
      if (byAlias.has(alias)) continue
      const n = Number(alias.replace(/\D/g, ''))
      const fallback = order[n - 1]
      if (fallback) byAlias.set(alias, fallback)
    }

    for (const edge of parsed.edges) {
      const a = byAlias.get(edge.from)
      const b = byAlias.get(edge.to)
      if (!a || !b || a === b) continue
      const connector = makeConnector(
        { itemId: a.id, anchor: null, x: a.x + a.w / 2, y: a.y + a.h / 2 },
        { itemId: b.id, anchor: null, x: b.x + b.w / 2, y: b.y + b.h / 2 },
        { shape: 'curved', stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid', capStart: 'none', capEnd: 'arrow' },
      )
      connector.text = edge.label
      items.push(connector)
    }
  }

  return { items, title: parsed.title }
}
