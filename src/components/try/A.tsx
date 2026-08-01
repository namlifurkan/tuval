import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ArrowRight, Check, Copy, GitBranch, Terminal } from 'lucide-react'
import { boardToGraph, graphToMarkdown } from '../../board/agent'
import { briefToItems } from '../../board/importer'
import { fitRect } from '../../board/camera'
import { resolveConnector } from '../../board/geometry'
import { makeConnector, makeFrame, makeSticky, STICKY_SIZE } from '../../board/items'
import { boxOf, render } from '../../board/render'
import { inEnglish } from '../../i18n'
import type { Item } from '../../board/types'

const MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
const PROSE = '"Instrument Sans", system-ui, sans-serif'

const INK = '#141310'
const SOFT = '#4A463E'
const PAPER = '#F2EFE9'
const SURFACE = '#FCFBF8'
const WASH = '#EBE7DE'
const HAIR = '#E2DED5'
const RULE = '#D6D1C6'
const MUTED = '#8A867C'
const PIGMENT = '#C8452D'
const PIGMENT_LIT = '#E4765E'

const SHADOW = '5px 5px 0 rgba(20,19,16,0.07)'
const REPO = 'https://github.com/namlifurkan/tuval'

const still = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches

function Reveal({ children, delay = 0, className = '' }: {
  children: ReactNode
  delay?: number
  className?: string
}) {
  const shell = useRef<HTMLDivElement>(null)
  const [seen, setSeen] = useState(false)

  useEffect(() => {
    const el = shell.current
    if (!el) return
    if (still() || typeof IntersectionObserver !== 'function') { setSeen(true); return }
    const watch = new IntersectionObserver((rows) => {
      if (rows.some((r) => r.isIntersecting)) { setSeen(true); watch.disconnect() }
    }, { rootMargin: '0px 0px -10% 0px' })
    watch.observe(el)
    return () => watch.disconnect()
  }, [])

  return (
    <div
      ref={shell}
      className={className}
      style={{
        opacity: seen ? 1 : 0,
        clipPath: seen ? 'inset(0 0 0 0)' : 'inset(0 0 12% 0)',
        transition: `opacity 700ms cubic-bezier(0.16,1,0.3,1) ${delay}ms, clip-path 900ms cubic-bezier(0.16,1,0.3,1) ${delay}ms`,
      }}
    >
      {children}
    </div>
  )
}

function CopyButton({ body, tint }: { body: string; tint?: boolean }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(body)
        setDone(true)
        setTimeout(() => setDone(false), 1600)
      }}
      className="flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold uppercase tracking-[0.1em] transition-opacity hover:opacity-100"
      style={{ fontFamily: MONO, color: tint ? PAPER : INK, opacity: done ? 1 : 0.55 }}
    >
      {done ? <Check size={12} /> : <Copy size={12} />}
      {done ? 'Copied' : 'Copy'}
    </button>
  )
}

// The boards on this page ------------------------------------------------------------------------
// Not screenshots. render() is the function the live canvas calls every frame, aimed at an
// offscreen context, so a picture of a board here is a board.

const SCENE = {
  preview: new Map(),
  badge: null,
  spacing: [],
  dropFrame: null,
  marquee: null,
  guides: [],
  draft: null,
  connectorDraft: null,
  anchorsFor: null,
  remote: [],
  spaceDown: false,
  cursor: 'default',
}

function Plate({ items, className = '', surface = PAPER, pad = 26, alt }: {
  items: Item[]
  className?: string
  surface?: string
  pad?: number
  alt: string
}) {
  const plate = useRef<HTMLCanvasElement>(null)
  const shell = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = plate.current
    const box = shell.current
    if (!canvas || !box) return

    const paint = () => {
      const width = box.clientWidth
      const height = box.clientHeight
      const world = boxOf(items)
      if (!width || !height || !world.w) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      render({
        ctx,
        cam: fitRect(world, width, height, pad),
        width,
        height,
        items,
        selection: new Set(),
        hover: null,
        editing: null,
        editingCell: null,
        session: SCENE,
        surface,
        texture: 'paper',
        showAnchors: false,
        dpr,
      })
    }

    paint()
    const watch = new ResizeObserver(paint)
    watch.observe(box)
    void document.fonts?.ready.then(paint)
    return () => watch.disconnect()
  }, [items, surface, pad])

  return (
    <div ref={shell} className={`relative overflow-hidden ${className}`} style={{ background: surface }}>
      <canvas ref={plate} className="h-full w-full" role="img" aria-label={alt} />
    </div>
  )
}

// A connector finds its ends by looking its neighbours up in the open document. These boards are
// not in one — they are made and thrown away inside this page — so the ends are worked out here
// against the list itself and written onto the endpoints, which is where the renderer looks next.
function anchored(items: Item[]): Item[] {
  const index = new Map(items.map((i) => [i.id, i]))
  return items.map((item) => {
    if (item.type !== 'connector') return item
    const ends = resolveConnector(item, (id) => index.get(id))
    return {
      ...item,
      from: { ...item.from, x: ends.a.x, y: ends.a.y },
      to: { ...item.to, x: ends.b.x, y: ends.b.y },
    }
  })
}

// The board that gets handed over. Built with the editor's own constructors, so the round trip
// further down is the real one rather than a drawing of it.
const GAP = 44
const STEP = STICKY_SIZE + GAP
const FRAME_PAD = 64

const NOTES: [string, string][] = [
  ['#F0E3B0', 'Search misses obvious things'],
  ['#7FA5BE', 'Match titles before body'],
  ['#CBD79A', 'Recent beats old'],
  ['#E7B7B4', 'Ship it behind a flag'],
]

function drawnBoard(): Item[] {
  return inEnglish(() => {
    const side = 2 * STICKY_SIZE + GAP
    const frame = makeFrame(
      -FRAME_PAD, -FRAME_PAD, side + FRAME_PAD * 2, side + FRAME_PAD * 2, 'Search, rewritten',
    )
    const notes = NOTES.map(([fill, text], at) => {
      const note = makeSticky((at % 2) * STEP, Math.floor(at / 2) * STEP, fill, text)
      note.parentId = frame.id
      return note
    })
    const wire = (from: string, to: string, side2: 'right' | 'bottom') => makeConnector(
      { itemId: from, anchor: side2, x: 0, y: 0 },
      { itemId: to, anchor: side2 === 'right' ? 'left' : 'top', x: 0, y: 0 },
      {
        shape: 'curved',
        stroke: INK,
        strokeWidth: 2,
        strokeStyle: 'solid',
        capStart: 'none',
        capEnd: 'arrow',
      },
    )
    return [
      frame,
      ...notes,
      wire(notes[0].id, notes[1].id, 'right'),
      wire(notes[0].id, notes[2].id, 'bottom'),
      wire(notes[1].id, notes[3].id, 'bottom'),
    ]
  })
}

function Kicker({ n, children }: { n: string; children: ReactNode }) {
  return (
    <p
      className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
      style={{ fontFamily: MONO, color: MUTED }}
    >
      <span style={{ color: PIGMENT }}>{n}</span>
      <span aria-hidden className="h-px w-8" style={{ background: RULE }} />
      {children}
    </p>
  )
}

function Head({ title, note, body, tint }: {
  title: string
  note: string
  body?: string
  tint?: boolean
}) {
  return (
    <div
      className="flex items-baseline gap-3 border-b px-4 py-3"
      style={{ borderColor: tint ? 'rgba(242,239,233,0.16)' : 'rgba(20,19,16,0.1)' }}
    >
      <span className="shrink-0 text-[12px] font-semibold tracking-[-0.01em]">{title}</span>
      <span
        className="min-w-0 flex-1 truncate text-[11px]"
        style={{ fontFamily: MONO, color: tint ? 'rgba(242,239,233,0.5)' : MUTED }}
      >
        {note}
      </span>
      {body ? <CopyButton body={body} tint={tint} /> : null}
    </div>
  )
}

function Step({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-1 lg:w-16 lg:flex-col lg:py-0">
      <span aria-hidden className="h-px flex-1 lg:h-auto lg:w-px lg:flex-1" style={{ background: RULE }} />
      <span
        className="whitespace-nowrap text-[10px] font-semibold tracking-[0.06em] lg:[writing-mode:vertical-rl]"
        style={{ fontFamily: MONO, color: PIGMENT }}
      >
        {label}
      </span>
      <ArrowRight size={14} style={{ color: PIGMENT }} className="rotate-90 lg:rotate-0" />
      <span aria-hidden className="h-px flex-1 lg:h-auto lg:w-px lg:flex-1" style={{ background: RULE }} />
    </div>
  )
}

function Face({ label, note, foot, children }: {
  label: string
  note: string
  foot: string
  children: ReactNode
}) {
  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border"
      style={{ borderColor: 'rgba(20,19,16,0.12)', background: SURFACE, boxShadow: SHADOW }}
    >
      <Head title={label} note={note} />
      {children}
      <p
        className="mt-auto border-t px-4 py-3.5 text-[12.5px] leading-[1.55]"
        style={{ borderColor: 'rgba(20,19,16,0.08)', fontFamily: PROSE, color: MUTED }}
      >
        {foot}
      </p>
    </div>
  )
}

const TOOLS: [string, string][] = [
  ['search', 'Pages, databases, issues and projects, by the words in their titles and bodies. Comes back with an excerpt and the address to read each one in full.'],
  ['read_page', 'One page or one issue in full, as markdown, with its headings and lists intact.'],
  ['list_records', 'issue · doc · database · project · person · company · event · file. Filtered by status, assignee, project or cycle.'],
  ['workspace', 'What this key can reach, and the addresses inside it.'],
]

const SOURCES = [
  {
    head: 'From Miro',
    code: 'node scripts/miro-export.mjs <board>',
    body: 'Pulls a board down to JSON with your own token, which stays in your shell and never touches our servers. Stickies, shapes, frames, connectors, text and images arrive as real items on a real canvas — editable, not a picture of a board.',
  },
  {
    head: 'From Notion',
    code: 'Export → .zip → drop it in',
    body: 'Pages arrive as pages with their blocks intact. Databases arrive as databases, each column typed from the values it actually holds, with the rows already inside them.',
  },
  {
    head: 'From a PDF',
    code: 'drag · drop',
    body: 'A dropped PDF is laid out page by page, one frame each, so last quarter\'s deck becomes something you can draw on and point at. Images go straight onto the canvas.',
  },
]

const PLANS = [
  {
    head: 'Self-hosted',
    price: 'Free',
    unit: 'forever, and not a trial',
    body: 'AGPL-3.0. Your Postgres, your storage, your limits, your seat count. Nothing is held back for the paid tier, because the paid tier is this code.',
    cta: 'Read the source',
    href: REPO,
    on: false,
  },
  {
    head: 'Hosted, up to three',
    price: '₺0',
    unit: 'for the first three people',
    body: 'The whole product, with somebody else keeping the disks spinning. Enough for a founder and two others, and enough to find out whether you like it before anyone signs anything.',
    cta: 'Open a board',
    href: '/dashboard',
    on: true,
  },
  {
    head: 'Hosted, team',
    price: '₺249',
    unit: 'per member / month · VAT included',
    body: 'About seven dollars, for everyone past the third. Same product, same exports, same right to take the whole thing and move to the first column on any afternoon you like.',
    cta: 'Start a team',
    href: '/dashboard',
    on: false,
  },
]

const UNFINISHED: [string, string][] = [
  [
    'Live editing has not met two humans yet.',
    'It is built — Yjs over Supabase Realtime, on a private channel that passes the same row-level security as everything else. It has not been sat in front of two people at the same time. That test is next, and it is written down here rather than hidden inside a feature grid.',
  ],
  [
    'There is no mobile layout, on purpose.',
    'An infinite canvas on a phone is a viewing experience in an editor\'s clothes. The case being built for is a room, a shared screen and a keyboard. If that ever changes, it will change out loud.',
  ],
  [
    'Embeds sit above the canvas.',
    'They live in a DOM layer, so an item stacked over an embed still draws behind it. Fixing it properly means moving the entire renderer into the DOM, which costs more than the bug does.',
  ],
  [
    'There is no AI assistant inside the product.',
    'There is not going to be one. The agent is yours, running where you run it, on the model you already pay for. The workspace\'s only job is to be legible to it — which is the entire top half of this page.',
  ],
  [
    'One maintainer.',
    'Not a team pretending to be small, and not a small team pretending to be a company. The repository goes public shortly, and this list lives in it, where it can be checked against the commits.',
  ],
  [
    'Self-hosting is the floor, not the trick.',
    'AGPL means the hosted copy can never quietly become the only good one. If the hosting stops, the product does not — and that promise is held up by the licence rather than by a blog post.',
  ],
]

export default function TryA() {
  const board = useMemo(() => anchored(drawnBoard()), [])
  const graph = useMemo(() => inEnglish(() => boardToGraph(board, 'Product sync, this morning')), [board])
  const brief = useMemo(() => inEnglish(() => graphToMarkdown(graph)), [graph])
  const json = useMemo(() => JSON.stringify(graph, null, 2), [graph])
  const returned = useMemo(
    () => anchored(inEnglish(() => briefToItems(brief, { x: 0, y: 0 }).items)),
    [brief],
  )
  const [face, setFace] = useState<'brief' | 'graph'>('brief')

  const shell = 'mx-auto w-full max-w-[84rem] px-6 sm:px-8'
  const panel = 'flex flex-col overflow-hidden rounded-2xl border'
  const panelStyle = { borderColor: 'rgba(20,19,16,0.12)', background: SURFACE, boxShadow: SHADOW }
  const h2 = { fontSize: 'clamp(2.1rem, 4.3vw, 3.5rem)', lineHeight: 1.0, letterSpacing: '-0.03em' }

  return (
    <div style={{ background: PAPER, color: INK }} className="min-h-full">
      {/* nav ------------------------------------------------------------- */}
      <header
        className="sticky top-0 z-40 border-b backdrop-blur"
        style={{ background: 'rgba(242,239,233,0.88)', borderColor: HAIR }}
      >
        <div className={`${shell} flex h-14 items-center gap-6`}>
          <a href="/" className="flex items-center gap-2.5">
            <span
              className="grid h-6 w-6 place-items-center rounded-[5px] text-[13px] font-bold"
              style={{ background: PIGMENT, color: PAPER }}
            >
              T
            </span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">Tuval</span>
            <span
              className="hidden rounded border px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-[0.12em] sm:inline"
              style={{ fontFamily: MONO, borderColor: RULE, color: MUTED }}
            >
              AGPL-3.0
            </span>
          </a>

          <nav className="mx-auto hidden items-center gap-7 text-[13.5px] md:flex">
            {[['The loop', '#loop'], ['Agents', '#agents'], ['One record', '#record'], ['Pricing', '#pricing']]
              .map(([name, href]) => (
                <a key={href} href={href} className="opacity-70 transition-opacity hover:opacity-100">
                  {name}
                </a>
              ))}
          </nav>

          <div className="ml-auto flex items-center gap-2 md:ml-0">
            <a
              href={REPO}
              className="hidden items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-[#EBE7DE] sm:flex"
              style={{ borderColor: RULE }}
            >
              <GitBranch size={14} /> Source
            </a>
            <a
              href="/dashboard"
              className="rounded-lg px-3.5 py-1.5 text-[13.5px] font-semibold"
              style={{ background: INK, color: PAPER }}
            >
              Open Tuval
            </a>
          </div>
        </div>
      </header>

      {/* hero ------------------------------------------------------------ */}
      <section className={`${shell} pt-20 pb-16 sm:pt-28 sm:pb-20`}>
        <Reveal>
          <p
            className="text-[11px] font-semibold uppercase tracking-[0.22em]"
            style={{ fontFamily: MONO, color: MUTED }}
          >
            Open source · self-hostable · <span style={{ color: PIGMENT }}>MCP server included</span>
          </p>

          <h1
            className="mt-7 max-w-[18ch] font-bold"
            style={{ fontSize: 'clamp(3rem, 7.4vw, 6.2rem)', lineHeight: 0.9, letterSpacing: '-0.038em' }}
          >
            The board is the prompt.
          </h1>

          <p
            className="mt-8 max-w-[57ch] text-[19px] leading-[1.55]"
            style={{ fontFamily: PROSE, color: SOFT }}
          >
            Tuval is a workspace where an infinite canvas, your pages and your issue tracker are
            three views of one record. Draw the work with people. Hand the whole board to an agent
            in one move. Get a board back.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-3">
            <a
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl px-5 py-3 text-[15px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{ background: PIGMENT, color: PAPER, boxShadow: '3px 3px 0 #9E2F1B' }}
            >
              Open a board <ArrowRight size={16} />
            </a>
            <a
              href={REPO}
              className="rounded-xl border px-5 py-3 text-[15px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{ borderColor: 'rgba(20,19,16,0.22)' }}
            >
              Read the source
            </a>
            <p className="text-[13px]" style={{ color: MUTED }}>Free for three people. No card.</p>
          </div>
        </Reveal>

        <Reveal delay={90}>
          <div
            className="mt-14 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border px-4 py-3"
            style={{ borderColor: RULE, background: SURFACE, boxShadow: SHADOW }}
          >
            <Terminal size={14} style={{ color: PIGMENT }} />
            <code className="text-[13.5px]" style={{ fontFamily: MONO }}>
              <span style={{ color: MUTED }}>$ </span>
              claude mcp add tuval -- node scripts/mcp.mjs
            </code>
            <CopyButton body="claude mcp add tuval -- node scripts/mcp.mjs" />
            <span className="text-[12.5px] sm:ml-auto" style={{ color: MUTED }}>
              Four tools. Your workspace, readable from the terminal you already work in.
            </span>
          </div>
        </Reveal>
      </section>

      {/* the loop -------------------------------------------------------- */}
      <section id="loop" className="border-y py-20" style={{ background: WASH, borderColor: HAIR }}>
        <div className={shell}>
          <Reveal>
            <Kicker n="01">The loop</Kicker>
            <h2 className="mt-5 max-w-[15ch] font-bold" style={h2}>
              Out as a brief. Back as a board.
            </h2>
            <p className="mt-6 max-w-[64ch] text-[17px] leading-[1.6]" style={{ fontFamily: PROSE, color: SOFT }}>
              Every whiteboard exports a picture, and a picture is the one thing a model cannot act
              on. Tuval writes the board out as the document it always was — frames become sections,
              reading order is kept, the arrows become a graph — and reads that document back onto a
              canvas when the work comes home.
            </p>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-12 grid items-stretch gap-3 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1.08fr)_auto_minmax(0,1fr)]">
              <div className={`${panel} h-[26rem]`} style={panelStyle}>
                <Head title="The board" note="drawn by four people" />
                <Plate
                  items={board}
                  className="min-h-0 flex-1"
                  alt="A board titled Search, rewritten, with four sticky notes and arrows between them"
                />
              </div>

              <Step label="boardToGraph()" />

              <div className={`${panel} h-[26rem]`} style={panelStyle}>
                <div className="flex items-center gap-1 border-b px-2 py-2" style={{ borderColor: 'rgba(20,19,16,0.1)' }}>
                  {(['brief', 'graph'] as const).map((one) => (
                    <button
                      key={one}
                      type="button"
                      onClick={() => setFace(one)}
                      className="rounded-md px-2.5 py-1 text-[11.5px] font-semibold transition-colors"
                      style={{
                        fontFamily: MONO,
                        background: face === one ? INK : 'transparent',
                        color: face === one ? PAPER : MUTED,
                      }}
                    >
                      {one === 'brief' ? 'brief.md' : 'graph.json'}
                    </button>
                  ))}
                  <span className="ml-auto">
                    <CopyButton body={face === 'brief' ? brief : json} />
                  </span>
                </div>
                <pre
                  className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 leading-[1.62]"
                  style={face === 'brief'
                    ? { fontFamily: PROSE, fontSize: 12.5, color: INK }
                    : { fontFamily: MONO, fontSize: 11, color: SOFT }}
                >
                  {face === 'brief' ? brief : json}
                </pre>
              </div>

              <Step label="briefToItems()" />

              <div className={`${panel} h-[26rem]`} style={panelStyle}>
                <Head title="The board, returned" note="read back from the text" />
                <Plate
                  items={returned}
                  className="min-h-0 flex-1"
                  alt="The same board, rebuilt on a canvas from the markdown brief"
                />
              </div>
            </div>
          </Reveal>

          <Reveal delay={140}>
            <div
              className="mt-8 grid gap-8 border-t pt-6 sm:grid-cols-2 sm:gap-14"
              style={{ borderColor: RULE }}
            >
              <p className="text-[13.5px] leading-[1.62]" style={{ fontFamily: PROSE, color: SOFT }}>
                Both directions are the product's own functions, running in this page, on the board
                on the left. <code style={{ fontFamily: MONO, fontSize: 12 }}>agent.ts</code> out,{' '}
                <code style={{ fontFamily: MONO, fontSize: 12 }}>importer.ts</code> back in. None of
                it is a mockup: press copy, paste it into whatever you use, and it will behave the
                same way it does here.
              </p>
              <p className="text-[13.5px] leading-[1.62]" style={{ fontFamily: PROSE, color: MUTED }}>
                The board that comes home is not the board that left. Colour and spacing are chosen
                fresh on the way back, because a brief carries thinking rather than pixels. That is
                the honest shape of a round trip, and it is the shape that survives an agent
                rewriting half the plan while you were at lunch.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* agents ---------------------------------------------------------- */}
      <section id="agents" className="py-20" style={{ background: INK, color: PAPER }}>
        <div className={shell}>
          <Reveal>
            <p
              className="flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.2em]"
              style={{ fontFamily: MONO, color: 'rgba(242,239,233,0.5)' }}
            >
              <span style={{ color: PIGMENT_LIT }}>02</span>
              <span aria-hidden className="h-px w-8" style={{ background: 'rgba(242,239,233,0.25)' }} />
              The other direction
            </p>

            <div className="mt-6 grid gap-10 lg:grid-cols-[minmax(0,1.04fr)_minmax(0,1fr)] lg:gap-16">
              <div>
                <h2 className="max-w-[14ch] font-bold" style={h2}>
                  Or let it come and look for itself.
                </h2>
                <p
                  className="mt-6 max-w-[55ch] text-[17px] leading-[1.6]"
                  style={{ fontFamily: PROSE, color: 'rgba(242,239,233,0.74)' }}
                >
                  Handing over a board is one move. The rest of the week, an agent should be able to
                  open the workspace the way you would: search it, read a page in full, list what is
                  still open in this cycle. Tuval ships a Model Context Protocol server, so Claude
                  Code, Cursor and anything else that speaks MCP mount it in one line.
                </p>

                <div
                  className="mt-8 overflow-hidden rounded-xl border"
                  style={{ borderColor: 'rgba(242,239,233,0.16)', background: 'rgba(242,239,233,0.045)' }}
                >
                  <Head
                    title="Terminal"
                    note="once, per machine"
                    tint
                    body={'claude mcp add tuval -- node scripts/mcp.mjs\nexport TUVAL_API_KEY=tuv_...'}
                  />
                  <pre className="overflow-x-auto px-4 py-3.5 text-[12.5px] leading-[1.9]" style={{ fontFamily: MONO }}>
                    <span style={{ color: 'rgba(242,239,233,0.4)' }}>$ </span>
                    claude mcp add tuval -- node scripts/mcp.mjs{'\n'}
                    <span style={{ color: 'rgba(242,239,233,0.4)' }}>$ </span>
                    export TUVAL_API_KEY=tuv_…
                    <span style={{ color: 'rgba(242,239,233,0.38)' }}>{'   # Settings → API and webhooks'}</span>
                    {'\n'}
                    <span style={{ color: '#9FC0A8' }}>✓ tuval</span>
                    <span style={{ color: 'rgba(242,239,233,0.55)' }}> connected · 4 tools</span>
                  </pre>
                </div>

                <p className="mt-5 max-w-[55ch] text-[13px] leading-[1.62]" style={{ fontFamily: PROSE, color: 'rgba(242,239,233,0.55)' }}>
                  One file of plain Node, and no SDK behind it. The protocol is four methods and a
                  JSON envelope; taking a dependency for that is taking on something to keep current
                  for nothing.
                </p>
              </div>

              <ul className="self-start overflow-hidden rounded-xl border" style={{ borderColor: 'rgba(242,239,233,0.16)' }}>
                {TOOLS.map(([name, what], at) => (
                  <li
                    key={name}
                    className="px-5 py-4"
                    style={{
                      background: 'rgba(242,239,233,0.035)',
                      borderTop: at ? '1px solid rgba(242,239,233,0.12)' : undefined,
                    }}
                  >
                    <p className="text-[13px] font-semibold" style={{ fontFamily: MONO, color: PIGMENT_LIT }}>
                      {name}
                    </p>
                    <p className="mt-1.5 text-[13.5px] leading-[1.55]" style={{ fontFamily: PROSE, color: 'rgba(242,239,233,0.7)' }}>
                      {what}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        </div>
      </section>

      {/* one record ------------------------------------------------------ */}
      <section id="record" className={`${shell} py-20`}>
        <Reveal>
          <Kicker n="03">One record</Kicker>
          <h2 className="mt-5 max-w-[19ch] font-bold" style={h2}>
            A sticky, a row and a ticket are the same object.
          </h2>
          <p className="mt-6 max-w-[64ch] text-[17px] leading-[1.6]" style={{ fontFamily: PROSE, color: SOFT }}>
            Not three products behind one login. Select a sticky, turn it into an issue, and it keeps
            its place on the board while it turns up in the sprint. Rename it in the table and the
            board already knows, because nothing was ever copied. It is also why the brief above is
            worth reading: an agent handed one board can see which parts of it are already tracked
            work, and who has them.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            <Face
              label="On the canvas"
              note="sticky"
              foot="Frames, connectors, tables, mind maps, pen, comments, live cursors, presentation mode."
            >
              <div className="grid h-[13.5rem] place-items-center" style={{ background: PAPER }}>
                <div
                  className="grid h-[9.5rem] w-[9.5rem] place-items-center px-4 text-center text-[16px] font-medium leading-[1.28]"
                  style={{
                    background: '#F0E3B0',
                    fontFamily: PROSE,
                    boxShadow: '3px 3px 0 rgba(20,19,16,0.1)',
                    transform: 'rotate(-1.4deg)',
                  }}
                >
                  Onboarding is too long
                </div>
              </div>
            </Face>

            <Face
              label="In a database"
              note="row"
              foot="Twenty column types, six views over them, formulas, rollups, relations, publishing and version history."
            >
              <div className="h-[13.5rem] overflow-hidden px-4 pt-3" style={{ background: SURFACE }}>
                <div
                  className="grid grid-cols-[minmax(0,1fr)_78px_44px] gap-2 border-b pb-2 text-[10px] font-semibold uppercase tracking-[0.1em]"
                  style={{ borderColor: HAIR, color: MUTED, fontFamily: MONO }}
                >
                  <span>Name</span><span>Status</span><span>Who</span>
                </div>
                {[
                  ['Onboarding is too long', 'In progress', 'FN', true],
                  ['Cut the second step', 'Todo', 'AY', false],
                  ['One-field sign-up', 'Todo', 'FN', false],
                  ['Nobody reads the tooltip', 'Done', 'AY', false],
                ].map(([name, status, who, on]) => (
                  <div
                    key={String(name)}
                    className="grid grid-cols-[minmax(0,1fr)_78px_44px] items-center gap-2 border-b py-2.5 text-[13px]"
                    style={{
                      borderColor: '#F0EDE6',
                      fontFamily: PROSE,
                      background: on ? '#F7E9E4' : undefined,
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    <span className="truncate">{name}</span>
                    <span className="truncate text-[11px]" style={{ color: MUTED }}>{status}</span>
                    <span className="text-[11px]" style={{ color: MUTED }}>{who}</span>
                  </div>
                ))}
              </div>
            </Face>

            <Face
              label="In the tracker"
              note="issue"
              foot="Keys, cycles, projects, estimates, labels, sub-issues, blocking relations, a board view and a burn-down."
            >
              <div className="h-[13.5rem] overflow-hidden" style={{ background: SURFACE }}>
                {[
                  ['TUV-1', 'Onboarding is too long', 'open', true],
                  ['TUV-2', 'Cut the second step', 'open', false],
                  ['TUV-3', 'One-field sign-up', 'open', false],
                  ['TUV-4', 'Nobody reads the tooltip', 'done', false],
                ].map(([key, title, state, on]) => (
                  <div
                    key={String(key)}
                    className="flex items-center gap-3 border-b px-4 py-[13px] text-[13px]"
                    style={{
                      borderColor: '#F0EDE6',
                      fontFamily: PROSE,
                      background: on ? '#F7E9E4' : undefined,
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                      style={{ background: state === 'done' ? '#8FA96B' : on ? PIGMENT : RULE }}
                    />
                    <span className="w-[46px] shrink-0 text-[10.5px] tabular-nums" style={{ fontFamily: MONO, color: '#B6B1A6' }}>
                      {key}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{title}</span>
                  </div>
                ))}
              </div>
            </Face>
          </div>
        </Reveal>
      </section>

      {/* import ---------------------------------------------------------- */}
      <section className="border-y py-20" style={{ background: WASH, borderColor: HAIR }}>
        <div className={shell}>
          <Reveal>
            <Kicker n="04">Bring it with you</Kicker>
            <h2 className="mt-5 max-w-[18ch] font-bold" style={h2}>
              Four years of Miro. Three of Notion. Nothing retyped.
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <div className="mt-11 grid gap-4 md:grid-cols-3">
              {SOURCES.map((one) => (
                <div key={one.head} className="rounded-2xl border p-5" style={panelStyle}>
                  <p className="text-[14px] font-bold">{one.head}</p>
                  <code
                    className="mt-3 block truncate rounded-md px-2.5 py-1.5 text-[11.5px]"
                    style={{ fontFamily: MONO, background: PAPER, color: SOFT }}
                  >
                    {one.code}
                  </code>
                  <p className="mt-4 text-[13.5px] leading-[1.6]" style={{ fontFamily: PROSE, color: SOFT }}>
                    {one.body}
                  </p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
      </section>

      {/* pricing --------------------------------------------------------- */}
      <section id="pricing" className={`${shell} py-20`}>
        <Reveal>
          <Kicker n="05">What it costs</Kicker>
          <h2 className="mt-5 max-w-[17ch] font-bold" style={h2}>
            Free for three. ₺249 a head after that.
          </h2>
          <p className="mt-6 max-w-[60ch] text-[17px] leading-[1.6]" style={{ fontFamily: PROSE, color: SOFT }}>
            One maintainer, in Turkey, with a Turkish cost of living. That is the entire reason this
            is about seven dollars instead of twenty, and it is a sturdier reason than a launch
            discount that expires.
          </p>
        </Reveal>

        <Reveal delay={80}>
          <div className="mt-11 grid gap-4 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.head}
                className="flex flex-col rounded-2xl border p-6"
                style={{
                  borderColor: plan.on ? INK : 'rgba(20,19,16,0.14)',
                  background: SURFACE,
                  boxShadow: plan.on ? '6px 6px 0 rgba(200,69,45,0.2)' : SHADOW,
                }}
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em]" style={{ fontFamily: MONO, color: MUTED }}>
                  {plan.head}
                </p>
                <p className="mt-5 text-[44px] font-bold leading-none tracking-[-0.03em]">{plan.price}</p>
                <p className="mt-2 text-[12.5px]" style={{ color: MUTED }}>{plan.unit}</p>
                <p className="mt-5 flex-1 text-[13.5px] leading-[1.6]" style={{ fontFamily: PROSE, color: SOFT }}>
                  {plan.body}
                </p>
                <a
                  href={plan.href}
                  className="mt-7 rounded-xl px-4 py-2.5 text-center text-[14px] font-semibold"
                  style={plan.on
                    ? { background: PIGMENT, color: PAPER, boxShadow: '3px 3px 0 #9E2F1B' }
                    : { border: '1px solid rgba(20,19,16,0.22)' }}
                >
                  {plan.cta}
                </a>
              </div>
            ))}
          </div>
        </Reveal>
      </section>

      {/* the unfinished list --------------------------------------------- */}
      <section className="border-y py-20" style={{ background: WASH, borderColor: HAIR }}>
        <div className={shell}>
          <Reveal>
            <Kicker n="06">The unfinished list</Kicker>
            <h2 className="mt-5 max-w-[19ch] font-bold" style={h2}>
              What this page is not going to pretend about.
            </h2>
          </Reveal>

          <Reveal delay={80}>
            <ul className="mt-11 grid gap-x-14 gap-y-8 md:grid-cols-2">
              {UNFINISHED.map(([head, body]) => (
                <li key={head} className="border-t pt-5" style={{ borderColor: RULE }}>
                  <p className="text-[16px] font-bold leading-[1.35] tracking-[-0.012em]">{head}</p>
                  <p className="mt-2.5 text-[14px] leading-[1.62]" style={{ fontFamily: PROSE, color: SOFT }}>
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </Reveal>
        </div>
      </section>

      {/* last word ------------------------------------------------------- */}
      <section className={`${shell} py-24 text-center`}>
        <Reveal>
          <h2
            className="mx-auto max-w-[15ch] font-bold"
            style={{ fontSize: 'clamp(2.4rem, 5.2vw, 4.2rem)', lineHeight: 0.96, letterSpacing: '-0.038em' }}
          >
            Draw the thing. Then hand it over.
          </h2>
          <p className="mx-auto mt-6 max-w-[50ch] text-[17px] leading-[1.6]" style={{ fontFamily: PROSE, color: SOFT }}>
            A board opens in this tab with nothing to sign and nothing stored anywhere until you say
            so. Press <kbd className="rounded border px-1.5 py-0.5 text-[13px]" style={{ fontFamily: MONO, borderColor: RULE }}>N</kbd> for a sticky.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a
              href="/dashboard"
              className="flex items-center gap-2 rounded-xl px-6 py-3.5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{ background: PIGMENT, color: PAPER, boxShadow: '3px 3px 0 #9E2F1B' }}
            >
              Open a board <ArrowRight size={16} />
            </a>
            <a
              href={REPO}
              className="flex items-center gap-2 rounded-xl border px-6 py-3.5 text-[15px] font-semibold transition-transform hover:-translate-y-0.5"
              style={{ borderColor: 'rgba(20,19,16,0.22)' }}
            >
              <GitBranch size={16} /> Read the source
            </a>
          </div>
        </Reveal>
      </section>

      <footer className="border-t" style={{ borderColor: HAIR }}>
        <div className={`${shell} flex flex-wrap items-center gap-x-6 gap-y-3 py-8 text-[12.5px]`} style={{ color: MUTED }}>
          <span className="flex items-center gap-2 font-semibold" style={{ color: INK }}>
            <span
              className="grid h-5 w-5 place-items-center rounded-[4px] text-[11px] font-bold"
              style={{ background: PIGMENT, color: PAPER }}
            >
              T
            </span>
            Tuval
          </span>
          <span style={{ fontFamily: MONO }}>AGPL-3.0</span>
          <a href={REPO} className="hover:opacity-70">Source</a>
          <a href="/self-hosting" className="hover:opacity-70">Self-hosting</a>
          <a href="/pricing" className="hover:opacity-70">Pricing</a>
          <span className="ml-auto">Made in Türkiye, on one machine.</span>
        </div>
      </footer>
    </div>
  )
}
