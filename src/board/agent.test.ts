import { describe, expect, it } from 'vitest'
import { boardToGraph, graphToMarkdown } from './agent'
import { briefToItems } from './importer'
import type { Item } from './types'

const build = (md: string) => briefToItems(md, { x: 0, y: 0 })

const brief = `# Sprint

## Discovery

Owner: Ada

- [Decision] Ship guest checkout first
- Payment errors are not explained

## Build

\`\`\`ts
export const ok = true
\`\`\`

## Flow

\`\`\`mermaid
flowchart TD
  n1["Ship guest checkout first"]
  n2["Payment errors are not explained"]
  n1 -- fix first --> n2
\`\`\`
`

describe('briefToItems', () => {
  const { items, title } = build(brief)
  const frames = items.filter((i) => i.type === 'frame')
  const stickies = items.filter((i) => i.type === 'sticky')

  it('returns the title', () => {
    expect(title).toBe('Sprint')
  })

  it('makes a frame per section', () => {
    expect(frames.map((f) => f.type === 'frame' && f.title)).toEqual(['Discovery', 'Build'])
  })

  it('parents every item to its frame', () => {
    const loose = items.filter((i) => i.type !== 'frame' && i.type !== 'connector' && !i.parentId)
    expect(loose).toEqual([])
  })

  it('lays frames out side by side without overlapping', () => {
    const [a, b] = frames
    expect(a.x + a.w).toBeLessThanOrEqual(b.x)
  })

  it('keeps children inside their frame', () => {
    for (const item of items) {
      if (!item.parentId) continue
      const frame = frames.find((f) => f.id === item.parentId)!
      expect(item.x).toBeGreaterThanOrEqual(frame.x)
      expect(item.y).toBeGreaterThanOrEqual(frame.y)
      expect(item.x + item.w).toBeLessThanOrEqual(frame.x + frame.w)
      expect(item.y + item.h).toBeLessThanOrEqual(frame.y + frame.h)
    }
  })

  it('wires the mermaid edge to the matching stickies', () => {
    const wires = items.filter((i) => i.type === 'connector')
    expect(wires).toHaveLength(1)
    const wire = wires[0] as Item & { type: 'connector' }
    expect(wire.from.itemId).toBe(stickies[0].id)
    expect(wire.to.itemId).toBe(stickies[1].id)
    expect(wire.text).toBe('fix first')
  })

  it('drops an edge whose nodes it cannot resolve', () => {
    const { items: only } = build('## S\n\n- one\n\n## Flow\n\n```mermaid\nflowchart TD\n  z1 --> z2\n```')
    expect(only.filter((i) => i.type === 'connector')).toHaveLength(0)
  })
})

describe('round trip', () => {
  it('survives board to markdown and back', () => {
    const first = build(brief)
    const md = graphToMarkdown(boardToGraph(first.items, 'Sprint'))
    const second = build(md)

    const titles = (items: Item[]) =>
      items.filter((i) => i.type === 'frame').map((f) => f.type === 'frame' && f.title)
    const texts = (items: Item[]) =>
      items.filter((i) => i.type === 'sticky').map((s) => 'text' in s && s.text)

    expect(titles(second.items)).toEqual(titles(first.items))
    expect(texts(second.items)).toEqual(texts(first.items))
    expect(second.items.filter((i) => i.type === 'connector')).toHaveLength(1)
    expect(second.items.filter((i) => i.type === 'code')).toHaveLength(1)
  })

  it('carries a status label through the loop', () => {
    const md = graphToMarkdown(boardToGraph(build(brief).items, 'Sprint'))
    expect(md).toContain('- [Decision] Ship guest checkout first')
    const back = build(md).items.find((i) => i.type === 'sticky')
    expect(back && 'label' in back && back.label).toBe('Decision')
  })

  it('carries a frame owner through the loop', () => {
    const md = graphToMarkdown(boardToGraph(build(brief).items, 'Sprint'))
    expect(md).toContain('Owner: Ada')
  })
})

describe('boardToGraph', () => {
  it('reads rows top to bottom, then left to right', () => {
    const at = (id: string, x: number, y: number, text: string) => ({
      id, type: 'sticky', x, y, w: 200, h: 200, rotation: 0, z: 0,
      parentId: null, groupId: null, locked: false, opacity: 1, fill: '#fff', text, shape: 'square',
    } as unknown as Item)
    const graph = boardToGraph(
      [at('c', 400, 0, 'right'), at('a', 0, 0, 'left'), at('b', 0, 400, 'below')],
      'B',
    )
    expect(graph.sections[0].nodes.map((n) => n.text)).toEqual(['left', 'right', 'below'])
  })

  it('counts frames and edges', () => {
    const graph = boardToGraph(build(brief).items, 'Sprint')
    expect(graph.counts.frame).toBe(2)
    expect(graph.counts.edge).toBe(1)
  })
})
