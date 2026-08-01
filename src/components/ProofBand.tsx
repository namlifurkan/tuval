import { useEffect, useRef, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { boardToGraph, graphToMarkdown } from '../board/agent'
import { inEnglish } from '../i18n'
import { fitRect } from '../board/camera'
import { connectorsFor, createItems, getItems, patchItems, removeItems, transact } from '../board/doc'
import {
  makeConnector, makeFrame, makeRecordItem, makeSticky, RECORD_H, RECORD_W, STICKY_SIZE,
} from '../board/items'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import type { Item } from '../board/types'
import { Canvas } from './Canvas'
import { TextEditor } from './TextEditor'

// The one thing this site has to prove -----------------------------------------------------------
// Every workspace claims its parts are joined up. Saying it again is worth nothing, so this does
// not say it: one board, and three buttons that turn it into the three things it already is.
//
// Two of the three run the production code: graphToMarkdown(boardToGraph(items)) is the function
// behind the app's own handoff button, and the graph below it is that function's own first step.
// The third is done here rather than through promoteToIssue, because writing a record needs a
// workspace and a visitor has none. The page says which is which rather than implying otherwise.

type Shown = 'none' | 'issues' | 'agent' | 'mcp'

// Laid out from the sticky's own size rather than from numbers typed by eye. Written by hand
// they overlapped each other by forty-eight pixels and hung a hundred out of the bottom of the
// frame, which is what a retro drawn by somebody who has never used the product looks like.
const GAP = 40
const PAD = 56
const COLS = 3

const SEED: [string, string][] = [
  ['#F0E3B0', 'Onboarding is too long'],
  ['#7FA5BE', 'Cut the second step'],
  ['#CBD79A', 'Ship a one-field sign-up'],
  ['#E7B7B4', 'Nobody reads the tooltip'],
  ['#CBD79A', 'Move it into the empty state'],
]

const STEP = STICKY_SIZE + GAP
const ROWS = Math.ceil(SEED.length / COLS)
const WIDE = COLS * STICKY_SIZE + (COLS - 1) * GAP
const TALL = ROWS * STICKY_SIZE + (ROWS - 1) * GAP
const LEFT = -WIDE / 2
const TOP = -TALL / 2

function seed() {
  if (getItems().length) return
  const frame = makeFrame(
    LEFT - PAD, TOP - PAD, WIDE + PAD * 2, TALL + PAD * 2, 'Retro, this morning',
  )
  const notes = SEED.map(([fill, text], at) => makeSticky(
    LEFT + (at % COLS) * STEP,
    TOP + Math.floor(at / COLS) * STEP,
    fill, text,
  ))
  const wire = (from: string, to: string) => makeConnector(
    { itemId: from, anchor: 'right', x: 0, y: 0 },
    { itemId: to, anchor: 'left', x: 0, y: 0 },
    { shape: 'curved', stroke: '#141310', strokeWidth: 2, strokeStyle: 'solid', capStart: 'none', capEnd: 'arrow' },
  )
  createItems([
    frame, ...notes,
    wire(notes[0].id, notes[1].id),
    wire(notes[1].id, notes[2].id),
    wire(notes[3].id, notes[4].id),
  ])
  requestRender()
}

const still = () => typeof matchMedia === 'function'
  && matchMedia('(prefers-reduced-motion: reduce)').matches

// Typed out rather than pasted in, because watching a brief assemble itself from a board is the
// argument. Instant when somebody has asked for less motion.
function useTyped(text: string, on: boolean) {
  const [shown, setShown] = useState('')
  useEffect(() => {
    if (!on || !text) { setShown(''); return }
    if (still()) { setShown(text); return }
    let at = 0
    const tick = window.setInterval(() => {
      at = Math.min(text.length, at + 14)
      setShown(text.slice(0, at))
      if (at >= text.length) window.clearInterval(tick)
    }, 16)
    return () => window.clearInterval(tick)
  }, [text, on])
  return shown
}

function Panel({ title, note, body, mono }: {
  title: string
  note: string
  body: string
  mono?: boolean
}) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)]">
      <div className="flex items-baseline gap-3 border-b border-[#141310]/10 px-4 py-3">
        <span className="text-[13px] font-bold tracking-[-0.01em]">{title}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-[#8A867C]">{note}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(body)
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}
          className="flex shrink-0 items-center gap-1 rounded-md px-1.5 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EFEBE2] hover:text-[#141310]"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre
        className={`min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-[12.5px] leading-[1.62] text-[#141310] ${
          mono ? 'font-mono text-[11.5px]' : ''}`}
        style={mono ? undefined : { fontFamily: '"Instrument Sans", system-ui, sans-serif' }}
      >{body}</pre>
    </div>
  )
}

export function ProofBand() {
  const shell = useRef<HTMLDivElement>(null)
  const [shown, setShown] = useState<Shown>('none')
  const [made, setMade] = useState<{ key: string; title: string }[]>([])
  const [brief, setBrief] = useState('')

  useEffect(() => {
    seed()
    const el = shell.current
    if (!el) return
    const fit = () => {
      const box = boxOf(getItems())
      if (!box.w) return
      useBoardStore.getState().setCamera(fitRect(box, el.clientWidth, el.clientHeight, 40))
      requestRender()
    }
    fit()
    const soon = setTimeout(fit, 80)
    const watch = new ResizeObserver(fit)
    watch.observe(el)
    return () => { clearTimeout(soon); watch.disconnect() }
  }, [shown])

  // The same move promoteToIssue makes: the card takes the sticky's place, because where you put
  // it was part of the thought. Local, since writing a record needs a workspace and a visitor has
  // no account.
  const turn = () => {
    // Read in the order the eye reads them, not the order the document happens to hold them, so
    // TUV-1 is the note at the top left.
    const notes = getItems().filter((i) => i.type === 'sticky')
      .sort((a, b) => (Math.round(a.y / 40) - Math.round(b.y / 40)) || (a.x - b.x))
    if (!notes.length) { setShown('issues'); return }
    const cards: Item[] = []
    const rows: { key: string; title: string }[] = []
    notes.forEach((note, at) => {
      const title = ('text' in note ? note.text : '') || 'Untitled'
      const card = makeRecordItem(note.x, note.y, `demo-${at}`, title, 'todo', '#FCFBF8')
      card.w = Math.max(note.w, RECORD_W)
      card.h = RECORD_H
      card.parentId = note.parentId
      cards.push(card)
      rows.push({ key: `TUV-${at + 1}`, title })
    })
    // The arrows were part of the thinking, so they land on the cards rather than going with the
    // stickies. Same move the product makes.
    const moved = new Map(notes.map((n, at) => [n.id, cards[at].id]))
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
      createItems(cards)
      if (rewired.length) patchItems(rewired)
      removeItems(notes.map((n) => n.id))
    })
    setMade(rows)
    requestRender()
    setShown('issues')
  }

  // The brief goes through t(), and this site is English whatever language the app is set to.
  const handOff = () => {
    setBrief(inEnglish(() => graphToMarkdown(boardToGraph(getItems(), 'retro-this-morning'))))
    setShown('agent')
  }

  // The graph itself, which is the thing an agent ends up holding. An earlier version of this
  // panel hand-wrote a plausible-looking tool call and captioned it "what Cursor sees", which was
  // a drawing of the answer rather than the answer. This is boardToGraph's real output.
  const readBack = () => {
    setBrief(JSON.stringify(inEnglish(() => boardToGraph(getItems(), 'retro-this-morning')), null, 2))
    setShown('mcp')
  }

  const typed = useTyped(brief, shown === 'agent' || shown === 'mcp')

  const key = (on: boolean) =>
    `rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-[transform,box-shadow,background-color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310] ${
      on
        ? 'bg-[#C8452D] text-[#F2EFE9] shadow-[2px_2px_0_#9E2F1B]'
        : 'border border-[#141310]/20 hover:-translate-y-0.5 hover:border-[#141310] hover:bg-[#F2EFE9]'}`

  return (
    <section className="bg-[#EBE7DE] py-14">
      <div className="mx-auto max-w-[80rem] px-6">
        <div className={`grid gap-5 ${shown === 'none' ? '' : 'lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]'}`}>
          <div
            ref={shell}
            className="relative h-[clamp(22rem,54vh,34rem)] overflow-hidden rounded-2xl border border-[#141310]/12 bg-[#F2EFE9] shadow-[5px_5px_0_rgba(20,19,16,0.07)]"
          >
            <Canvas />
            <TextEditor />
          </div>

          {shown === 'issues' && (
            <div className="flex h-full min-h-0 flex-col rounded-2xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)]">
              <div className="border-b border-[#141310]/10 px-4 py-3">
                <span className="text-[13px] font-bold tracking-[-0.01em]">Issues</span>
                <span className="ml-3 text-[12px] text-[#8A867C]">the same five, now with keys</span>
              </div>
              <ul className="min-h-0 flex-1 overflow-auto">
                {made.map((row) => (
                  <li key={row.key} className="flex items-center gap-3 border-b border-[#141310]/6 px-4 py-2.5 last:border-0">
                    <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px] bg-[#D6D1C6]" />
                    <span className="w-[58px] shrink-0 font-mono text-[11px] tabular-nums text-[#B6B1A6]">{row.key}</span>
                    <span className="min-w-0 flex-1 truncate text-[14px]">{row.title}</span>
                    <span className="shrink-0 text-[11px] uppercase tracking-wide text-[#8A867C]">todo</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {shown === 'agent' && (
            <Panel
              title="The brief"
              note="written from the board on the left"
              body={typed}
            />
          )}

          {shown === 'mcp' && (
            <Panel
              title="The graph"
              note="what an agent holds after reading this board"
              body={typed}
              mono
            />
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-2.5">
          <button type="button" onClick={turn} className={key(shown === 'issues')}>
            Turn into issues
          </button>
          <button type="button" onClick={handOff} className={key(shown === 'agent')}>
            Hand it to an agent
          </button>
          <button type="button" onClick={readBack} className={key(shown === 'mcp')}>
            Read it back
          </button>
          <p className="ml-auto max-w-[46ch] text-[12.5px] leading-snug text-[#8A867C]">
            The brief and the graph are the product's own functions, run on the board above.
            Turning stickies into issues is done here rather than in a workspace, because you do
            not have one yet.
          </p>
        </div>
      </div>
    </section>
  )
}
