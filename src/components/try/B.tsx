import { useEffect, useRef, useState } from 'react'
import { ArrowUpRight, Check, Minus } from 'lucide-react'
import { PRODUCT } from '../../board/brand'
import { COMPUTED, FIELD_TYPES } from '../../board/database'
import { BoardPicture } from '../BoardPicture'
import { ProofBand } from '../ProofBand'

const INK = '#141310'
const INK_SOFT = '#4A463E'
const MUTED = '#8A867C'
const PAPER = '#F2EFE9'
const SURFACE = '#FCFBF8'
const WASH = '#EBE7DE'
const HAIRLINE = '#E2DED5'
const PIGMENT = '#C8452D'
const DEEP = '#9E2F1B'

const SERIF = '"Instrument Serif", "Iowan Old Style", Georgia, serif'
const READ = '"Instrument Sans", system-ui, sans-serif'

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&display=swap'

const SHELL = 'mx-auto w-full max-w-[84rem] px-6 lg:px-10'

function useDisplayFont() {
  useEffect(() => {
    if (document.querySelector(`link[href="${FONT_HREF}"]`)) return
    const tag = document.createElement('link')
    tag.rel = 'stylesheet'
    tag.href = FONT_HREF
    document.head.appendChild(tag)
  }, [])
}

function useReveal(root: React.RefObject<HTMLElement | null>) {
  useEffect(() => {
    const host = root.current
    if (!host) return
    const marks = [...host.querySelectorAll<HTMLElement>('[data-reveal],[data-arrive]')]
    if (typeof IntersectionObserver !== 'function') {
      marks.forEach((el) => el.classList.add('seen'))
      return
    }
    const watch = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue
        entry.target.classList.add('seen')
        watch.unobserve(entry.target)
      }
    }, { rootMargin: '0px 0px 14% 0px', threshold: 0 })
    marks.forEach((el) => watch.observe(el))
    return () => watch.disconnect()
  }, [root])
}

function Kicker({ children, tone = MUTED }: { children: React.ReactNode; tone?: string }) {
  return (
    <p
      className="text-[11px] font-bold uppercase leading-none tracking-[0.19em]"
      style={{ color: tone }}
    >
      {children}
    </p>
  )
}

function Display({ children, className = '', as: As = 'h2' }: {
  children: React.ReactNode
  className?: string
  as?: 'h1' | 'h2' | 'h3' | 'p'
}) {
  return (
    <As className={`tracking-[-0.025em] ${className}`} style={{ fontFamily: SERIF, fontWeight: 400 }}>
      {children}
    </As>
  )
}

function Reading({ children, className = '', style }: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return <p className={className} style={{ fontFamily: READ, ...style }}>{children}</p>
}

function Rule({ tone = HAIRLINE }: { tone?: string }) {
  return <div aria-hidden className="h-px w-full" style={{ background: tone }} />
}

function Action({ href, children, primary = false, external = false }: {
  href: string
  children: React.ReactNode
  primary?: boolean
  external?: boolean
}) {
  return (
    <a
      href={href}
      {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
      className={`inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 ${
        primary ? 'shadow-[3px_3px_0_#7C2314] hover:shadow-[4px_5px_0_#7C2314]' : ''
      }`}
      style={primary
        ? { background: PIGMENT, color: PAPER, outlineColor: INK }
        : { border: `1px solid ${INK}33`, color: INK, outlineColor: INK }}
    >
      {children}
      {external ? <ArrowUpRight size={15} /> : null}
    </a>
  )
}

function Mark() {
  return (
    <span className="flex items-center gap-2.5">
      <span
        className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
        style={{ background: INK, color: PAPER }}
      >
        {PRODUCT.mark}
      </span>
      <span className="text-[16px] font-bold tracking-[-0.02em]">{PRODUCT.name}</span>
    </span>
  )
}

function Nav() {
  const links: [string, string][] = [
    ['/canvas', 'Canvas'],
    ['/docs', 'Pages'],
    ['/issues', 'Issues'],
    ['/self-hosting', 'Self-hosting'],
    ['/pricing', 'Pricing'],
  ]
  return (
    <header
      className="sticky top-0 z-30 backdrop-blur-[3px]"
      style={{ background: 'rgba(242,239,233,0.88)', borderBottom: `1px solid ${HAIRLINE}` }}
    >
      <div className={`${SHELL} flex h-16 items-center gap-8`}>
        <a href="/" aria-label={PRODUCT.name}><Mark /></a>
        <nav className="hidden items-center gap-6 md:flex">
          {links.map(([href, label]) => (
            <a
              key={href}
              href={href}
              className="text-[13.5px] font-medium transition-colors hover:text-[#141310]"
              style={{ color: INK_SOFT }}
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-4">
          <a
            href={PRODUCT.repo}
            target="_blank"
            rel="noreferrer"
            className="hidden text-[13.5px] font-medium sm:inline"
            style={{ color: INK_SOFT }}
          >
            Source
          </a>
          <a
            href="/dashboard"
            className="rounded-lg px-3.5 py-2 text-[13.5px] font-semibold"
            style={{ background: INK, color: PAPER }}
          >
            Open a board
          </a>
        </div>
      </div>
    </header>
  )
}

const STATUS: { name: string; note: string; ok: boolean }[] = [
  { name: 'Notion', note: 'Reads the export as it arrives, nested zips and all', ok: true },
  { name: 'Miro', note: 'Pulled through their API with a token that stays in your shell', ok: true },
  { name: 'Linear', note: 'No importer. You would be retyping the backlog', ok: false },
]

function Hero() {
  return (
    <section className="pb-16 pt-16 lg:pb-24 lg:pt-24">
      <div className={`${SHELL} grid gap-12 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:gap-16`}>
        <div>
          <div data-reveal style={{ '--step': 0 } as React.CSSProperties}>
            <Kicker>AGPL-3.0 · Free for three · ₺249 a member if we host it</Kicker>
          </div>

          <Display as="h1" className="mt-7 text-[clamp(3.4rem,8.6vw,7.4rem)] leading-[0.9]">
            <span data-reveal style={{ '--step': 1 } as React.CSSProperties} className="block">
              Leaving is
            </span>
            <span data-reveal style={{ '--step': 2 } as React.CSSProperties} className="block">
              the feature.
            </span>
          </Display>

          <div data-reveal style={{ '--step': 3 } as React.CSSProperties}>
            <Reading
              className="mt-8 max-w-[54ch] text-[clamp(1.05rem,1.45vw,1.3rem)] leading-[1.55]"
              style={{ color: INK_SOFT }}
            >
              You pay three companies to hold one workspace — the boards in one, the pages in
              another, the tickets in a third — and each of them owns the door. Tuval reads a
              Notion export whole and pulls a Miro board through their API. Then it hands the lot
              back to you in one file that goes back in, under a licence nobody can withdraw.
              Including us.
            </Reading>
          </div>

          <div
            data-reveal
            style={{ '--step': 4 } as React.CSSProperties}
            className="mt-9 flex flex-wrap items-center gap-3"
          >
            <Action href="/dashboard" primary>Open a board — nothing to sign</Action>
            <Action href={PRODUCT.repo} external>Read the source</Action>
          </div>
        </div>

        <aside data-reveal style={{ '--step': 5 } as React.CSSProperties} className="self-start">
          <div
            className="rounded-2xl"
            style={{
              background: SURFACE,
              border: `1px solid ${INK}1f`,
              boxShadow: '4px 4px 0 rgba(20,19,16,0.07)',
            }}
          >
            <div className="px-5 pb-4 pt-5">
              <Kicker>Migration status</Kicker>
            </div>
            <Rule />
            {STATUS.map((row) => (
              <div key={row.name}>
                <div className="flex items-start gap-3 px-5 py-4">
                  <span
                    aria-hidden
                    className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-[5px]"
                    style={{
                      background: row.ok ? '#E2EBE7' : '#EFEBE2',
                      color: row.ok ? '#3F7A69' : MUTED,
                    }}
                  >
                    {row.ok ? <Check size={12} /> : <Minus size={12} />}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[14px] font-bold tracking-[-0.01em]">{row.name}</span>
                    <span
                      className="mt-1 block text-[13px] leading-[1.45]"
                      style={{ fontFamily: READ, color: MUTED }}
                    >
                      {row.note}
                    </span>
                  </span>
                </div>
                <Rule />
              </div>
            ))}
            <p className="px-5 py-4 text-[12.5px] leading-[1.5]" style={{ fontFamily: READ, color: MUTED }}>
              Two of the three come across. The third is the honest reason some teams should not
              switch yet, and it is on the first screen rather than in a footnote.
            </p>
          </div>
        </aside>
      </div>
    </section>
  )
}

type Lane = 'notion' | 'miro' | 'linear'

const MANIFEST: {
  [K in Lane]: { label: string; lede: string; across: string[]; behind: string[]; footnote: string }
} = {
  notion: {
    label: 'Notion',
    lede: 'Hand it the export. Not a tidied-up version of the export — the file Notion actually gives you, including the multi-part zip a large workspace arrives as.',
    across: [
      'The zip, and the zips inside the zip. Part-1.zip and Part-2.zip unpack without you touching them.',
      'The folder tree becomes the page tree. A page inside a folder ends up inside the page that folder was.',
      'Markdown becomes real blocks: headings, lists, toggles, callouts, quotes, highlighted code, tables and multi-column layouts.',
      'Every CSV becomes a database with typed columns — the type read off the whole column rather than the first cell, so one number in a column of names stays a name.',
      'Dates, numbers and checkboxes arrive as dates, numbers and checkboxes. A column of repeated values arrives as a select with its choices already made and coloured.',
      'The first column of a Notion CSV is the row title, so it lands as the row title instead of as a stray column called Name.',
      'Two columns with the same name get renumbered instead of quietly overwriting each other.',
    ],
    behind: [
      'Files you uploaded to Notion. The export links to their servers, and we do not go and fetch them.',
      'Anything past three hundred files in one run. The screen tells you the number it skipped rather than pretending it finished.',
      'Synced blocks and links to one specific block, which have no equivalent here.',
    ],
    footnote: 'Nothing in the importer is Notion-specific past that shape, so a hand-made folder of .md and .csv files imports exactly as well. Which is also, one day, how you would leave.',
  },
  miro: {
    label: 'Miro',
    lede: 'A board comes across their REST API. You paste a token into your own shell and run a script from this repository; the token never reaches us, because there is no server of ours in the path.',
    across: [
      'Sticky notes with their text and their colour, matched onto the nearest of our sixteen pigments.',
      'Frames, with their children put back inside them even though the export lists a child before the frame it belongs to.',
      'Twenty-five of their shape kinds mapped by name — rhombus to diamond, can to cylinder, and the whole flowchart set: decision, terminator, document, manual input, display, delay.',
      'Connectors last, once both ends exist, carrying their label, their colour and their width.',
      'Text items, images, documents and previews. Cards and app cards land as stickies.',
    ],
    behind: [
      'Any object we have no shape for. The importer counts what it dropped, by type, and shows you the tally instead of a green tick.',
      'Comments, tags, votes, timers and everything from their app marketplace.',
      'A connector whose two endpoints did not both survive — counted, not silently straightened out.',
    ],
    footnote: 'This is the importer that ends a subscription outright, which is why it was written before anything decorative was.',
  },
  linear: {
    label: 'Linear',
    lede: 'Nothing comes across. There is no importer, and this is the hardest thing about moving to Tuval.',
    across: [
      'Nothing. A CSV of your issues lands in a database, and a database is a table, not a tracker: no keys, no cycles, no burn-down.',
    ],
    behind: [
      'Your issue history, and the keys written into a thousand commit messages.',
      'Your cycles, your saved views and your custom workflow states. Ours are a fixed seven and you cannot rename them.',
      'Branch and pull-request linking. We do not talk to GitHub at all.',
    ],
    footnote: 'So do not move your tracker yet. Move the whiteboard, move the wiki, keep paying for the tracker, and come back when there is an importer worth the word. A migration page that hides this is how a migration falls over on the second Monday.',
  },
}

function Manifest() {
  const [lane, setLane] = useState<Lane>('notion')
  const shown = MANIFEST[lane]

  return (
    <section className="py-24" style={{ background: WASH }}>
      <div className={SHELL}>
        <div data-reveal className="max-w-[46ch]">
          <Kicker>The manifest</Kicker>
          <Display className="mt-5 text-balance text-[clamp(2.1rem,4.4vw,3.6rem)] leading-[1.02]">
            What actually crosses
          </Display>
          <Reading className="mt-5 text-[16.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
            Every product with a migration page says one click. Here is the same claim with the
            parts that do not work left in, written off the importers rather than off a meeting
            about them.
          </Reading>
        </div>

        <div data-reveal className="mt-10 flex flex-wrap gap-2">
          {(Object.keys(MANIFEST) as Lane[]).map((one) => {
            const on = one === lane
            return (
              <button
                key={one}
                type="button"
                onClick={() => setLane(one)}
                className="rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-[background-color,color] duration-150 focus-visible:outline-2 focus-visible:outline-offset-2"
                style={on
                  ? { background: INK, color: PAPER, outlineColor: INK }
                  : { border: `1px solid ${INK}26`, color: INK_SOFT, outlineColor: INK }}
              >
                Leaving {MANIFEST[one].label}
              </button>
            )
          })}
        </div>

        <div
          className="mt-6 rounded-2xl"
          style={{
            background: SURFACE,
            border: `1px solid ${INK}1a`,
            boxShadow: '5px 5px 0 rgba(20,19,16,0.06)',
          }}
        >
          <div className="px-6 py-7 lg:px-9 lg:py-9">
            <Reading className="max-w-[68ch] text-[17px] leading-[1.55]" style={{ color: INK }}>
              {shown.lede}
            </Reading>
          </div>
          <Rule />
          <div className="grid lg:grid-cols-2">
            <div
              className="px-6 py-7 lg:px-9 lg:py-9"
              style={{ borderRight: `1px solid ${HAIRLINE}` }}
            >
              <Kicker tone={INK}>Comes across</Kicker>
              <ul className="mt-5">
                {shown.across.map((line, at) => (
                  <li
                    key={line}
                    className="flex gap-4 py-3.5"
                    style={{ borderTop: at ? `1px solid ${HAIRLINE}` : undefined }}
                  >
                    <span
                      className="w-6 shrink-0 pt-1 text-[11px] font-bold tabular-nums"
                      style={{ color: PIGMENT }}
                    >
                      {String(at + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[14.5px] leading-[1.55]" style={{ fontFamily: READ, color: INK }}>
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="px-6 py-7 lg:px-9 lg:py-9">
              <Kicker>Stays behind</Kicker>
              <ul className="mt-5">
                {shown.behind.map((line, at) => (
                  <li
                    key={line}
                    className="flex gap-4 py-3.5"
                    style={{ borderTop: at ? `1px solid ${HAIRLINE}` : undefined }}
                  >
                    <span className="w-6 shrink-0 pt-3" aria-hidden>
                      <span className="block h-px w-3.5" style={{ background: MUTED }} />
                    </span>
                    <span
                      className="text-[14.5px] leading-[1.55]"
                      style={{ fontFamily: READ, color: INK_SOFT }}
                    >
                      {line}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <Rule />
          <p
            className="px-6 py-5 text-[13.5px] leading-[1.55] lg:px-9"
            style={{ fontFamily: READ, color: MUTED }}
          >
            {shown.footnote}
          </p>
        </div>
      </div>
    </section>
  )
}

function Joined() {
  return (
    <>
      <section className="pt-24">
        <div className={SHELL}>
          <div data-reveal className="max-w-[52ch]">
            <Kicker>Once you are in</Kicker>
            <Display className="mt-5 text-balance text-[clamp(2.1rem,4.4vw,3.6rem)] leading-[1.02]">
              And then it stops being three things
            </Display>
            <Reading className="mt-5 text-[16.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
              It was three subscriptions because a sticky, a row and a ticket were three objects
              inside three companies. Here they are one record looked at from three screens. The
              board below is live. Press a button and watch it turn into the other two.
            </Reading>
          </div>
        </div>
      </section>
      <div className="mt-10">
        <ProofBand />
      </div>
    </>
  )
}

const STATE_TONE: [string, string, string][] = [
  ['backlog', '#C6C2B6', 'open'],
  ['todo', '#8A867C', 'open'],
  ['doing', '#DE9A4E', 'open'],
  ['review', '#7FA5BE', 'open'],
  ['blocked', '#C8664A', 'open'],
  ['done', '#5E9A8A', 'counts as closed'],
  ['cancelled', '#C6C2B6', 'counts as closed'],
]

const TYPE_NAME: { [key: string]: string } = {
  multiselect: 'multi-select',
  createdBy: 'created by',
  editedBy: 'edited by',
  id: 'row number',
}

function Views() {
  const filled = FIELD_TYPES.filter((one) => !COMPUTED.includes(one))
  const worked = FIELD_TYPES.filter((one) => COMPUTED.includes(one))
  const say = (one: string) => TYPE_NAME[one] ?? one

  return (
    <section className="py-24">
      <div className={SHELL}>
        <div data-reveal className="max-w-[46ch]">
          <Kicker>The three views</Kicker>
          <Display className="mt-5 text-balance text-[clamp(2.1rem,4.4vw,3.6rem)] leading-[1.02]">
            One workspace, three ways of looking at it
          </Display>
        </div>

        <div className="mt-14 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
          <div data-reveal>
            <Kicker tone={PIGMENT}>The canvas</Kicker>
            <Display as="h3" className="mt-4 text-[clamp(1.7rem,2.6vw,2.4rem)] leading-[1.08]">
              A surface with no edges and no lag
            </Display>
            <Reading className="mt-4 text-[15.5px] leading-[1.62]" style={{ color: INK_SOFT }}>
              Sticky notes, text, thirty-two shape kinds, connectors that carry more than one
              label, pen and highlighter, images, PDFs laid out page by page, tables with merged
              cells, code blocks, embeds and mind maps that arrange themselves. Frames, layers,
              locking, snapping with spacing guides, comment pins, and a presentation mode that
              walks the frames in order.
            </Reading>
            <Reading className="mt-4 text-[15.5px] leading-[1.62]" style={{ color: INK_SOFT }}>
              One canvas element and a loop that only paints when something changed. The document
              is a CRDT in your browser, so it keeps working with the network unplugged: the server
              is where a board goes to meet other people, not where it lives.
            </Reading>
          </div>
          <div data-reveal>
            <div
              className="overflow-hidden rounded-2xl"
              style={{ border: `1px solid ${INK}1a`, boxShadow: '5px 5px 0 rgba(20,19,16,0.06)' }}
            >
              <BoardPicture template="architecture" surface={PAPER} className="rounded-none" />
            </div>
            <p className="mt-3 text-[12.5px]" style={{ fontFamily: READ, color: MUTED }}>
              Not a screenshot. That is the renderer the live canvas uses, drawing one of the eight
              templates into this page while you read it.
            </p>
          </div>
        </div>

        <div className="mt-20 grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-center lg:gap-16">
          <div
            data-reveal
            className="order-2 rounded-2xl lg:order-1"
            style={{
              background: SURFACE,
              border: `1px solid ${INK}1a`,
              boxShadow: '5px 5px 0 rgba(20,19,16,0.06)',
            }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 px-5 py-4">
              <span className="text-[13px] font-bold">Column types</span>
              <span className="text-[12px]" style={{ color: MUTED }}>
                all {FIELD_TYPES.length}, listed from the source rather than typed out here
              </span>
            </div>
            <Rule />
            <div className="grid sm:grid-cols-2">
              <div className="px-5 py-5" style={{ borderRight: `1px solid ${HAIRLINE}` }}>
                <Kicker>You fill in — {filled.length}</Kicker>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {filled.map((one) => (
                    <li
                      key={one}
                      className="rounded-md px-2 py-1 text-[12.5px]"
                      style={{ background: WASH, color: INK, fontFamily: READ }}
                    >
                      {say(one)}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="px-5 py-5">
                <Kicker tone={PIGMENT}>Worked out — {worked.length}</Kicker>
                <ul className="mt-4 flex flex-wrap gap-1.5">
                  {worked.map((one) => (
                    <li
                      key={one}
                      className="rounded-md px-2 py-1 text-[12.5px]"
                      style={{ background: '#F7E9E4', color: '#8B3421', fontFamily: READ }}
                    >
                      {say(one)}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <Rule />
            <p className="px-5 py-4 text-[12.5px] leading-[1.5]" style={{ fontFamily: READ, color: MUTED }}>
              A worked-out column is never stored. It is read off the row every time it is drawn,
              so there is nothing to keep in step and nothing to go stale.
            </p>
          </div>
          <div data-reveal className="order-1 lg:order-2">
            <Kicker tone={PIGMENT}>Pages and databases</Kicker>
            <Display as="h3" className="mt-4 text-[clamp(1.7rem,2.6vw,2.4rem)] leading-[1.08]">
              A page is a page until you give it columns
            </Display>
            <Reading className="mt-4 text-[15.5px] leading-[1.62]" style={{ color: INK_SOFT }}>
              Then it is a database, and the same rows appear as a table, a board, a gallery, a
              calendar, a timeline or a list without ever being copied. Formulas add days to a
              date; rollups fold a related table into a sum; a collection is a saved question —
              everything of mine that is late — so nothing is filed anywhere and nothing falls out
              of a folder when it changes.
            </Reading>
            <Reading className="mt-4 text-[15.5px] leading-[1.62]" style={{ color: INK_SOFT }}>
              Out again as Markdown, HTML or a real text PDF, per page. Forms drop their answers
              straight into a database, so an answer turns up in the table, the board and the
              calendar at once. Booking pages and published pages are in the box.
            </Reading>
          </div>
        </div>

        <div className="mt-20 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-center lg:gap-16">
          <div data-reveal>
            <Kicker tone={PIGMENT}>Issues</Kicker>
            <Display as="h3" className="mt-4 text-[clamp(1.7rem,2.6vw,2.4rem)] leading-[1.08]">
              The work, where the thinking already is
            </Display>
            <Reading className="mt-4 text-[15.5px] leading-[1.62]" style={{ color: INK_SOFT }}>
              Keys taken on insert and never reused, so TUV-14 is safe to write in a commit
              message. Two-week cycles with a burn-down, projects, estimates, labels, sub-issues,
              and blocking links stored once so the two sides can never disagree about which way
              round they go. Log a stint and the week adds itself up; recurring work asks every
              night and catches up on the one you missed.
            </Reading>
            <Reading className="mt-4 text-[15.5px] leading-[1.62]" style={{ color: INK_SOFT }}>
              Seven workflow states, fixed. You cannot add one or rename one, and if that is a
              problem it is better known here than in month two.
            </Reading>
          </div>
          <div
            data-reveal
            className="rounded-2xl"
            style={{
              background: SURFACE,
              border: `1px solid ${INK}1a`,
              boxShadow: '5px 5px 0 rgba(20,19,16,0.06)',
            }}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 px-5 py-4">
              <span className="text-[13px] font-bold">Workflow states</span>
              <span className="text-[12px]" style={{ color: MUTED }}>every one there is</span>
            </div>
            <Rule />
            {STATE_TONE.map(([name, tone, note], at) => (
              <div
                key={name}
                className="flex items-center gap-3 px-5 py-3"
                style={{ borderTop: at ? `1px solid ${HAIRLINE}` : undefined }}
              >
                <span
                  aria-hidden
                  className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                  style={{ background: tone }}
                />
                <span className="text-[14px]" style={{ fontFamily: READ }}>{name}</span>
                <span className="ml-auto text-[11.5px]" style={{ color: '#B6B1A6' }}>{note}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const IN_THE_FILE = [
  'Every record — pages, databases, issues, collections — with its title, its fields and its place in the tree',
  'The document behind every page, so the words come back as the words and not as a summary of them',
  'Every board, and the board document with it. Version one of the backup left the boards out, which made "the whole workspace" a sentence with a hole in it',
  'Labels, and which record wears which',
  'Every link between two records, in the direction it was made',
  'Cycles, with what was taken on and what closed',
]

function Exit() {
  return (
    <section
      data-arrive
      style={{ '--band': DEEP, color: PAPER } as React.CSSProperties}
      className="py-24"
    >
      <div className={`${SHELL} grid gap-14 lg:grid-cols-2 lg:gap-20`}>
        <div data-reveal>
          <Kicker tone="rgba(242,239,233,0.62)">The exit clause</Kicker>
          <Display className="mt-5 text-balance text-[clamp(2.1rem,4.4vw,3.6rem)] leading-[1.02]">
            You can leave here too
          </Display>
          <Reading className="mt-6 text-[17px] leading-[1.58]" style={{ color: 'rgba(242,239,233,0.9)' }}>
            An escape route that only runs one way is a trap with better marketing. So the door is
            on this side as well: one JSON file holds the workspace and puts it back into another
            install, and the licence is AGPL-3.0, which cannot be withdrawn from you afterwards.
          </Reading>
          <Reading className="mt-4 text-[17px] leading-[1.58]" style={{ color: 'rgba(242,239,233,0.9)' }}>
            There is no edition with the good parts taken out and no feature flag deciding which
            you are on. The code running the hosted plan is the code you can run. If this project
            stops being maintained tomorrow, the copy on your disk goes on working and somebody
            else is free to pick it up. That is what the licence is for.
          </Reading>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="/self-hosting"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold"
              style={{ background: PAPER, color: DEEP }}
            >
              How to run it yourself
            </a>
            <a
              href={PRODUCT.repo}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-[14px] font-semibold"
              style={{ border: '1px solid rgba(242,239,233,0.4)', color: PAPER }}
            >
              AGPL-3.0 on GitHub <ArrowUpRight size={15} />
            </a>
          </div>
        </div>

        <div data-reveal>
          <div
            className="rounded-2xl"
            style={{
              background: 'rgba(242,239,233,0.07)',
              border: '1px solid rgba(242,239,233,0.22)',
            }}
          >
            <div className="px-6 py-5">
              <Kicker tone="rgba(242,239,233,0.62)">In the file</Kicker>
            </div>
            <Rule tone="rgba(242,239,233,0.18)" />
            <ul>
              {IN_THE_FILE.map((line, at) => (
                <li
                  key={line}
                  className="flex gap-4 px-6 py-3.5"
                  style={{ borderTop: at ? '1px solid rgba(242,239,233,0.14)' : undefined }}
                >
                  <span
                    className="w-6 shrink-0 pt-1 text-[11px] font-bold tabular-nums"
                    style={{ color: 'rgba(242,239,233,0.55)' }}
                  >
                    {String(at + 1).padStart(2, '0')}
                  </span>
                  <span
                    className="text-[14.5px] leading-[1.5]"
                    style={{ fontFamily: READ, color: 'rgba(242,239,233,0.94)' }}
                  >
                    {line}
                  </span>
                </li>
              ))}
            </ul>
            <Rule tone="rgba(242,239,233,0.18)" />
            <div className="px-6 py-5">
              <Kicker tone="rgba(242,239,233,0.62)">Not in the file</Kicker>
              <p
                className="mt-3.5 text-[14.5px] leading-[1.5]"
                style={{ fontFamily: READ, color: 'rgba(242,239,233,0.8)' }}
              >
                The files you uploaded. They live in a bucket, they run to gigabytes, and a browser
                folding them into one JSON would fall over.
              </p>
              <p
                className="mt-3 text-[13px] leading-[1.5]"
                style={{ fontFamily: READ, color: 'rgba(242,239,233,0.6)' }}
              >
                The download screen says that before you press the button, rather than after you
                try to restore it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

const LOSSES: [string, string][] = [
  ['Two people in one page', 'No. A page is a CRDT that saves every couple of seconds and merges on open, so you converge rather than overwrite — but you do not watch each other type.'],
  ['Multiplayer on the canvas', 'Written, carried on private channels checked by the same database policies as the board, and never once run with two people in the room. We are not going to call that proven.'],
  ['Size', 'Around five hundred records of a kind, loaded and filtered in your browser. Right for a small team. Wrong for a wiki of thousands of pages or a database of tens of thousands of rows.'],
  ['Phones and tablets', 'None, by decision rather than backlog. An infinite canvas on a phone is a cramped read and we would rather not ship a bad one than ship one.'],
  ['Enterprise identity', 'No SAML, no SCIM, no signed support agreement, no published certifications. If procurement needs those, this does not get approved.'],
  ['Integrations', 'A REST API, webhooks and an MCP server for coding agents. No app directory, no Slack, no Jira, no Figma, and no branch or pull-request linking.'],
  ['Templates', 'Eight board templates and four database kits, against galleries with thousands in them.'],
  ['Who is behind it', 'One maintainer, in Turkey, with an issue tracker where a support desk would be.'],
]

function Losses() {
  return (
    <section className="py-24">
      <div className={SHELL}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] lg:gap-20">
          <div data-reveal className="lg:sticky lg:top-28 lg:self-start">
            <Kicker>Before you move anybody</Kicker>
            <Display className="mt-5 text-balance text-[clamp(2.1rem,4.4vw,3.6rem)] leading-[1.02]">
              Where we lose
            </Display>
            <Reading className="mt-5 text-[16px] leading-[1.6]" style={{ color: INK_SOFT }}>
              This is the list we would want in front of us before moving a team off something that
              already works. It is not a roadmap, and none of it is coming soon.
            </Reading>
          </div>
          <div data-reveal>
            {LOSSES.map(([title, body], at) => (
              <div
                key={title}
                className="grid gap-2 py-6 md:grid-cols-[minmax(0,0.6fr)_minmax(0,1fr)] md:gap-8"
                style={{ borderTop: at ? `1px solid ${HAIRLINE}` : undefined }}
              >
                <h3 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h3>
                <Reading className="text-[15px] leading-[1.6]" style={{ color: INK_SOFT }}>
                  {body}
                </Reading>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

const PLANS: {
  name: string
  price: string
  unit: string
  lines: string[]
  cta: [string, string]
  loud?: boolean
}[] = [
  {
    name: 'Free',
    price: '₺0',
    unit: 'for the whole workspace, for good',
    lines: [
      'Up to three people, counted across the workspace and not per board',
      'A gigabyte of images, PDFs and attachments',
      'Every board, page, database, issue, form, booking page and published page',
      'The API, webhooks and the MCP server are the one thing held back',
    ],
    cta: ['Open a board', '/dashboard'],
  },
  {
    name: 'Team',
    price: '₺249',
    unit: 'per member, per month, VAT included — about $7',
    lines: [
      'Up to two hundred people',
      'Ten gigabytes of files each',
      'REST API, webhooks and an MCP server, so n8n or a coding agent can reach the workspace',
      'Everything on the free plan, with nothing taken out of it to make this column look thicker',
    ],
    cta: ['The pricing page', '/pricing'],
    loud: true,
  },
  {
    name: 'Your own machine',
    price: '₺0',
    unit: 'and no invoice at all',
    lines: [
      'Your Postgres, your S3-compatible bucket, any host that can serve a folder of files',
      'One setting marks the install self-hosted and the seat, storage and API limits stop applying',
      'The schema is a folder of migrations you can read before you run them',
      'Who may read and write what is row-level security in the database, not a hidden button',
    ],
    cta: ['Read the setup', '/self-hosting'],
  },
]

function Price() {
  return (
    <section className="py-24" style={{ background: WASH }}>
      <div className={SHELL}>
        <div data-reveal className="max-w-[54ch]">
          <Kicker>What it costs</Kicker>
          <Display className="mt-5 text-balance text-[clamp(2.1rem,4.4vw,3.6rem)] leading-[1.02]">
            Three invoices, three renewal dates, one workspace
          </Display>
          <Reading className="mt-5 text-[16.5px] leading-[1.6]" style={{ color: INK_SOFT }}>
            We are not going to print their prices. They change them, and a page that quotes a
            competitor is wrong the week after it ships. Here is ours instead. What is priced is
            somebody else keeping the disks spinning — on your own machine that somebody is you,
            and the number is nothing.
          </Reading>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {PLANS.map((plan, at) => (
            <div
              key={plan.name}
              data-reveal
              style={{
                '--step': at,
                background: plan.loud ? INK : SURFACE,
                color: plan.loud ? PAPER : INK,
                border: `1px solid ${plan.loud ? INK : `${INK}1a`}`,
                boxShadow: '5px 5px 0 rgba(20,19,16,0.07)',
              } as React.CSSProperties}
              className="flex flex-col rounded-2xl"
            >
              <div className="px-6 pb-6 pt-7">
                <Kicker tone={plan.loud ? 'rgba(242,239,233,0.6)' : MUTED}>{plan.name}</Kicker>
                <Display className="mt-5 text-[3.4rem] leading-[0.95]">{plan.price}</Display>
                <p
                  className="mt-3 text-[13px] leading-[1.45]"
                  style={{ fontFamily: READ, color: plan.loud ? 'rgba(242,239,233,0.72)' : MUTED }}
                >
                  {plan.unit}
                </p>
              </div>
              <Rule tone={plan.loud ? 'rgba(242,239,233,0.2)' : HAIRLINE} />
              <ul className="flex-1 px-6 py-2">
                {plan.lines.map((line, i) => (
                  <li
                    key={line}
                    className="py-3.5 text-[14px] leading-[1.5]"
                    style={{
                      fontFamily: READ,
                      color: plan.loud ? 'rgba(242,239,233,0.9)' : INK_SOFT,
                      borderTop: i
                        ? `1px solid ${plan.loud ? 'rgba(242,239,233,0.14)' : HAIRLINE}`
                        : undefined,
                    }}
                  >
                    {line}
                  </li>
                ))}
              </ul>
              <div className="px-6 pb-6 pt-4">
                <a
                  href={plan.cta[1]}
                  className="inline-flex w-full items-center justify-center rounded-xl px-4 py-3 text-[14px] font-semibold"
                  style={plan.loud
                    ? { background: PAPER, color: INK }
                    : { border: `1px solid ${INK}26`, color: INK }}
                >
                  {plan.cta[0]}
                </a>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Close() {
  return (
    <section className="py-28">
      <div className={`${SHELL} max-w-[62rem] text-center`}>
        <div data-reveal>
          <Kicker>Start with the one you are angriest about</Kicker>
          <Display className="mx-auto mt-6 max-w-[22ch] text-balance text-[clamp(2.6rem,5.4vw,4.6rem)] leading-[0.98]">
            Move the whiteboard first
          </Display>
          <Reading
            className="mx-auto mt-7 max-w-[58ch] text-[17px] leading-[1.58]"
            style={{ color: INK_SOFT }}
          >
            It is the subscription with the least history inside it and the most money on it. Pull
            a board across, run one week of planning on it, and decide about the rest afterwards.
            Nothing here asks for a card, and nothing here can be taken back off you later.
          </Reading>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Action href="/dashboard" primary>Open a board</Action>
            <Action href="/alternatives/miro">Compared with Miro, honestly</Action>
            <Action href={PRODUCT.repo} external>Read the source</Action>
          </div>
        </div>
      </div>
    </section>
  )
}

function Foot() {
  const cols: [string, [string, string][]][] = [
    ['The product', [
      ['/canvas', 'Canvas'],
      ['/docs', 'Pages and databases'],
      ['/issues', 'Issues'],
      ['/pricing', 'Pricing'],
    ]],
    ['Leaving something', [
      ['/alternatives/miro', 'Compared with Miro'],
      ['/alternatives/notion', 'Compared with Notion'],
      ['/alternatives/linear', 'Compared with Linear'],
      ['/self-hosting', 'Self-hosting'],
    ]],
    ['Who it is for', [
      ['/for/software-teams', 'Software teams'],
      ['/for/client-work', 'Client work'],
      [PRODUCT.repo, 'Source on GitHub'],
    ]],
  ]
  return (
    <footer style={{ borderTop: `1px solid ${HAIRLINE}` }}>
      <div className={`${SHELL} grid gap-10 py-14 lg:grid-cols-[minmax(0,1.2fr)_repeat(3,minmax(0,1fr))]`}>
        <div>
          <Mark />
          <p
            className="mt-4 max-w-[34ch] text-[13.5px] leading-[1.55]"
            style={{ fontFamily: READ, color: MUTED }}
          >
            An open-source workspace where an infinite canvas, your pages and your issue tracker
            are three views of one set of records. AGPL-3.0. One maintainer, in Turkey.
          </p>
        </div>
        {cols.map(([title, links]) => (
          <div key={title}>
            <Kicker>{title}</Kicker>
            <ul className="mt-4 space-y-2.5">
              {links.map(([href, label]) => (
                <li key={href}>
                  <a
                    href={href}
                    {...(href.startsWith('http') ? { target: '_blank', rel: 'noreferrer' } : {})}
                    className="text-[13.5px] transition-colors hover:text-[#141310]"
                    style={{ color: INK_SOFT }}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className={SHELL}>
        <Rule />
        <p className="py-6 text-[12.5px]" style={{ fontFamily: READ, color: MUTED }}>
          Miro, Notion and Linear are trademarks of their owners. Tuval is not affiliated with any
          of them and nothing here is copied from them.
        </p>
      </div>
    </footer>
  )
}

export default function TryB() {
  const root = useRef<HTMLDivElement>(null)
  useDisplayFont()
  useReveal(root)

  return (
    <div ref={root} className="min-h-full overflow-x-hidden" style={{ background: PAPER, color: INK }}>
      <Nav />
      <main>
        <Hero />
        <Manifest />
        <Joined />
        <Views />
        <Exit />
        <Losses />
        <Price />
        <Close />
      </main>
      <Foot />
    </div>
  )
}
