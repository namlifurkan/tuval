import { useEffect, useMemo, useRef, useState } from 'react'
import { fitRect } from '../board/camera'
import { createItems, getItems } from '../board/doc'
import { bandsOf, STATUS_TONE } from '../board/issues'
import { makeConnector, makeFrame, makeSticky, makeText } from '../board/items'
import type { Field } from '../board/database'
import type { Record as Row, Status } from '../board/records'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { DEFAULT_TEXT_STYLE } from '../board/types'
import { TEMPLATES } from '../board/templates'
import type { Demo } from '../site/pages'
import { Canvas } from './Canvas'
import { DatabaseTable } from './DatabaseTable'
import { TextEditor } from './TextEditor'
import { Connector, Nib, Select, Sticky } from './icons'

// The imagery on this site is the product. Not a screenshot of it and not a coloured rectangle
// where one should be: the canvas below is the renderer the app uses, on a document that is
// never stored, and the table is the component the app draws a database with.

const TOOLS = [
  { id: 'select', icon: Select, key: 'V' },
  { id: 'sticky', icon: Sticky, key: 'N' },
  { id: 'connector', icon: Connector, key: 'L' },
  { id: 'pen', icon: Nib, key: 'P' },
] as const

// The board each page opens on is that page's own. A consultant lands on a five whys, a
// software team on a kanban, and the two pages stop being the same page with different words.
function seed(template?: string) {
  if (getItems().length) return
  const found = template && TEMPLATES.find((t) => t.id === template)
  if (found) {
    createItems(found.build({ x: 0, y: 0 }))
    requestRender()
    return
  }
  const frame = makeFrame(-514, -250, 1028, 500, 'Try me')
  const a = makeSticky(-420, -150, '#F0E3B0', 'An idea lands here')
  const b = makeSticky(-100, -150, '#7FA5BE', 'Drag me anywhere')
  const c = makeSticky(220, -150, '#CBD79A', 'Double click to write')
  const caption = makeText(-420, 120, 760, { ...DEFAULT_TEXT_STYLE, fontSize: 20 })
  caption.text = 'Nothing here is saved. Sign in and it is your board.'
  const wire = (from: string, to: string) => makeConnector(
    { itemId: from, anchor: 'right', x: 0, y: 0 },
    { itemId: to, anchor: 'left', x: 0, y: 0 },
    { shape: 'curved', stroke: '#141310', strokeWidth: 2, strokeStyle: 'solid', capStart: 'none', capEnd: 'arrow' },
  )
  createItems([frame, a, b, c, caption, wire(a.id, b.id), wire(b.id, c.id)])
  requestRender()
}

function CanvasDemo({ template, tall }: { template?: string; tall?: boolean }) {
  const shell = useRef<HTMLDivElement>(null)
  const tool = useBoardStore((s) => s.tool)
  const setTool = useBoardStore((s) => s.setTool)

  useEffect(() => {
    seed(template)
    const el = shell.current
    if (!el) return
    // Fitted with a generous margin so the board sits inside the band like a picture inside a
    // mount rather than running off the bottom edge.
    const fit = () => {
      const box = boxOf(getItems())
      if (!box.w) return
      useBoardStore.getState().setCamera(fitRect(box, el.clientWidth - 120, el.clientHeight - 96))
      requestRender()
    }
    fit()
    // The document commits on the next tick, so the first fit can measure an empty board.
    const soon = setTimeout(fit, 80)
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => { clearTimeout(soon); watch.disconnect() }
  }, [template])

  return (
    <div
      ref={shell}
      className={`relative w-full overflow-hidden border-y border-[#141310]/10 bg-[#F2EFE9] ${
        tall ? 'h-[clamp(24rem,62vh,40rem)]' : 'h-[clamp(20rem,46vh,30rem)]'}`}
    >
      <Canvas />
      <TextEditor />
      <div className="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#E2DED5] bg-[#FCFBF8] p-1 shadow-[2px_2px_0_rgba(20,19,16,0.07)]">
          {TOOLS.map(({ id, icon: Icon, key }) => (
            <button
              key={id}
              type="button"
              title={`${id} — ${key}`}
              onClick={() => { setTool(id); requestRender() }}
              className={`grid h-9 w-9 place-items-center rounded-lg transition-colors
                ${tool === id ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#141310] hover:bg-[#EAE6DD]'}`}
            >
              <Icon size={19} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// A shape somebody would actually build on their first afternoon, fed to the component the app
// draws every database with.
const FIELDS: Field[] = [
  { id: 'f1', name: 'Stage', type: 'status', choices: [
    { id: 's1', name: 'todo', tone: '#D6D1C6', stage: 'todo' },
    { id: 's2', name: 'doing', tone: '#E8C55A', stage: 'doing' },
    { id: 's3', name: 'done', tone: '#8FA96B', stage: 'done' },
  ] },
  { id: 'f2', name: 'Value', type: 'number' },
  { id: 'f3', name: 'Closes', type: 'date' },
  { id: 'f4', name: 'Signed', type: 'checkbox' },
]

const DEALS: [string, string, number, string, boolean][] = [
  ['Rebuild the intranet', 's2', 48000, '2026-09-12', false],
  ['Brand system', 's3', 22500, '2026-08-04', true],
  ['Warehouse dashboard', 's2', 61000, '2026-10-01', false],
  ['Onboarding overhaul', 's1', 15000, '2026-11-20', false],
  ['Data migration', 's3', 9800, '2026-07-29', true],
]

const dealRows: Row[] = DEALS.map(([title, stage, value, closes, signed], at) => ({
  id: `demo-${at}`,
  kind: 'doc',
  title,
  description: '',
  icon: '',
  cover: '',
  parent_id: 'demo-db',
  status: null,
  assignee: null,
  priority: null,
  due_at: null,
  position: at,
  updated_at: '2026-08-01T09:00:00.000Z',
  published_at: null,
  public_slug: null,
  created_at: '2026-07-01T09:00:00.000Z',
  created_by: null,
  updated_by: null,
  seq: null,
  estimate: null,
  cycle_id: null,
  project_id: null,
  data: { f1: stage, f2: value, f3: closes, f4: signed },
} as Row))

const DB = { id: 'demo-db', kind: 'database', title: 'Deals', data: { fields: FIELDS, views: [] } } as unknown as Row

function DatabaseDemo() {
  const [by, setBy] = useState<string>('')
  const group = FIELDS.find((f) => f.id === by)

  return (
    <div className="rounded-2xl border border-[#E2DED5] bg-[#FCFBF8] p-3 shadow-[4px_4px_0_rgba(20,19,16,0.06)]">
      <div className="mb-2 flex flex-wrap items-center gap-1.5 px-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">Group by</span>
        {[{ id: '', name: 'nothing' }, ...FIELDS.filter((f) => f.type === 'status' || f.type === 'checkbox')].map((f) => (
          <button
            key={f.id || 'none'}
            type="button"
            onClick={() => setBy(f.id)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors
              ${by === f.id ? 'bg-[#C8452D] text-white' : 'bg-[#EFEBE2] text-[#4A463E] hover:bg-[#E2DED5]'}`}
          >{f.name}</button>
        ))}
      </div>
      <div className="max-h-[26rem] overflow-auto">
        <DatabaseTable
          db={DB}
          rows={dealRows}
          fields={FIELDS}
          group={group}
          team={[]}
          onAddField={() => undefined}
        />
      </div>
    </div>
  )
}

const WORK: [string, Status, number, string][] = [
  ['Merge the import branch', 'doing', 3, 'TUV-41'],
  ['Signed URLs for attachments', 'doing', 2, 'TUV-38'],
  ['Retro board template', 'todo', 1, 'TUV-44'],
  ['Cycle burn-down off by one', 'review', 2, 'TUV-36'],
  ['Second brain kit', 'todo', 5, 'TUV-45'],
  ['Public profile pages', 'done', 8, 'TUV-30'],
  ['Find and replace in a page', 'done', 3, 'TUV-33'],
]

const workRows = WORK.map(([title, status, estimate, key], at) => ({
  id: `work-${at}`, kind: 'issue', title, status, estimate, seq: Number(key.split('-')[1]),
  assignee: null, priority: null, parent_id: null, project_id: null, cycle_id: null,
  position: at, data: {},
} as unknown as Row))

// The real grouping, drawn small. bandsOf is the function the issue list itself is built on, so
// what these bands say about the work is what the product would say.
function IssuesDemo() {
  const [group, setGroup] = useState<'status' | 'priority' | 'none'>('status')
  const bands = useMemo(
    () => bandsOf(workRows, group, { person: () => 'Unassigned', cycle: () => 'No cycle' }),
    [group],
  )

  return (
    <div className="rounded-2xl border border-[#E2DED5] bg-[#FCFBF8] p-4 shadow-[4px_4px_0_rgba(20,19,16,0.06)]">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">Group by</span>
        {(['status', 'priority', 'none'] as const).map((one) => (
          <button
            key={one}
            type="button"
            onClick={() => setGroup(one)}
            className={`rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors
              ${group === one ? 'bg-[#C8452D] text-white' : 'bg-[#EFEBE2] text-[#4A463E] hover:bg-[#E2DED5]'}`}
          >{one}</button>
        ))}
      </div>

      {bands.map((band) => (
        <div key={band.key} className="mb-4 last:mb-0">
          <div className="flex items-center gap-2 px-1 pb-1">
            <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4A463E]">
              {band.label || 'Everything'}
            </span>
            <span className="text-[11px] tabular-nums text-[#B6B1A6]">{band.rows.length}</span>
          </div>
          <ul className="divide-y divide-[#EFEBE2] border-t border-[#EFEBE2]">
            {band.rows.map((row) => (
              <li key={row.id} className="flex items-center gap-2.5 py-2">
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: row.status ? STATUS_TONE[row.status] ?? '#C6C2B6' : '#C6C2B6' }}
                />
                <span className="min-w-0 flex-1 truncate text-[14px] text-[#141310]">{row.title}</span>
                <span className="shrink-0 text-[11px] tabular-nums text-[#B6B1A6]">
                  {row.estimate ? `${row.estimate} pt` : ''}
                </span>
                <span className="w-[4.5rem] shrink-0 text-right text-[11px] font-semibold tabular-nums text-[#8A867C]">
                  TUV-{row.seq}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function SiteDemo({ kind, template, tall }: { kind: Demo; template?: string; tall?: boolean }) {
  if (kind === 'canvas') return <CanvasDemo template={template} tall={tall} />
  if (kind === 'database') return <DatabaseDemo />
  if (kind === 'issues') return <IssuesDemo />
  return null
}
