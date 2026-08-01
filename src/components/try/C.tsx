import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, RotateCcw } from 'lucide-react'
import { PRODUCT } from '../../board/brand'
import { fitRect } from '../../board/camera'
import { connectorsFor, createItems, getItems, patchItems, removeItems, transact } from '../../board/doc'
import {
  makeConnector, makeFrame, makeRecordItem, makeSticky, RECORD_H, RECORD_W, STICKY_SIZE,
} from '../../board/items'
import { boxOf } from '../../board/render'
import { requestRender, useBoardStore } from '../../board/store'
import { useItems } from '../../board/useBoard'
import type { Item } from '../../board/types'
import { Canvas } from '../Canvas'
import { TextEditor } from '../TextEditor'

type Card = Item & { type: 'record' }

const DISPLAY = { fontFamily: '"Instrument Serif", "Iowan Old Style", Georgia, serif' }
const READING = { fontFamily: '"Instrument Sans", system-ui, sans-serif' }

const FLOW = ['todo', 'doing', 'done'] as const
const TONE: { [k: string]: string } = { todo: '#8A867C', doing: '#DE9A4E', done: '#5E9A8A' }
const LABEL: { [k: string]: string } = { todo: 'To do', doing: 'In progress', done: 'Done' }

const GAP = 44
const PAD = 60
const COLS = 2
const FRAME_TITLE = 'Retro, Tuesday'

const NOTES: [string, string][] = [
  ['#F0E3B0', 'Sign-up asks for a company name nobody has yet'],
  ['#CBD79A', 'Drop the field, ask on the first invite'],
  ['#E7B7B4', 'Support re-explains self-hosting every single week'],
  ['#7FA5BE', 'Write the one-page install and link it'],
]

const STEP = STICKY_SIZE + GAP
const ROWS = Math.ceil(NOTES.length / COLS)
const WIDE = COLS * STICKY_SIZE + (COLS - 1) * GAP
const TALL = ROWS * STICKY_SIZE + (ROWS - 1) * GAP
const LEFT = -WIDE / 2
const TOP = -TALL / 2

function seed() {
  if (getItems().length) return
  const frame = makeFrame(LEFT - PAD, TOP - PAD, WIDE + PAD * 2, TALL + PAD * 2, FRAME_TITLE)
  const notes = NOTES.map(([fill, text], at) => {
    const note = makeSticky(
      LEFT + (at % COLS) * STEP,
      TOP + Math.floor(at / COLS) * STEP,
      fill, text,
    )
    note.parentId = frame.id
    return note
  })
  const wire = (from: string, to: string) => makeConnector(
    { itemId: from, anchor: 'right', x: 0, y: 0 },
    { itemId: to, anchor: 'left', x: 0, y: 0 },
    {
      shape: 'curved', stroke: '#141310', strokeWidth: 2, strokeStyle: 'solid',
      capStart: 'none', capEnd: 'arrow',
    },
  )
  createItems([frame, ...notes, wire(notes[0].id, notes[1].id), wire(notes[2].id, notes[3].id)])
  requestRender()
}

function wipe() {
  const all = getItems()
  if (all.length) removeItems(all.map((i) => i.id))
  useBoardStore.getState().setSelection([])
}

const SAID = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const said = (n: number) => SAID[n] ?? String(n)

const readingOrder = (a: Item, b: Item) =>
  (Math.round(a.y / 40) - Math.round(b.y / 40)) || (a.x - b.x)

const Rule = ({ label }: { label: string }) => (
  <div className="flex items-center gap-4 pb-8">
    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A867C]">{label}</span>
    <span className="h-px flex-1 bg-[#141310]/12" />
  </div>
)

const PaneHead = ({ name, note }: { name: string; note: string }) => (
  <header className="flex shrink-0 items-baseline gap-3 border-b border-[#141310]/10 px-4 py-3">
    <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{name}</span>
    <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#8A867C]">{note}</span>
  </header>
)

const Dot = ({ status, onClick }: { status: string; onClick: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    title={`${LABEL[status]} — click to move it on`}
    className="grid h-6 w-6 shrink-0 place-items-center rounded-[5px] hover:bg-[#EBE7DE]"
  >
    <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TONE[status] }} />
  </button>
)

export default function TryC() {
  const shell = useRef<HTMLDivElement>(null)
  const hot = useRef(false)
  const nextKey = useRef(14)
  const [did, setDid] = useState<string[]>([])
  const items = useItems()
  const selection = useBoardStore((s) => s.selection)

  const mark = (step: string) => setDid((was) => (was.includes(step) ? was : [...was, step]))

  const cards = items.filter((i): i is Card => i.type === 'record').sort(readingOrder)
  const notes = items.filter((i) => i.type === 'sticky')
  const chosen = new Set(selection)
  const homeOf = (parentId: string | null) => {
    const frame = items.find((i) => i.id === parentId)
    return frame && frame.type === 'frame' ? frame.title : 'Loose on the canvas'
  }

  useEffect(() => {
    document.title = 'Tuval — the sticky note is the ticket'
    document.querySelector('meta[name="description"]')?.setAttribute('content',
      'An open source workspace where a canvas, your pages and your issue tracker are three views '
      + 'of one record. Try it on this page: promote a sticky note and watch it turn up in the '
      + 'table and the sprint. AGPL-3.0, self-hostable, free for three people.')

    if (!document.getElementById('try-c-face')) {
      const link = document.createElement('link')
      link.id = 'try-c-face'
      link.rel = 'stylesheet'
      link.href = 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap'
      document.head.appendChild(link)
    }
  }, [])

  useEffect(() => {
    seed()
    const el = shell.current
    if (!el) return
    const fit = () => {
      const box = boxOf(getItems())
      if (!box.w) return
      useBoardStore.getState().setCamera(fitRect(box, el.clientWidth, el.clientHeight, 28))
      requestRender()
    }
    fit()
    const soon = window.setTimeout(fit, 90)
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => { window.clearTimeout(soon); watch.disconnect() }
  }, [])

  // A card on the canvas opens the issue it stands for, which on a marketing page would walk the
  // visitor out of the demo and into a workspace they do not have. Held here, not in the product.
  useEffect(() => {
    const el = shell.current
    if (!el) return
    const swallow = (e: MouseEvent) => {
      const box = el.getBoundingClientRect()
      const cam = useBoardStore.getState().camera
      const bx = (e.clientX - box.left) / cam.z + cam.x
      const by = (e.clientY - box.top) / cam.z + cam.y
      const over = getItems().some((i) => i.type === 'record'
        && bx >= i.x && bx <= i.x + i.w && by >= i.y && by <= i.y + i.h)
      if (over) { e.preventDefault(); e.stopPropagation() }
    }
    el.addEventListener('dblclick', swallow, true)
    return () => el.removeEventListener('dblclick', swallow, true)
  }, [])

  // The canvas binds its shortcuts to the window, and space and the arrow keys are also the
  // page's scroll. They belong to whichever of the two the pointer is over.
  useEffect(() => {
    const guard = (e: KeyboardEvent) => {
      const at = e.target
      const typing = at instanceof HTMLElement
        && (at.tagName === 'INPUT' || at.tagName === 'TEXTAREA' || at.isContentEditable)
      if (typing || hot.current) return
      e.stopPropagation()
    }
    window.addEventListener('keydown', guard, true)
    window.addEventListener('keyup', guard, true)
    return () => {
      window.removeEventListener('keydown', guard, true)
      window.removeEventListener('keyup', guard, true)
    }
  }, [])

  useEffect(() => {
    if (selection.some((id) => items.find((i) => i.id === id)?.type === 'sticky')) {
      setDid((was) => (was.includes('pick') ? was : [...was, 'pick']))
    }
  }, [selection, items])

  // What promoteToIssue does, minus the row it writes: the card takes the note's place and the
  // arrow lands on the card, because where you drew it was part of the thought. Done locally
  // because a real record needs a workspace and a visitor has none.
  const promote = () => {
    const taking = notes.filter((n) => (chosen.size ? chosen.has(n.id) : true)).sort(readingOrder)
    if (!taking.length) return

    const made: Item[] = []
    for (const note of taking) {
      const title = ('text' in note ? note.text : '').trim() || 'Untitled'
      const card = makeRecordItem(note.x, note.y, `TUV-${nextKey.current++}`, title, 'todo')
      card.w = Math.max(note.w, RECORD_W)
      card.h = RECORD_H
      card.parentId = note.parentId
      made.push(card)
    }

    const moved = new Map(taking.map((n, at) => [n.id, made[at].id]))
    const rewired: [string, Record<string, unknown>][] = []
    for (const line of connectorsFor(new Set(moved.keys()))) {
      if (line.type !== 'connector') continue
      const from = moved.get(line.from.itemId ?? '')
      const to = moved.get(line.to.itemId ?? '')
      if (!from && !to) continue
      rewired.push([line.id, {
        ...(from ? { from: { ...line.from, itemId: from } } : {}),
        ...(to ? { to: { ...line.to, itemId: to } } : {}),
      }])
    }

    transact(() => {
      createItems(made)
      if (rewired.length) patchItems(rewired)
      removeItems(taking.map((n) => n.id))
    })
    useBoardStore.getState().setSelection(made.map((i) => i.id))
    requestRender()
    setDid((was) => [...new Set([...was, 'pick', 'promote'])])
  }

  const write = (card: Card, title: string, status: string) => {
    patchItems([[card.id, { snapshot: { title, status } }]])
    requestRender()
  }

  const pick = (id: string) => {
    useBoardStore.getState().setSelection([id])
    requestRender()
  }

  const onwards = (card: Card) => {
    const now = FLOW.indexOf((card.snapshot.status ?? 'todo') as (typeof FLOW)[number])
    write(card, card.snapshot.title, FLOW[(now + 1) % FLOW.length])
    pick(card.id)
    mark('move')
  }

  const reset = () => {
    nextKey.current = 14
    wipe()
    seed()
    setDid([])
    const el = shell.current
    if (!el) return
    useBoardStore.getState().setCamera(
      fitRect(boxOf(getItems()), el.clientWidth, el.clientHeight, 28),
    )
    requestRender()
  }

  const steps: [string, string][] = [
    ['pick', 'Click a note'],
    ['promote', 'Turn it into work'],
    ['rename', 'Rename it in the table'],
    ['move', 'Move it in the tracker'],
  ]
  const at = steps.findIndex(([key]) => !did.includes(key))
  const hint = [
    'Click a note on the canvas. Or skip it and take all four at once.',
    'Press the red button. The note keeps its place and its arrow.',
    'Now edit a title in the table, and watch the card on the canvas.',
    'Now move one along in the tracker, and watch the other two panels.',
  ][at] ?? 'That is the whole product, in four clicks.'

  const picked = notes.filter((n) => chosen.has(n.id)).length

  const button = 'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold '
    + 'transition-[transform,background-color,box-shadow] duration-150 focus-visible:outline-2 '
    + 'focus-visible:outline-offset-2 focus-visible:outline-[#141310]'

  return (
    <div className="min-h-screen bg-[#F2EFE9] text-[#141310] antialiased">
      <header className="sticky top-0 z-30 border-b border-[#141310]/10 bg-[#F2EFE9]/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-[88rem] items-center gap-8 px-6">
          <a href="/" className="flex items-center gap-2.5">
            <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-[#141310] text-[12px] font-bold text-[#F2EFE9]">
              {PRODUCT.mark}
            </span>
            <span className="text-[15px] font-bold tracking-[-0.02em]">{PRODUCT.name}</span>
          </a>
          <nav className="hidden items-center gap-6 text-[13.5px] text-[#4A463E] md:flex">
            <a href="/canvas" className="hover:text-[#141310]">Canvas</a>
            <a href="/docs" className="hover:text-[#141310]">Pages &amp; databases</a>
            <a href="/issues" className="hover:text-[#141310]">Issues</a>
            <a href="/self-hosting" className="hover:text-[#141310]">Self-hosting</a>
            <a href="/pricing" className="hover:text-[#141310]">Pricing</a>
          </nav>
          <div className="ml-auto flex items-center gap-4">
            <a href={PRODUCT.repo} className="hidden text-[13.5px] text-[#4A463E] hover:text-[#141310] sm:block">
              Source
            </a>
            <a
              href="/dashboard"
              className={`${button} bg-[#C8452D] text-[#F2EFE9] shadow-[2px_2px_0_#9E2F1B] hover:bg-[#A83621]`}
            >
              Start a board
            </a>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-[88rem] px-6 pt-14 pb-8">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C8452D]">
            Open source workspace · AGPL-3.0 · runs on your own machine
          </p>
          <div className="mt-6 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
            <h1
              className="text-[clamp(2.9rem,6.4vw,5.4rem)] leading-[0.92] tracking-[-0.015em]"
              style={DISPLAY}
            >
              The sticky note <em className="text-[#C8452D]">is</em> the ticket.
            </h1>
            <p className="text-[16.5px] leading-[1.5] text-[#4A463E]" style={READING}>
              Not a copy of it. Not a link to it. One record — drawn on a canvas, listed in a table,
              worked in a sprint. Everything under this line is live. Give it four clicks and you
              will not need the paragraph.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-6 pb-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
            <div
              className="flex h-[30rem] flex-col overflow-hidden rounded-xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)] lg:h-[34rem]"
              onPointerEnter={() => { hot.current = true }}
              onPointerLeave={() => { hot.current = false }}
            >
              <PaneHead name="Canvas" note={`${FRAME_TITLE} · ${notes.length + cards.length} items`} />
              <div ref={shell} className="relative min-h-0 flex-1 bg-[#F2EFE9]">
                <Canvas embedded />
                <TextEditor />
              </div>
              <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#141310]/10 px-3 py-2.5">
                {!!notes.length && (
                  <button
                    type="button"
                    onClick={promote}
                    className={`${button} bg-[#C8452D] text-[#F2EFE9] shadow-[2px_2px_0_#9E2F1B] hover:bg-[#A83621]`}
                  >
                    {picked
                      ? `Turn ${said(picked)} into work`
                      : `Turn all ${said(notes.length)} into work`}
                    <ArrowRight size={15} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={reset}
                  className={`${button} ${notes.length
                    ? 'border border-[#141310]/16 text-[#4A463E] hover:border-[#141310] hover:bg-[#F2EFE9]'
                    : 'bg-[#141310] text-[#F2EFE9] shadow-[2px_2px_0_rgba(20,19,16,0.25)]'}`}
                >
                  <RotateCcw size={14} /> {notes.length ? 'Reset' : 'Put the notes back'}
                </button>
                <span className="ml-auto pr-1 text-[11.5px] text-[#8A867C]">
                  {notes.length
                    ? 'Drag anything. Nothing is saved.'
                    : 'Every card is where its note was. Drag one.'}
                </span>
              </footer>
            </div>

            <div className="flex h-[26rem] flex-col overflow-hidden rounded-xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)] lg:h-[34rem]">
              <PaneHead name="Database" note={`Sprint 24 · ${cards.length} rows`} />
              <div className="grid shrink-0 grid-cols-[1fr_auto] gap-3 border-b border-[#141310]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
                <span>Title</span>
                <span>Status</span>
              </div>
              <div className="min-h-0 flex-1 overflow-auto">
                {!cards.length && (
                  <p className="px-4 py-5 text-[13px] leading-relaxed text-[#8A867C]" style={READING}>
                    Empty, because nothing has been promoted yet. Press the red button under the
                    canvas and these rows write themselves.
                  </p>
                )}
                {cards.map((card) => (
                  <div
                    key={card.id}
                    onPointerDown={() => pick(card.id)}
                    className={`grid grid-cols-[1fr_auto] items-center gap-2 border-b border-[#141310]/8 px-2 py-2 last:border-0 ${
                      chosen.has(card.id) ? 'bg-[#F7E9E4]' : 'hover:bg-[#F2EFE9]'}`}
                  >
                    <div className="min-w-0">
                      <input
                        value={card.snapshot.title}
                        onChange={(e) => {
                          write(card, e.target.value, card.snapshot.status ?? 'todo')
                          mark('rename')
                        }}
                        onFocus={() => pick(card.id)}
                        spellCheck={false}
                        aria-label="Record title"
                        className="w-full truncate rounded-[5px] bg-transparent px-2 py-1 text-[13.5px] outline-none focus:bg-[#F2EFE9] focus:ring-1 focus:ring-[#141310]/25"
                        style={READING}
                      />
                      <span className="block px-2 pt-0.5 text-[11px] text-[#B6B1A6]">
                        {card.recordId} · {homeOf(card.parentId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 pr-2">
                      <Dot status={card.snapshot.status ?? 'todo'} onClick={() => onwards(card)} />
                      <span className="w-[72px] text-[11.5px] text-[#8A867C]">
                        {LABEL[card.snapshot.status ?? 'todo']}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex h-[26rem] flex-col overflow-hidden rounded-xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)] lg:h-[34rem]">
              <PaneHead name="Tracker" note="Sprint 24 · click a card to move it on" />
              <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
                {!cards.length && (
                  <p className="px-1 py-2 text-[13px] leading-relaxed text-[#8A867C]" style={READING}>
                    Empty for the same reason. A sprint is a view over those rows, not a second
                    place to keep them.
                  </p>
                )}
                {!!cards.length && FLOW.map((status) => {
                  const here = cards.filter((c) => (c.snapshot.status ?? 'todo') === status)
                  return (
                    <div key={status} className="mb-4 last:mb-0">
                      <div className="flex items-center gap-2 px-1 pb-1.5">
                        <span className="h-2 w-2 rounded-[3px]" style={{ background: TONE[status] }} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.14em]">
                          {LABEL[status]}
                        </span>
                        <span className="text-[11px] text-[#B6B1A6]">{here.length}</span>
                      </div>
                      {here.map((card) => (
                        <button
                          key={card.id}
                          type="button"
                          onClick={() => onwards(card)}
                          className={`mb-1.5 block w-full rounded-lg border px-3 py-2 text-left last:mb-0 ${
                            chosen.has(card.id)
                              ? 'border-[#141310] bg-[#F7E9E4]'
                              : 'border-[#141310]/12 hover:border-[#141310]/40'}`}
                        >
                          <span className="block font-mono text-[10.5px] text-[#B6B1A6]">
                            {card.recordId}
                          </span>
                          <span className="mt-0.5 block text-[13px] leading-snug" style={READING}>
                            {card.snapshot.title}
                          </span>
                        </button>
                      ))}
                      {!here.length && (
                        <div className="rounded-lg border border-dashed border-[#141310]/12 px-3 py-2 text-[11.5px] text-[#B6B1A6]">
                          Nothing here
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-[88rem] px-6 pb-16">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            {steps.map(([key, label], n) => {
              const done = did.includes(key)
              return (
                <span key={key} className="flex items-center gap-2">
                  <span
                    className={`flex items-center gap-2 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold ${
                      done
                        ? 'border-[#141310]/12 bg-[#FCFBF8] text-[#8A867C]'
                        : n === at
                          ? 'border-[#C8452D] bg-[#F7E9E4] text-[#C8452D]'
                          : 'border-[#141310]/12 text-[#B6B1A6]'}`}
                  >
                    {done
                      ? <Check size={13} />
                      : <span className="font-mono text-[11px]">{n + 1}</span>}
                    {label}
                  </span>
                  {n < steps.length - 1 && <span className="h-px w-4 bg-[#141310]/15" />}
                </span>
              )
            })}
            <span className="ml-2 text-[13px] text-[#4A463E]" style={READING}>{hint}</span>
          </div>

          <p className="mt-7 max-w-[72ch] text-[14.5px] leading-[1.6] text-[#4A463E]" style={READING}>
            The left panel is the product's own renderer, drawing a real document. The two beside it
            read that same document. Nothing was copied between them, because there was only ever
            one of it — and that is the whole argument for putting three tools in one place.
          </p>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <a
              href="/dashboard"
              className={`${button} bg-[#141310] px-5 py-3 text-[14px] text-[#F2EFE9] shadow-[3px_3px_0_rgba(20,19,16,0.22)] hover:-translate-y-0.5`}
            >
              Start a board — free for three people <ArrowRight size={15} />
            </a>
            <a
              href={PRODUCT.repo}
              className={`${button} border border-[#141310]/20 px-5 py-3 text-[14px] hover:border-[#141310] hover:bg-[#FCFBF8]`}
            >
              Read the source
            </a>
            <span className="text-[12.5px] text-[#8A867C]">No card, no trial clock.</span>
          </div>
        </section>

        <section className="border-t border-[#141310]/12 bg-[#EBE7DE]">
          <div className="mx-auto max-w-[88rem] px-6 py-16">
            <Rule label="The three views, in full" />
            <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
              {[
                {
                  head: 'Canvas',
                  lede: 'A surface with no edges and no lag.',
                  href: '/canvas',
                  list: [
                    'Frames, connectors, sticky notes, pen, shapes, tables, mind maps',
                    'Images, PDFs placed page by page, live embeds, code blocks',
                    'Presentation mode, comments, live cursors, version history',
                    'Templates, plus importers for an existing board or a Notion export',
                  ],
                },
                {
                  head: 'Pages and databases',
                  lede: 'Where the same records get written down.',
                  href: '/docs',
                  list: [
                    'Block editor, nested pages, mentions, backlinks, an inbox',
                    'Databases with twenty column types, formulas, rollups, relations',
                    'Table, board, list, gallery, calendar and timeline views',
                    'Publish a page to the web, or keep it behind the login',
                  ],
                },
                {
                  head: 'Tracker',
                  lede: 'The work, with keys on it.',
                  href: '/issues',
                  list: [
                    'Issues with keys, cycles, projects, estimates and labels',
                    'Sub-issues, blocking relations, a board view and a burn-down',
                    'Promote a note or a paragraph into an issue where it stands',
                    'A card on a canvas points at the row it came from and refreshes from it',
                  ],
                },
              ].map((col) => (
                <div key={col.head}>
                  <h2 className="text-[28px] leading-[1.1]" style={DISPLAY}>{col.head}</h2>
                  <p className="mt-1 text-[14px] text-[#8A867C]" style={READING}>{col.lede}</p>
                  <ul className="mt-5">
                    {col.list.map((line) => (
                      <li
                        key={line}
                        className="border-t border-[#141310]/12 py-2.5 text-[13.5px] leading-[1.45] text-[#4A463E]"
                        style={READING}
                      >
                        {line}
                      </li>
                    ))}
                  </ul>
                  <a
                    href={col.href}
                    className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#C8452D] hover:underline hover:underline-offset-4"
                  >
                    More on {col.head.toLowerCase()} <ArrowRight size={13} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-[#141310]/12">
          <div className="mx-auto max-w-[88rem] px-6 py-16">
            <Rule label="What it costs" />
            <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
              <div>
                <h2 className="text-[clamp(1.9rem,3.2vw,2.9rem)] leading-[1.02]" style={DISPLAY}>
                  One tool. One line on the invoice.
                </h2>
                <p className="mt-4 max-w-[34ch] text-[14px] leading-[1.6] text-[#4A463E]" style={READING}>
                  Priced for a team that was paying three separate bills for the same afternoon's
                  work.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    name: 'Small',
                    price: 'Free',
                    unit: 'up to three people',
                    list: ['Every board, page, database and issue', 'Hosted, backed up, updated', 'The API and webhooks are the paid part'],
                  },
                  {
                    name: 'Team',
                    price: '₺249',
                    unit: 'per member, per month, VAT included',
                    list: ['Around $7 a head', 'Unlimited boards, pages and issues', 'Cancel from the settings page'],
                    lead: true,
                  },
                  {
                    name: 'Your server',
                    price: 'Free',
                    unit: 'AGPL-3.0, for good',
                    list: ['A Postgres and a bucket', 'Your disks, your backups', 'No seat count, no phone-home'],
                  },
                ].map((tier) => (
                  <div
                    key={tier.name}
                    className={`flex flex-col rounded-xl border bg-[#FCFBF8] p-5 ${
                      tier.lead
                        ? 'border-[#141310] shadow-[5px_5px_0_rgba(20,19,16,0.10)]'
                        : 'border-[#141310]/12'}`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A867C]">
                      {tier.name}
                    </span>
                    <span className="mt-3 text-[40px] leading-none" style={DISPLAY}>{tier.price}</span>
                    <span className="mt-2 text-[12.5px] leading-snug text-[#8A867C]">{tier.unit}</span>
                    <ul className="mt-4 space-y-2 text-[13px] leading-snug text-[#4A463E]" style={READING}>
                      {tier.list.map((line) => (
                        <li key={line} className="flex gap-2">
                          <Check size={14} className="mt-[3px] shrink-0 text-[#C8452D]" />
                          <span>{line}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-[#141310]/12 bg-[#EBE7DE]">
          <div className="mx-auto max-w-[88rem] px-6 py-16">
            <Rule label="What is not finished" />
            <div className="grid gap-10 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
              <div>
                <h2 className="text-[clamp(1.9rem,3.2vw,2.9rem)] leading-[1.02]" style={DISPLAY}>
                  Written by one person, in Turkey.
                </h2>
                <p className="mt-4 max-w-[34ch] text-[14px] leading-[1.6] text-[#4A463E]" style={READING}>
                  So here is the list a sales page leaves out. Better you find out now than after
                  you have moved a team across.
                </p>
              </div>
              <ul className="grid gap-x-10 gap-y-7 sm:grid-cols-2">
                {[
                  ['Live editing is unproven', 'The synchronisation is written and the channel is private, checked by the same policies as the board. It has never once been run with two people in the room. Try it and tell me where it breaks.'],
                  ['No phone layout, deliberately', 'An infinite canvas on a six-inch screen is a worse product, not a smaller one. The effort goes into the desk instead.'],
                  ['Embeds sit on top', 'A live embed is a real iframe over the canvas, so an item stacked above one still draws behind it. A still preview will fix it.'],
                  ['The repository opens shortly', 'The licence is already AGPL-3.0 and the code goes public in days, not months. Self-hosting instructions land with it.'],
                ].map(([head, body]) => (
                  <li key={head} className="border-t border-[#141310]/15 pt-3">
                    <h3 className="text-[14px] font-bold tracking-[-0.01em]">{head}</h3>
                    <p className="mt-1.5 text-[13.5px] leading-[1.5] text-[#4A463E]" style={READING}>
                      {body}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="border-t border-[#141310]/12">
          <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-6 px-6 py-14">
            <h2 className="text-[clamp(1.8rem,3vw,2.7rem)] leading-[1.05]" style={DISPLAY}>
              Draw it once. Ship it from the same place.
            </h2>
            <a
              href="/dashboard"
              className={`${button} ml-auto bg-[#C8452D] px-5 py-3 text-[14px] text-[#F2EFE9] shadow-[3px_3px_0_#9E2F1B] hover:bg-[#A83621]`}
            >
              Start a board <ArrowRight size={15} />
            </a>
          </div>
        </section>
      </main>

      <footer className="bg-[#141310] text-[#EBE7DE]">
        <div className="mx-auto flex max-w-[88rem] flex-wrap items-center gap-x-8 gap-y-4 px-6 py-8 text-[13px]">
          <span className="flex items-center gap-2.5 font-bold tracking-[-0.02em] text-[#F2EFE9]">
            <span className="grid h-6 w-6 place-items-center rounded-[5px] bg-[#C8452D] text-[12px] text-[#F2EFE9]">
              {PRODUCT.mark}
            </span>
            {PRODUCT.name}
          </span>
          <a href="/canvas" className="text-[#C6C2B6] hover:text-[#F2EFE9]">Canvas</a>
          <a href="/docs" className="text-[#C6C2B6] hover:text-[#F2EFE9]">Pages and databases</a>
          <a href="/issues" className="text-[#C6C2B6] hover:text-[#F2EFE9]">Issues</a>
          <a href="/self-hosting" className="text-[#C6C2B6] hover:text-[#F2EFE9]">Self-hosting</a>
          <a href="/pricing" className="text-[#C6C2B6] hover:text-[#F2EFE9]">Pricing</a>
          <a href={PRODUCT.repo} className="text-[#C6C2B6] hover:text-[#F2EFE9]">Source</a>
          <span className="ml-auto text-[#8A867C]">AGPL-3.0 · self-hostable · nothing tracked here</span>
        </div>
      </footer>
    </div>
  )
}
