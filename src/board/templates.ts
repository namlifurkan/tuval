import { makeConnector, makeFrame, makeShape, makeSticky, makeText } from './items'
import type { Item, TextStyle, Vec } from './types'
import { DEFAULT_TEXT_STYLE } from './types'

export interface Template {
  id: string
  name: string
  description: string
  build: (origin: Vec) => Item[]
}

const heading = (x: number, y: number, w: number, text: string, size = 40): Item => {
  const style: TextStyle = { ...DEFAULT_TEXT_STYLE, fontSize: size, align: 'center', autoFit: false }
  const t = makeText(x, y, w, style)
  t.text = text
  t.h = size * 1.4
  return t
}

const columnLabels = (
  origin: Vec, labels: string[], colors: string[], colW: number, gap: number, title: string,
): Item[] => {
  const items: Item[] = []
  const totalW = labels.length * colW + (labels.length - 1) * gap
  const frame = makeFrame(origin.x - totalW / 2 - 60, origin.y - 120, totalW + 120, 1080, title)
  items.push(frame)
  items.push(heading(origin.x - totalW / 2, origin.y - 60, totalW, title, 44))
  labels.forEach((label, i) => {
    const x = origin.x - totalW / 2 + i * (colW + gap)
    const head = makeShape(x, origin.y + 20, colW, 76, {
      kind: 'roundRect', fill: colors[i % colors.length], stroke: 'transparent',
      strokeWidth: 0, strokeStyle: 'solid',
    }, { ...DEFAULT_TEXT_STYLE, fontSize: 26, bold: true })
    head.text = label
    items.push(head)
  })
  return items
}

export const TEMPLATES: Template[] = [
  {
    id: 'kanban',
    name: 'Kanban',
    description: 'Backlog → In progress → Review → Done',
    build: (o) => {
      const cols = ['Backlog', 'In progress', 'Review', 'Done']
      const colors = ['#7FA5BE', '#E8C55A', '#8A7FB0', '#8FA96B']
      const colW = 280, gap = 40
      const items = columnLabels(o, cols, colors, colW, gap, 'Kanban')
      const totalW = cols.length * colW + (cols.length - 1) * gap
      const seed = [
        ['Kullanıcı görüşmeleri', 'Fiyatlandırma sayfası'],
        ['Onboarding akışı'],
        [],
        ['Landing yenileme'],
      ]
      seed.forEach((notes, c) => {
        notes.forEach((text, r) => {
          const s = makeSticky(
            o.x - totalW / 2 + c * (colW + gap) + (colW - 240) / 2,
            o.y + 130 + r * 260,
            ['#F0E3B0', '#CBD79A', '#E7B7B4', '#5E9A8A'][c],
            text,
          )
          s.w = 240; s.h = 240
          items.push(s)
        })
      })
      return items
    },
  },
  {
    id: 'retro',
    name: 'Retrospektif',
    description: 'Start / Stop / Continue',
    build: (o) => columnLabels(
      o, ['Start', 'Stop', 'Continue'], ['#8FA96B', '#C8664A', '#7FA5BE'], 320, 48, 'Retrospektif',
    ),
  },
  {
    id: 'brainwriting',
    name: 'Brainwriting',
    description: '4×3 fikir ızgarası',
    build: (o) => {
      const items: Item[] = []
      const cols = 4, rows = 3, size = 220, gap = 32
      const totalW = cols * size + (cols - 1) * gap
      const totalH = rows * size + (rows - 1) * gap
      items.push(makeFrame(o.x - totalW / 2 - 60, o.y - 140, totalW + 120, totalH + 220, 'Brainwriting'))
      items.push(heading(o.x - totalW / 2, o.y - 90, totalW, 'Fikirler', 40))
      const palette = ['#F0E3B0', '#CBD79A', '#7FA5BE', '#E7B7B4']
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const s = makeSticky(
            o.x - totalW / 2 + c * (size + gap),
            o.y + r * (size + gap),
            palette[(r + c) % palette.length],
          )
          s.w = size; s.h = size
          items.push(s)
        }
      }
      return items
    },
  },
  {
    id: 'flow',
    name: 'Akış şeması',
    description: 'Başlangıç → karar → sonuç',
    build: (o) => {
      const items: Item[] = []
      const style = { stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid' as const }
      const start = makeShape(o.x - 110, o.y, 220, 90, { kind: 'roundRect', fill: '#7FA5BE', ...style })
      start.text = 'Başlangıç'
      const decision = makeShape(o.x - 130, o.y + 180, 260, 180, { kind: 'diamond', fill: '#F0E3B0', ...style })
      decision.text = 'Koşul?'
      const yes = makeShape(o.x + 220, o.y + 220, 220, 100, { kind: 'rect', fill: '#CBD79A', ...style })
      yes.text = 'Evet yolu'
      const no = makeShape(o.x - 440, o.y + 220, 220, 100, { kind: 'rect', fill: '#E7B7B4', ...style })
      no.text = 'Hayır yolu'
      const done = makeShape(o.x - 110, o.y + 460, 220, 90, { kind: 'roundRect', fill: '#8A7FB0', ...style })
      done.text = 'Bitiş'
      items.push(start, decision, yes, no, done)

      const conn = { shape: 'elbow' as const, stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid' as const, capStart: 'none' as const, capEnd: 'arrow' as const }
      items.push(
        makeConnector({ itemId: start.id, anchor: 'bottom', x: 0, y: 0 }, { itemId: decision.id, anchor: 'top', x: 0, y: 0 }, conn),
        makeConnector({ itemId: decision.id, anchor: 'right', x: 0, y: 0 }, { itemId: yes.id, anchor: 'left', x: 0, y: 0 }, conn),
        makeConnector({ itemId: decision.id, anchor: 'left', x: 0, y: 0 }, { itemId: no.id, anchor: 'right', x: 0, y: 0 }, conn),
        makeConnector({ itemId: decision.id, anchor: 'bottom', x: 0, y: 0 }, { itemId: done.id, anchor: 'top', x: 0, y: 0 }, conn),
      )
      return items
    },
  },
  {
    id: 'mindmap',
    name: 'Zihin haritası',
    description: 'Merkez fikir + 5 dal',
    build: (o) => {
      const items: Item[] = []
      const core = makeShape(o.x - 150, o.y - 60, 300, 120, {
        kind: 'ellipse', fill: '#3E5C93', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid',
      }, { ...DEFAULT_TEXT_STYLE, fontSize: 30, bold: true, textColor: '#FFFFFF' })
      core.text = 'Ana fikir'
      items.push(core)
      const branches = ['Kullanıcılar', 'Sorun', 'Çözüm', 'Riskler', 'Metrikler']
      const colors = ['#F0E3B0', '#CBD79A', '#7FA5BE', '#E7B7B4', '#8A7FB0']
      branches.forEach((label, i) => {
        const a = (i / branches.length) * Math.PI * 2 - Math.PI / 2
        const b = makeShape(
          o.x + Math.cos(a) * 460 - 120, o.y + Math.sin(a) * 340 - 50, 240, 100,
          { kind: 'roundRect', fill: colors[i], stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid' },
          { ...DEFAULT_TEXT_STYLE, fontSize: 22 },
        )
        b.text = label
        items.push(b)
        items.push(makeConnector(
          { itemId: core.id, anchor: null, x: 0, y: 0 },
          { itemId: b.id, anchor: null, x: 0, y: 0 },
          { shape: 'curved', stroke: '#8A867C', strokeWidth: 3, strokeStyle: 'solid', capStart: 'none', capEnd: 'none' },
        ))
      })
      return items
    },
  },
]
