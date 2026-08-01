import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { PRODUCT } from '../board/brand'
import { PRICE } from '../board/plan'
import { fitRect } from '../board/camera'
import { createItems, getItems } from '../board/doc'
import { boxOf } from '../board/render'
import { makeConnector, makeFrame, makeSticky, makeText } from '../board/items'
import { go, goHome, newRoom, openBoard, touchBoard } from '../board/boards'
import { requestRender, useBoardStore } from '../board/store'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { DEFAULT_TEXT_STYLE } from '../board/types'
import { t } from '../i18n'
import { Canvas } from './Canvas'
import { TextEditor } from './TextEditor'
import { Connector, Nib, Select, Sticky } from './icons'
import { Wordmark } from './Logo'
import { Account } from './Account'

const REPO = 'https://github.com/namlifurkan/tuval'

// The hero is not a screenshot. It is the renderer, on a document that is never stored, seeded
// with something worth touching.
function seed() {
  if (getItems().length) return
  const frame = makeFrame(-514, -250, 1028, 500, t('Try me'))
  const a = makeSticky(-420, -150, '#F0E3B0', t('An idea lands here'))
  const b = makeSticky(-100, -150, '#7FA5BE', t('Drag me anywhere'))
  const c = makeSticky(220, -150, '#CBD79A', t('Double click to write'))
  const caption = makeText(-420, 120, 760, { ...DEFAULT_TEXT_STYLE, fontSize: 20 })
  caption.text = t('Nothing here is saved. Sign in and it is your board.')
  const wire = (from: string, to: string) => makeConnector(
    { itemId: from, anchor: 'right', x: 0, y: 0 },
    { itemId: to, anchor: 'left', x: 0, y: 0 },
    { shape: 'curved', stroke: '#141310', strokeWidth: 2, strokeStyle: 'solid', capStart: 'none', capEnd: 'arrow' },
  )
  createItems([frame, a, b, c, caption, wire(a.id, b.id), wire(b.id, c.id)])
  requestRender()
}

// The seeded board has to sit inside the hero, clear of the wall label that overlaps its
// left edge, so the camera is fitted once the element has a size.
function frameHero(el: HTMLElement) {
  const box = boxOf(getItems())
  if (!box.w) return
  const inset = Math.min(el.clientWidth * 0.34, 400)
  const cam = fitRect(box, el.clientWidth - inset, el.clientHeight - 40)
  useBoardStore.getState().setCamera({ ...cam, x: cam.x - inset / cam.z / 1.35 })
  requestRender()
}

const TOOLS = [
  { id: 'select', icon: Select, key: 'V' },
  { id: 'sticky', icon: Sticky, key: 'N' },
  { id: 'connector', icon: Connector, key: 'L' },
  { id: 'pen', icon: Nib, key: 'P' },
] as const

function HeroTools() {
  const tool = useBoardStore((s) => s.tool)
  const setTool = useBoardStore((s) => s.setTool)
  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-xl border border-[#E2DED5] bg-[#FCFBF8] p-1 shadow-[2px_2px_0_rgba(20,19,16,0.07)]">
      {TOOLS.map(({ id, icon: Icon, key }) => (
        <button
          key={id}
          type="button"
          title={`${t(id)} — ${key}`}
          onClick={() => { setTool(id); requestRender() }}
          className={`grid h-9 w-9 place-items-center rounded-lg transition-colors
            ${tool === id ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#141310] hover:bg-[#EAE6DD]'}`}
        >
          <Icon size={19} />
        </button>
      ))}
    </div>
  )
}

// Sections are drawn the way a frame is drawn on the canvas: a title tab in the wall-label
// voice, then the region it names.
function Section({ label, children, tint }: {
  label: string
  children: React.ReactNode
  tint?: boolean
}) {
  return (
    <section className="relative">
      <span className={`text-[11px] font-bold uppercase tracking-[0.14em] ${tint ? 'text-[#F2CEC4]' : 'text-[#C8452D]'}`}>
        {label}
      </span>
      <div className="mt-4">{children}</div>
    </section>
  )
}

const Spine = () => (
  <svg viewBox="0 0 40 120" preserveAspectRatio="none" aria-hidden className="mx-auto h-24 w-10 text-[#D6D1C6]">
    <path d="M20 0 C20 50, 6 62, 20 120" fill="none" stroke="currentColor" strokeWidth="1.5" />
    <circle cx="20" cy="118" r="2.5" fill="currentColor" />
  </svg>
)

// The front door still explains the product once you are signed in, so it has to offer the
// way through to your own work instead of asking you to sign in again.
function Visitor({ onOpen }: { onOpen: () => void }) {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)

  if (!cloudEnabled) {
    return (
      <button
        type="button"
        onClick={onOpen}
        className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
      >
        {t('Open a board')}
      </button>
    )
  }

  if (user) {
    return (
      <>
        <button
          type="button"
          onClick={goHome}
          className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
        >
          {t('Your boards')}
        </button>
        <Account />
      </>
    )
  }

  return (
    <button
      type="button"
      onClick={() => go('/login')}
      className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
    >
      {t('Sign in')}
    </button>
  )
}

export function Landing() {
  const [touched, setTouched] = useState(false)
  const hero = useRef<HTMLDivElement>(null)

  useEffect(() => {
    seed()
    const el = hero.current
    if (!el) return
    const fit = () => frameHero(el)
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const openScratch = () => {
    const room = newRoom()
    touchBoard(room, { name: '', opened: Date.now() })
    openBoard(room)
  }

  return (
    <div className="h-dvh overflow-y-auto bg-[#F2EFE9] text-[#141310]">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-[#E2DED5] bg-[#F2EFE9]/92 px-5 py-3 backdrop-blur-[2px] sm:px-8">
        <Wordmark height={18} />
        <span className="ml-1 hidden text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C] sm:inline">
          {t('Open source workspace')}
        </span>
        <a
          href={REPO}
          target="_blank"
          rel="noreferrer"
          className="ml-auto rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#141310] transition-colors hover:bg-[#EAE6DD]"
        >
          GitHub
        </a>
        <Visitor onOpen={openScratch} />
      </header>

      <div
        ref={hero}
        onPointerDown={() => setTouched(true)}
        className="relative h-[min(74vh,640px)] w-full border-b border-[#E2DED5]"
      >
        <Canvas embedded />
        <TextEditor />

        <div className="pointer-events-none absolute inset-0 flex flex-col justify-between p-5 sm:p-8">
          <div className="pointer-events-auto max-w-[38ch] rounded-xl border border-[#E2DED5] bg-[#FCFBF8]/95 p-5 shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#C8452D]">
              {PRODUCT.name}
            </span>
            <h1 className="mt-2 text-[clamp(1.75rem,4.2vw,2.75rem)] font-bold leading-[1.05] tracking-[-0.02em]">
              {t('The board, the page')}<br />
              {t('and the work. One record.')}
            </h1>
            <p className="mt-3 max-w-[34ch] text-[13px] leading-relaxed text-[#4A463E]">
              {t('This is the real editor, not a picture of one. Move something.')}
            </p>
          </div>

          <div className="flex items-end justify-between gap-3">
            <HeroTools />
            <span
              className={`rounded-md bg-[#141310] px-2 py-1 text-[11px] font-semibold text-[#F2EFE9] transition-opacity duration-500
                ${touched ? 'opacity-0' : 'opacity-100'}`}
            >
              {t('Drag a sticky')}
            </span>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-[860px] px-6 pb-28 pt-14 sm:px-10">
        <Section label={t('What is in it')}>
          <h2 className="max-w-[24ch] text-[clamp(1.375rem,3vw,1.875rem)] font-bold leading-[1.12] tracking-[-0.015em]">
            {t('Three tools most companies pay for separately.')}
          </h2>
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
            {t('Not three products behind one login. One record model underneath, so a sticky on a board, a row in a database and an issue in a cycle can be the same thing seen from three sides.')}
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ['Infinite canvas', 'Stickies, frames, connectors, drawings, tables, code blocks, embeds. Templates, presenting, comments, version history.'],
              ['Pages and databases', 'A block editor with columns, callouts, equations and comments. Databases in six views, eighteen column types, formulas and rollups.'],
              ['Issues and projects', 'Numbered issues, estimates, cycles with a burn line, sub-issues, blocking, labels, projects on a roadmap. Keyboard first.'],
            ].map(([title, body]) => (
              <div key={title} className="rounded-xl border border-[#E2DED5] bg-[#FCFBF8] p-4">
                <span className="text-[13px] font-semibold text-[#141310]">{t(title)}</span>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#4A463E]">{t(body)}</p>
              </div>
            ))}
          </div>
        </Section>

        <Spine />

        <Section label={t('What is different')}>
          <div className="rounded-2xl bg-[#C8452D] p-7 text-[#FBEDE9] sm:p-10">
            <h2 className="max-w-[20ch] text-[clamp(1.5rem,3.4vw,2.25rem)] font-bold leading-[1.1] tracking-[-0.015em] text-white">
              {t('Hand the board to an agent.')}
            </h2>
            <p className="mt-4 max-w-[58ch] text-sm leading-relaxed">
              {t('Exporting a whiteboard usually means a PNG. A picture is useless to a coding agent. Tuval reduces the board to a semantic graph instead: frames become sections, connectors become directed edges, comments attach to the nearest item, code blocks stay fenced code. Spatial layout is resolved into reading order, so what comes out is a brief, not a screenshot.')}
            </p>
            <p className="mt-4 max-w-[58ch] text-sm leading-relaxed">
              {t('It works the other way too. Paste an agent’s Markdown back and headings become frames, bullets become stickies, a mermaid flow becomes connectors.')}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 font-mono text-[11px]">
              {['prompt', 'markdown', 'json'].map((f) => (
                <span key={f} className="rounded-md border border-white/25 px-2 py-1">{f}</span>
              ))}
            </div>
          </div>
        </Section>

        <Spine />

        <Section label={t('The rest of the week')}>
          <h2 className="max-w-[26ch] text-[clamp(1.375rem,3vw,1.875rem)] font-bold leading-[1.12] tracking-[-0.015em]">
            {t('The small things a week is actually made of.')}
          </h2>
          <dl className="mt-5 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
            {[
              ['Forms', 'A database with one side turned outwards. An answer becomes a row — in the table, on the board, on the calendar, the moment it arrives.'],
              ['Booking', 'Your hours on a page anybody can open. A booking becomes an event in the workspace like any other record.'],
              ['Time', 'Hours logged against issues, and a week read back from them. Nothing is typed twice.'],
              ['Repeating work', 'The standup note, the invoice, the backup check. Made on a schedule, caught up if a night is missed.'],
              ['API and webhooks', 'The plan here is to integrate rather than clone. n8n for automation, Gmail for mail, Forgejo for git — this is what they talk to.'],
              ['Import', 'A Notion export, a Miro board, a folder of Markdown, a spreadsheet. Out again as Markdown, HTML, PDF or PNG.'],
            ].map(([term, body]) => (
              <div key={term} className="grid gap-1 py-4 sm:grid-cols-[9rem_1fr] sm:gap-6">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">{t(term)}</dt>
                <dd className="max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">{t(body)}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Spine />

        <Section label={t('Where it runs')}>
          <h2 className="max-w-[24ch] text-[clamp(1.375rem,3vw,1.875rem)] font-bold leading-[1.12] tracking-[-0.015em]">
            {t('On your own server, or on nobody’s.')}
          </h2>
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
            {t('Tuval is local-first. The document is a CRDT in your browser and it keeps working with the network unplugged. Add Supabase and boards leave the browser: accounts, sharing by email or email domain, roles enforced in the database rather than in the interface, live collaboration over a channel that carries the same access rules.')}
          </p>
          <div className="mt-6 overflow-x-auto rounded-xl border border-[#E2DED5] bg-[#FCFBF8] p-4">
            <pre className="font-mono text-xs leading-relaxed text-[#4A463E]">
{`git clone ${REPO}
npm install && npm run dev`}
            </pre>
          </div>
        </Section>

        <Spine />

        <Section label={t('How it is built')}>
          <h2 className="max-w-[24ch] text-[clamp(1.375rem,3vw,1.875rem)] font-bold leading-[1.12] tracking-[-0.015em]">
            {t('One canvas, one document, no magic.')}
          </h2>
          <dl className="mt-5 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
            {[
              ['Rendering', 'A single <canvas> with a dirty-flag animation loop. DOM overlays only where they earn it: text editing, embeds, popovers.'],
              ['Document', 'Yjs CRDT. IndexedDB locally, a merged snapshot in Postgres, live updates over a private realtime channel.'],
              ['Access', 'Row level security decides who reads and who writes. The interface follows the database, never the other way round.'],
              ['Licence', 'AGPL-3.0-or-later. Run it, change it, host it. Ship a modified version as a service and you owe your users the source.'],
            ].map(([term, body]) => (
              <div key={term} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-6">
                <dt className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">{t(term)}</dt>
                <dd className="max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">{t(body)}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Spine />

        <Section label={t('What it costs')}>
          <h2 className="max-w-[26ch] text-[clamp(1.375rem,3vw,1.875rem)] font-bold leading-[1.12] tracking-[-0.015em]">
            {t('Free to run yourself. Priced only when we run it.')}
          </h2>
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
            {t('Nothing is held back to make a plan look thin. Every feature is on every plan, including the one you host. What the hosted price covers is the part that actually costs money: the disks, the bandwidth and the answering.')}
          </p>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              {
                name: t('Self-hosted'),
                price: t('nothing, forever'),
                lines: ['Everything, with no limits', 'Your machine, your data', 'AGPL-3.0-or-later'],
              },
              {
                name: t('Free'),
                price: t('nothing'),
                lines: ['Up to 3 people', '1 GB of files', 'Every board, page, database and issue'],
              },
              {
                name: t('Team'),
                price: `${PRICE.amount}${PRICE.currency} / ${t('member')} / ${t('month')}`,
                lines: ['As many people as you like', '10 GB of files each', 'The API and webhooks'],
                lit: true,
              },
            ].map((plan) => (
              <div
                key={plan.name}
                className={`rounded-xl border p-4
                  ${plan.lit ? 'border-[#C8452D] bg-[#F7E9E4]' : 'border-[#E2DED5] bg-[#FCFBF8]'}`}
              >
                <span className="block text-[13px] font-semibold text-[#141310]">{plan.name}</span>
                <span className="mt-0.5 block text-[12px] text-[#8A867C]">{plan.price}</span>
                <ul className="mt-3 space-y-1">
                  {plan.lines.map((line) => (
                    <li key={line} className="text-[12px] leading-snug text-[#4A463E]">{t(line)}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <p className="mt-4 max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">
            {t('Reaching a limit refuses the next person or the next file. It never deletes what is already there.')}
          </p>
        </Section>

        <div className="mt-14 flex flex-wrap items-center gap-3">
          <a
            href={REPO}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-[#141310] px-4 py-2.5 text-sm font-semibold text-[#F2EFE9] transition-colors hover:bg-[#000]"
          >
            {t('Read the source')}
          </a>
          <button
            type="button"
            onClick={openScratch}
            className="rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-4 py-2.5 text-sm font-semibold text-[#141310] transition-colors hover:border-[#C8452D] hover:text-[#C8452D]"
          >
            {t('Open a board')}
          </button>
          <span className="text-xs text-[#8A867C]">{t('No account needed to try it.')}</span>
        </div>
      </main>
    </div>
  )
}
