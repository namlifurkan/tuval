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
      const colors = ['#A6CCF5', '#F5D128', '#B5A6E5', '#93D275']
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
            ['#FFF9B1', '#D5F692', '#FFCEE0', '#A6DFE2'][c],
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
      o, ['Start', 'Stop', 'Continue'], ['#93D275', '#F16C7F', '#A6CCF5'], 320, 48, 'Retrospektif',
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
      const palette = ['#FFF9B1', '#D5F692', '#A6CCF5', '#FFCEE0']
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
      const style = { stroke: '#1A1A1A', strokeWidth: 2, strokeStyle: 'solid' as const }
      const start = makeShape(o.x - 110, o.y, 220, 90, { kind: 'roundRect', fill: '#A6CCF5', ...style })
      start.text = 'Başlangıç'
      const decision = makeShape(o.x - 130, o.y + 180, 260, 180, { kind: 'diamond', fill: '#FFF9B1', ...style })
      decision.text = 'Koşul?'
      const yes = makeShape(o.x + 220, o.y + 220, 220, 100, { kind: 'rect', fill: '#D5F692', ...style })
      yes.text = 'Evet yolu'
      const no = makeShape(o.x - 440, o.y + 220, 220, 100, { kind: 'rect', fill: '#FFCEE0', ...style })
      no.text = 'Hayır yolu'
      const done = makeShape(o.x - 110, o.y + 460, 220, 90, { kind: 'roundRect', fill: '#B5A6E5', ...style })
      done.text = 'Bitiş'
      items.push(start, decision, yes, no, done)

      const conn = { shape: 'elbow' as const, stroke: '#1A1A1A', strokeWidth: 2, strokeStyle: 'solid' as const, capStart: 'none' as const, capEnd: 'arrow' as const }
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
        kind: 'ellipse', fill: '#4262FF', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid',
      }, { ...DEFAULT_TEXT_STYLE, fontSize: 30, bold: true, textColor: '#FFFFFF' })
      core.text = 'Ana fikir'
      items.push(core)
      const branches = ['Kullanıcılar', 'Sorun', 'Çözüm', 'Riskler', 'Metrikler']
      const colors = ['#FFF9B1', '#D5F692', '#A6CCF5', '#FFCEE0', '#B5A6E5']
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
          { shape: 'curved', stroke: '#9B9BAB', strokeWidth: 3, strokeStyle: 'solid', capStart: 'none', capEnd: 'none' },
        ))
      })
      return items
    },
  },
]
