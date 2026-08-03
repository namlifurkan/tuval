import { t } from '../i18n'
import { COLOR } from './brand'
import { makeConnector, makeFrame, makeShape, makeSticky, makeTable, makeText } from './items'
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
  const node = makeText(x, y, w, style)
  node.text = text
  node.h = size * 1.4
  return node
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
        [t('User interviews'), t('Pricing page')],
        [t('Onboarding flow')],
        [],
        [t('Landing page refresh')],
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
    name: 'Retrospective',
    description: 'Start / Stop / Continue',
    build: (o) => columnLabels(
      o, ['Start', 'Stop', 'Continue'], ['#8FA96B', '#C8664A', '#7FA5BE'], 320, 48, 'Retrospektif',
    ),
  },
  {
    id: 'brainwriting',
    name: 'Brainwriting',
    description: '4×3 idea grid',
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
    name: 'Flowchart',
    description: 'Start → decision → outcome',
    build: (o) => {
      const items: Item[] = []
      const style = { stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid' as const }
      const start = makeShape(o.x - 110, o.y, 220, 90, { kind: 'roundRect', fill: '#7FA5BE', ...style })
      start.text = t('Start')
      const decision = makeShape(o.x - 130, o.y + 180, 260, 180, { kind: 'diamond', fill: '#F0E3B0', ...style })
      decision.text = t('Condition?')
      const yes = makeShape(o.x + 220, o.y + 220, 220, 100, { kind: 'rect', fill: '#CBD79A', ...style })
      yes.text = t('Yes path')
      const no = makeShape(o.x - 440, o.y + 220, 220, 100, { kind: 'rect', fill: '#E7B7B4', ...style })
      no.text = t('No path')
      const done = makeShape(o.x - 110, o.y + 460, 220, 90, { kind: 'roundRect', fill: '#8A7FB0', ...style })
      done.text = t('End')
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
    name: 'Mind map',
    description: 'A centre and five branches',
    build: (o) => {
      const items: Item[] = []
      const core = makeShape(o.x - 150, o.y - 60, 300, 120, {
        kind: 'ellipse', fill: '#3E5C93', stroke: 'transparent', strokeWidth: 0, strokeStyle: 'solid',
      }, { ...DEFAULT_TEXT_STYLE, fontSize: 30, bold: true, textColor: '#FFFFFF' })
      core.text = t('Main idea')
      items.push(core)
      const branches = [t('Users'), t('Problem'), t('Solution'), t('Risks'), t('Metrics')]
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
          { shape: 'curved', stroke: COLOR.muted, strokeWidth: 3, strokeStyle: 'solid', capStart: 'none', capEnd: 'none' },
        ))
      })
      return items
    },
  },
  {
    id: 'journey',
    name: 'Customer journey',
    description: 'Stages against what people do, think and struggle with',
    build: (o) => {
      const stages = [t('Aware'), t('Consider'), t('Sign up'), t('First use'), t('Return')]
      const lenses = [t('Actions'), t('Thoughts'), t('Pain points')]
      const table = makeTable(o.x - 700, o.y, lenses.length + 1, stages.length + 1)
      table.widths = [220, ...stages.map(() => 240)]
      table.heights = [70, 170, 170, 170]
      table.w = table.widths.reduce((a, b) => a + b, 0)
      table.h = table.heights.reduce((a, b) => a + b, 0)
      table.fontSize = 18
      table.align = 'left'
      table.valign = 'top'
      stages.forEach((label, i) => { table.cells[0][i + 1] = label })
      lenses.forEach((label, i) => { table.cells[i + 1][0] = label })
      const frame = makeFrame(table.x - 60, o.y - 150, table.w + 120, table.h + 230, t('Customer journey'))
      return [frame, heading(table.x, o.y - 110, table.w, t('Customer journey'), 44), table]
    },
  },
  {
    id: 'architecture',
    name: 'Architecture',
    description: 'Services and what travels between them',
    build: (o) => {
      const line = { stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid' as const }
      const box = (x: number, y: number, fill: string, label: string) => {
        const node = makeShape(x, y, 260, 110, { kind: 'roundRect', fill, ...line },
          { ...DEFAULT_TEXT_STYLE, fontSize: 22, bold: true })
        node.text = label
        return node
      }
      const browser = box(o.x - 640, o.y, '#7FA5BE', t('Browser'))
      const api = box(o.x - 130, o.y, '#F0E3B0', t('API'))
      const worker = box(o.x - 130, o.y + 260, '#CBD79A', t('Background worker'))
      const db = box(o.x + 380, o.y, '#8A7FB0', t('Database'))
      const files = box(o.x + 380, o.y + 260, '#DE9A4E', t('Object storage'))

      const wire = {
        shape: 'elbow' as const, ...line, capStart: 'none' as const, capEnd: 'arrow' as const,
      }
      const link = (a: Item, b: Item, from: 'right' | 'bottom', to: 'left' | 'top', text: string) => {
        const c = makeConnector(
          { itemId: a.id, anchor: from, x: 0, y: 0 },
          { itemId: b.id, anchor: to, x: 0, y: 0 },
          wire,
        )
        c.text = text
        return c
      }
      const rest = link(browser, api, 'right', 'left', 'HTTPS')
      rest.labels = [{ t: 0.85, text: 'JSON' }]

      const frame = makeFrame(o.x - 760, o.y - 180, 1420, 700, t('Architecture'))
      return [
        frame,
        heading(o.x - 700, o.y - 140, 1300, t('Architecture'), 44),
        browser, api, worker, db, files,
        rest,
        link(api, db, 'right', 'left', 'SQL'),
        link(api, worker, 'bottom', 'top', t('queue')),
        link(worker, files, 'right', 'left', t('writes')),
      ]
    },
  },
  {
    id: 'fivewhys',
    name: 'Five whys',
    description: 'Follow a symptom down to what actually caused it',
    build: (o) => {
      const items: Item[] = []
      const line = { stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid' as const }
      const problem = makeShape(o.x - 220, o.y, 440, 120, { kind: 'roundRect', fill: '#C8664A', ...line },
        { ...DEFAULT_TEXT_STYLE, fontSize: 24, bold: true })
      problem.text = t('What went wrong')
      items.push(problem)

      let previous: Item = problem
      for (let i = 0; i < 5; i++) {
        const step = makeSticky(o.x - 180, o.y + 220 + i * 260, i === 4 ? '#CBD79A' : '#F0E3B0',
          i === 4 ? t('Root cause') : '')
        step.w = 360
        step.h = 180
        items.push(step)
        const c = makeConnector(
          { itemId: previous.id, anchor: 'bottom', x: 0, y: 0 },
          { itemId: step.id, anchor: 'top', x: 0, y: 0 },
          { shape: 'straight' as const, ...line, capStart: 'none' as const, capEnd: 'arrow' as const },
        )
        c.text = t('why?')
        items.push(c)
        previous = step
      }

      const frame = makeFrame(o.x - 400, o.y - 160, 800, 1700, t('Five whys'))
      return [frame, heading(o.x - 340, o.y - 120, 680, t('Five whys'), 44), ...items]
    },
  },
]
