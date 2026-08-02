import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Copy, RotateCcw } from 'lucide-react'
import { boardToGraph, graphToMarkdown } from '../board/agent'
import { FONT } from '../board/brand'
import { fitRect } from '../board/camera'
import {
  connectorsFor, createItems, getItems, getMeta, patchItems, removeItems, setMeta, transact,
} from '../board/doc'
import {
  makeConnector, makeFrame, makeRecordItem, makeSticky, RECORD_H, RECORD_W, STICKY_SIZE,
} from '../board/items'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'
import type { Item } from '../board/types'
import { inEnglish } from '../i18n'
import { Canvas } from './Canvas'
import { TextEditor } from './TextEditor'

// The one thing this site has to prove ------------------------------------------------------------
// Every workspace claims its parts are joined up, so claiming it again is worth nothing. This does
// not claim it: one document, drawn by the product's own renderer, read at the same moment by a
// table, a sprint and a markdown brief. Nothing is copied between the panels because there is only
// one of it.
//
// One live canvas per page, and this is it: the renderer, the store and the Y.Doc are singletons,
// so a second mounted board would seed on top of this one.

type Card = Item & { type: 'record' }

const READING = { fontFamily: FONT.stack }

const FLOW = ['todo', 'doing', 'done'] as const
const TONE: { [k: string]: string } = { todo: '#8A867C', doing: '#DE9A4E', done: '#5E9A8A' }
const LABEL: { [k: string]: string } = { todo: 'To do', doing: 'In progress', done: 'Done' }

// Laid out from the sticky's own size rather than from numbers typed by eye.
const GAP = 44
const PAD = 60
const COLS = 2
const FRAME_TITLE = 'Retro, Tuesday'
const BOARD_SLUG = 'retro-tuesday'
const FIRST_KEY = 14

const NOTES: [string, string][] = [
  ['#F0E3B0', 'Sign-up asks for a company name nobody has yet'],
  ['#CBD79A', 'Drop the field, ask on the first invite'],
  ['#E7B7B4', 'Support re-explains self-hosting every single week'],
]

const STEP = STICKY_SIZE + GAP
const WIDE = COLS * STICKY_SIZE + (COLS - 1) * GAP
const TALL = 2 * STICKY_SIZE + GAP
const LEFT = -WIDE / 2
const TOP = -TALL / 2

const spot = (at: number) => [LEFT + (at % COLS) * STEP, TOP + Math.floor(at / COLS) * STEP]

// One row is already promoted, so the table and the sprint have something in them before anybody
// presses anything. An empty panel above the fold reads as a broken page, not as an invitation.
function seed() {
  const key = 'site:three-views'
  if (getMeta().siteSeed === key && getItems().length) return
  transact(() => {
    removeItems(getItems().map((item) => item.id))
    setMeta('siteSeed', key)
  })
  const frame = makeFrame(LEFT - PAD, TOP - PAD, WIDE + PAD * 2, TALL + PAD * 2, FRAME_TITLE)
  const notes = NOTES.map(([fill, text], at) => {
    const [x, y] = spot(at)
    const note = makeSticky(x, y, fill, text)
    note.parentId = frame.id
    return note
  })
  const [cx, cy] = spot(NOTES.length)
  const card = makeRecordItem(
    cx, cy + (STICKY_SIZE - RECORD_H) / 2,
    `TUV-${FIRST_KEY - 1}`, 'Write the one-page install and link it', 'doing',
  )
  card.parentId = frame.id
  const wire = (from: string, to: string) => makeConnector(
    { itemId: from, anchor: 'right', x: 0, y: 0 },
    { itemId: to, anchor: 'left', x: 0, y: 0 },
    {
      shape: 'curved', stroke: '#141310', strokeWidth: 2, strokeStyle: 'solid',
      capStart: 'none', capEnd: 'arrow',
    },
  )
  createItems([frame, ...notes, card, wire(notes[0].id, notes[1].id), wire(notes[2].id, card.id)])
  requestRender()
}

const SAID = ['none', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine']
const said = (n: number) => SAID[n] ?? String(n)

const readingOrder = (a: Item, b: Item) =>
  (Math.round(a.y / 40) - Math.round(b.y / 40)) || (a.x - b.x)

const Pane = ({ name, note, children }: {
  name: string
  note: string
  children: React.ReactNode
}) => (
  <div className="flex h-[26rem] flex-col overflow-hidden rounded-xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)] lg:h-[34rem]">
    <header className="flex shrink-0 items-baseline gap-3 border-b border-[#141310]/10 px-4 py-3">
      <span className="text-[10px] font-bold uppercase tracking-[0.16em]">{name}</span>
      <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#8A867C]">{note}</span>
    </header>
    {children}
  </div>
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

const BUTTON = 'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-[13.5px] font-semibold '
  + 'transition-[transform,background-color,box-shadow] duration-150 focus-visible:outline-2 '
  + 'focus-visible:outline-offset-2 focus-visible:outline-[#141310]'

export function ThreeViews() {
  const shell = useRef<HTMLDivElement>(null)
  const hot = useRef(false)
  const nextKey = useRef(FIRST_KEY)
  const [asBrief, setAsBrief] = useState(false)
  const [copied, setCopied] = useState(false)
  const items = useItems()
  const selection = useBoardStore((s) => s.selection)

  const cards = items.filter((i): i is Card => i.type === 'record').sort(readingOrder)
  const notes = items.filter((i) => i.type === 'sticky')
  const chosen = new Set(selection)

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

  // The canvas binds its shortcuts to the window, and space and the arrow keys are also the page's
  // scroll. They belong to whichever of the two the pointer is over.
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
  }

  const reset = () => {
    nextKey.current = FIRST_KEY
    transact(() => removeItems(getItems().map((i) => i.id)))
    useBoardStore.getState().setSelection([])
    seed()
    const el = shell.current
    if (!el) return
    useBoardStore.getState().setCamera(
      fitRect(boxOf(getItems()), el.clientWidth, el.clientHeight, 28),
    )
    requestRender()
  }

  // The app's own handoff button, running here on the board above. The brief goes through t(),
  // and this site is English whatever language the app is set to.
  const brief = asBrief
    ? inEnglish(() => graphToMarkdown(boardToGraph(items, BOARD_SLUG)))
    : ''

  const tab = (on: boolean) => `rounded-[5px] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
    on ? 'bg-[#141310] text-[#F2EFE9]' : 'text-[#8A867C] hover:bg-[#EBE7DE]'}`

  return (
    <div className="mx-auto max-w-[80rem] px-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,0.95fr)]">
        <div
          className="flex h-[30rem] flex-col overflow-hidden rounded-xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)] lg:h-[34rem]"
          onPointerEnter={() => { hot.current = true }}
          onPointerLeave={() => { hot.current = false }}
        >
          <header className="flex shrink-0 items-baseline gap-3 border-b border-[#141310]/10 px-4 py-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.16em]">Canvas</span>
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-[#8A867C]">
              {FRAME_TITLE} · {notes.length + cards.length} items
            </span>
          </header>
          <div ref={shell} className="relative min-h-0 flex-1 bg-[#F2EFE9]">
            <Canvas embedded />
            <TextEditor />
          </div>
          <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-[#141310]/10 px-3 py-2.5">
            {!!notes.length && (
              <button
                type="button"
                onClick={promote}
                className={`${BUTTON} bg-[#C8452D] text-[#F2EFE9] shadow-[2px_2px_0_#9E2F1B] hover:bg-[#A83621]`}
              >
                {chosen.size && notes.some((n) => chosen.has(n.id))
                  ? `Turn ${said(notes.filter((n) => chosen.has(n.id)).length)} into work`
                  : `Turn all ${said(notes.length)} into work`}
                <ArrowRight size={15} />
              </button>
            )}
            <button
              type="button"
              onClick={reset}
              className={`${BUTTON} ${notes.length
                ? 'border border-[#141310]/16 text-[#4A463E] hover:border-[#141310] hover:bg-[#F2EFE9]'
                : 'bg-[#141310] text-[#F2EFE9] shadow-[2px_2px_0_rgba(20,19,16,0.25)]'}`}
            >
              <RotateCcw size={14} /> {notes.length ? 'Reset' : 'Put the notes back'}
            </button>
            <span className="ml-auto pr-1 text-[11.5px] text-[#8A867C]">
              Drag anything. Nothing here is saved.
            </span>
          </footer>
        </div>

        <Pane name="Database" note="Type here — the board changes as you type">
          <div className="grid shrink-0 grid-cols-[1fr_auto] gap-3 border-b border-[#141310]/10 px-4 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
            <span>Title</span>
            <span>Status</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">
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
                    onChange={(e) => write(card, e.target.value, card.snapshot.status ?? 'todo')}
                    onFocus={() => pick(card.id)}
                    spellCheck={false}
                    aria-label="Record title"
                    className="w-full truncate rounded-[5px] bg-transparent px-2 py-1 text-[13.5px] outline-none focus:bg-[#F2EFE9] focus:ring-1 focus:ring-[#141310]/25"
                    style={READING}
                  />
                  <span className="block px-2 pt-0.5 text-[11px] text-[#B6B1A6]">
                    {card.recordId} · {FRAME_TITLE}
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
        </Pane>

        <div className="flex h-[26rem] flex-col overflow-hidden rounded-xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)] lg:h-[34rem]">
          <header className="flex shrink-0 items-center gap-1 border-b border-[#141310]/10 px-3 py-2">
            <button type="button" onClick={() => setAsBrief(false)} className={tab(!asBrief)}>
              Tracker
            </button>
            <button type="button" onClick={() => setAsBrief(true)} className={tab(asBrief)}>
              brief.md
            </button>
            {asBrief && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard.writeText(brief)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1600)
                }}
                className="ml-auto flex items-center gap-1 rounded-md px-1.5 py-1 text-[11.5px] font-semibold text-[#8A867C] hover:bg-[#EBE7DE] hover:text-[#141310]"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </header>

          {asBrief ? (
            <pre
              className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 font-mono text-[11px] leading-[1.6]"
            >{brief}</pre>
          ) : (
            <div className="min-h-0 flex-1 overflow-auto px-3 py-3">
              {FLOW.map((status) => {
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
          )}
        </div>
      </div>
    </div>
  )
}
