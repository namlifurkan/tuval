import { aabb } from './geometry'
import type { Item, Id } from './types'

export interface AgentNode {
  id: Id
  kind: string
  text: string
  color?: string
  lang?: string
  rows?: string[][]
  url?: string
  at: [number, number]
}

export interface AgentSection {
  id: Id | null
  title: string
  nodes: AgentNode[]
}

export interface AgentEdge {
  from: Id
  to: Id
  label: string
}

export interface AgentGraph {
  board: string
  scope: string
  counts: { item: number; frame: number; edge: number }
  sections: AgentSection[]
  edges: AgentEdge[]
  comments: { on: Id | null; thread: string[] }[]
}

const SKIP = new Set(['connector', 'comment', 'frame', 'draw'])

function toNode(item: Item): AgentNode {
  const node: AgentNode = {
    id: item.id,
    kind: item.type,
    text: 'text' in item ? item.text : '',
    at: [Math.round(item.x), Math.round(item.y)],
  }
  if ('fill' in item && typeof item.fill === 'string' && item.fill !== 'transparent') node.color = item.fill
  if (item.type === 'code') node.lang = item.lang
  if (item.type === 'table') node.rows = item.cells
  if (item.type === 'embed') node.url = item.url
  if (item.type === 'image') node.url = item.src
  return node
}

// Reading order: band rows by y, then left to right inside a row.
const readingOrder = (a: Item, b: Item) =>
  Math.round(a.y / 60) - Math.round(b.y / 60) || a.x - b.x

const inside = (frame: Item, item: Item) => {
  const f = aabb(frame)
  const i = aabb(item)
  return i.x >= f.x && i.y >= f.y && i.x + i.w <= f.x + f.w && i.y + i.h <= f.y + f.h
}

export function boardToGraph(items: Item[], board: string, scope = 'board'): AgentGraph {
  const frames = items.filter((i) => i.type === 'frame')
    .sort((a, b) => ((a as { order?: number }).order ?? 0) - ((b as { order?: number }).order ?? 0))
  const content = items.filter((i) => !SKIP.has(i.type))
  const claimed = new Set<Id>()

  const sections: AgentSection[] = []
  for (const frame of frames) {
    if (frame.type !== 'frame') continue
    const own = content.filter((i) => (i.parentId ? i.parentId === frame.id : inside(frame, i)))
    own.forEach((i) => claimed.add(i.id))
    sections.push({ id: frame.id, title: frame.title, nodes: own.sort(readingOrder).map(toNode) })
  }
  const loose = content.filter((i) => !claimed.has(i.id))
  if (loose.length) {
    sections.push({ id: null, title: 'Frame dışı', nodes: loose.sort(readingOrder).map(toNode) })
  }

  const edges: AgentEdge[] = []
  for (const item of items) {
    if (item.type !== 'connector') continue
    if (!item.from.itemId || !item.to.itemId) continue
    edges.push({ from: item.from.itemId, to: item.to.itemId, label: item.text })
  }

  const known = new Map(content.map((i) => [i.id, i] as const))
  const comments = items.filter((i) => i.type === 'comment').map((c) => {
    let on: Id | null = null
    let best = 320
    for (const [id, i] of known) {
      const d = Math.hypot(i.x + i.w / 2 - c.x, i.y + i.h / 2 - c.y)
      if (d < best) { best = d; on = id }
    }
    return {
      on,
      thread: c.type === 'comment' ? c.replies.map((r) => `${r.author}: ${r.text}`) : [],
    }
  })

  return {
    board,
    scope,
    counts: { item: content.length, frame: frames.length, edge: edges.length },
    sections,
    edges,
    comments,
  }
}

const fence = (lang: string, body: string) => `\`\`\`${lang}\n${body}\n\`\`\``

const short = (s: string, n = 48) => {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? `${one.slice(0, n - 1)}…` : one
}

export function graphToMarkdown(g: AgentGraph): string {
  const names = new Map<Id, string>()
  const alias = new Map<Id, string>()
  let n = 0
  for (const section of g.sections) {
    for (const node of section.nodes) {
      names.set(node.id, short(node.text) || `(boş ${node.kind})`)
      alias.set(node.id, `n${++n}`)
    }
  }

  const out: string[] = []
  out.push(`# ${g.board}`)
  out.push('')
  out.push(`Sonsuz tuval dışa aktarımı · ${g.counts.item} öğe · ${g.counts.frame} frame · ${g.counts.edge} bağlantı`)
  out.push('')

  for (const section of g.sections) {
    if (!section.nodes.length) continue
    out.push(`## ${section.title}`)
    out.push('')
    for (const node of section.nodes) {
      if (node.kind === 'code') {
        if (out[out.length - 1] !== '') out.push('')
        out.push(fence(node.lang ?? 'txt', node.text))
        out.push('')
        continue
      }
      if (node.kind === 'table' && node.rows?.length) {
        if (out[out.length - 1] !== '') out.push('')
        const [head, ...body] = node.rows
        out.push(`| ${head.join(' | ')} |`)
        out.push(`| ${head.map(() => '---').join(' | ')} |`)
        for (const row of body) out.push(`| ${row.join(' | ')} |`)
        out.push('')
        continue
      }
      if (node.url) {
        out.push(`- ${node.kind === 'image' ? 'Görsel' : 'Gömülü'}: ${node.url}`)
        continue
      }
      const text = node.text.trim()
      if (!text) continue
      const lines = text.split('\n')
      out.push(`- ${lines[0]}`)
      for (const rest of lines.slice(1)) out.push(`  ${rest}`)
    }
    out.push('')
  }

  if (g.edges.length) {
    out.push('## Akış')
    out.push('')
    const used = new Set<Id>()
    const body: string[] = ['flowchart TD']
    for (const e of g.edges) {
      if (!alias.has(e.from) || !alias.has(e.to)) continue
      used.add(e.from)
      used.add(e.to)
      const arrow = e.label ? `-- ${short(e.label, 24)} -->` : '-->'
      body.push(`  ${alias.get(e.from)} ${arrow} ${alias.get(e.to)}`)
    }
    for (const id of used) {
      body.splice(1, 0, `  ${alias.get(id)}["${(names.get(id) ?? '').replace(/"/g, "'")}"]`)
    }
    out.push(fence('mermaid', body.join('\n')))
    out.push('')
  }

  const withThread = g.comments.filter((c) => c.thread.length)
  if (withThread.length) {
    out.push('## Yorumlar')
    out.push('')
    for (const c of withThread) {
      const on = c.on ? names.get(c.on) : null
      out.push(`- ${on ? `"${on}" üzerinde` : 'Serbest'} — ${c.thread.join(' / ')}`)
    }
    out.push('')
  }

  return out.join('\n')
}

export const AGENT_BRIEF = `Aşağıdaki içerik bir sonsuz tuval board'ından dışa aktarıldı.
Frame'ler bölüm, madde işaretleri tuvaldeki öğeler (okuma sırası: yukarıdan aşağı, soldan sağa),
"Akış" bölümündeki mermaid grafiği öğeler arasındaki okları temsil eder.
Önce ne yapılmak istendiğini bir paragrafta özetle, sonra somut adımlara dök.

---

`

export function graphToPrompt(g: AgentGraph) {
  return AGENT_BRIEF + graphToMarkdown(g)
}

export function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}
