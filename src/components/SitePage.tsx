import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { go, readRoute, routePath } from '../board/boards'
import { PRODUCT } from '../board/brand'
import { PRICE } from '../board/plan'
import { bandOf, filled, findPage, LINK_NAMES, PAGES } from '../site/pages'
import type { Band, Page } from '../site/pages'
import { Account } from './Account'
import { BoardPicture } from './BoardPicture'
import { SiteDemo } from './SiteDemo'
import { ThreeViews } from './ThreeViews'
import { Wordmark } from './Logo'

const DEEP = '#9E2F1B'
const PAPER = '#F2EFE9'

const DISPLAY = { fontFamily: '"Instrument Serif", "Iowan Old Style", Georgia, serif' }
const READING = { fontFamily: '"Instrument Sans", system-ui, sans-serif' }

const say = (text: string) => filled(text, PRICE)

// Which board a page opens on. This is most of what makes the pages different from each other:
// a consultant lands on a five whys, a software team on a kanban, and the words on top of them
// are describing something the reader can already see.
const BOARD: { [path: string]: string } = {
  '/': 'journey',
  '/canvas': 'architecture',
  '/for/software-teams': 'kanban',
  '/for/client-work': 'fivewhys',
}

const NAV = ['/', '/pricing']

function Header() {
  const path = routePath().replace(/\/+$/, '') || '/'
  return (
    <header className="sticky top-0 z-40 border-b border-[#141310]/8 bg-[#F2EFE9]/92 backdrop-blur-[6px]">
      <div className="mx-auto flex max-w-[80rem] items-center gap-6 px-6 py-3.5">
        <a href="/" onClick={(e) => { e.preventDefault(); go('/') }} className="shrink-0">
          <Wordmark height={20} />
        </a>
        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 md:flex">
          {NAV.map((to) => (
            <a
              key={to}
              href={to}
              onClick={(e) => { e.preventDefault(); go(to) }}
              aria-current={path === to ? 'page' : undefined}
              className={`rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold transition-colors
                ${path === to ? 'text-[#C8452D]' : 'text-[#141310] hover:bg-[#141310]/6'}`}
            >{LINK_NAMES[to]}</a>
          ))}
        </nav>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {PRODUCT.published ? (
            <a
              href={PRODUCT.repo}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#141310] hover:bg-[#141310]/6 sm:block"
            >GitHub</a>
          ) : (
            <a
              href="/self-hosting"
              onClick={(e) => { e.preventDefault(); go('/self-hosting') }}
              className="hidden rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#141310] hover:bg-[#141310]/6 sm:block"
            >{LINK_NAMES['/self-hosting']}</a>
          )}
          <a
            href="/dashboard"
            onClick={(e) => { e.preventDefault(); go('/dashboard') }}
            className="rounded-lg bg-[#141310] px-3.5 py-2 text-[13.5px] font-semibold text-[#F2EFE9] transition-[transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-[0_3px_0_rgba(20,19,16,0.35)] active:translate-y-0 active:shadow-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310]"
          >Open {PRODUCT.name}</a>
          <Account />
        </div>
      </div>
    </header>
  )
}

// One opening for every address: an eyebrow, the claim set in the serif, and the lede beside it
// rather than under it. Eleven pages that open the same way read as one site; eleven pages each
// inventing their own first screen read as a template applied eleven times.
function Hero({ page }: { page: Page }) {
  const home = page.path === '/'
  return (
    <section className="mx-auto max-w-[80rem] px-6 pt-8 pb-9">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C8452D]">
        {home
          ? 'AGPL-3.0 licensed · runs on your own machine · the source publishes shortly'
          : LINK_NAMES[page.path]}
      </p>
      <div className="mt-6 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <h1
          className="text-[clamp(2.6rem,5.8vw,5rem)] leading-[0.94] tracking-[-0.015em]"
          style={DISPLAY}
        >{page.claim}</h1>
        <p className="text-[16.5px] leading-[1.5] text-[#4A463E]" style={READING}>{page.lede}</p>
      </div>
      {!home && (
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <a
            href="/dashboard"
            onClick={(e) => { e.preventDefault(); go('/dashboard') }}
            className="rounded-xl bg-[#C8452D] px-5 py-3 text-[15px] font-semibold text-[#F2EFE9] shadow-[2px_2px_0_#9E2F1B] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[#A83621] hover:shadow-[3px_4px_0_#9E2F1B] active:translate-y-0 active:shadow-[1px_1px_0_#9E2F1B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310]"
          >Start a board</a>
          <Second />
        </div>
      )}
    </section>
  )
}

// One link, two states. While the repository is private, "Read the source" is a promise that
// answers 404, so it reads as the licence it actually is and points at the page about running it
// yourself.
function Second({ big }: { big?: boolean }) {
  const size = big ? 'px-5 py-3 text-[14px]' : 'px-5 py-3 text-[15px]'
  const look = `rounded-xl border border-[#141310]/20 font-semibold transition-colors duration-150 hover:border-[#141310] hover:bg-[#EBE7DE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310] ${size}`
  return PRODUCT.published
    ? <a href={PRODUCT.repo} target="_blank" rel="noreferrer" className={look}>Read the source</a>
    : (
      <a
        href="/self-hosting"
        onClick={(e) => { e.preventDefault(); go('/self-hosting') }}
        className={look}
      >Read the licence</a>
    )
}

// A caption under the work, the way a wall label sits under a painting rather than on it.
function Caption({ title, body }: { title: string; body?: string }) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 py-5">
      <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <span className="text-[13.5px] font-bold tracking-[-0.01em] text-[#141310]">{title}</span>
        {body && <span className="text-[13.5px] text-[#8A867C]">{body}</span>}
      </p>
    </div>
  )
}

// A dense index rather than three big cards. What a specification sheet looks like: many facts,
// small type, tight rows, nothing decorative.
function Index({ points, label }: { points: { title: string; body: string }[]; label: string }) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 py-20">
      <Rule label={label} />
      <dl className="grid gap-x-12 gap-y-10 md:grid-cols-3">
        {points.map((point, at) => (
          <div key={point.title} data-reveal style={{ '--step': at } as React.CSSProperties}>
            <dt className="border-b border-[#141310]/20 pb-2 text-[26px] leading-[1.1]" style={DISPLAY}>
              {point.title}
            </dt>
            <dd className="mt-3 text-[14px] leading-[1.6] text-[#4A463E]" style={READING}>
              {say(point.body)}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// One statement, drenched, with nothing else on it. This is the only place the pigment is used
// at full strength, so it stays an event rather than a background.
function Statement({ heading, body, picture }: {
  heading: string
  body?: string
  picture?: string
}) {
  return (
    <section data-arrive style={{ '--band': DEEP, color: PAPER } as React.CSSProperties}>
      <div className={`mx-auto max-w-[80rem] px-6 py-32 sm:py-40 ${picture ? 'grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`}>
        <div>
          <h2
            data-reveal
            className="max-w-[17ch] leading-[1.04] tracking-[-0.01em]"
            style={{
              ...DISPLAY,
              fontSize: picture ? 'clamp(1.9rem, 3.6vw, 2.9rem)' : 'clamp(2.2rem, 5.4vw, 4.2rem)',
            }}
          >{heading}</h2>
          {body && (
            <p
              data-reveal
              className="mt-6 max-w-[52ch]"
              style={{
                '--step': 1,
                ...READING,
                fontSize: '17px',
                lineHeight: 1.66,
                color: 'rgba(242,239,233,0.86)',
              } as React.CSSProperties}
            >{say(body)}</p>
          )}
        </div>
        {picture && (
          <BoardPicture
            template={picture}
            surface="#FAF6F3"
            className="shadow-[0_24px_60px_-30px_rgba(20,19,16,0.8)]"
          />
        )}
      </div>
    </section>
  )
}

// A comparison, which is the only shape an "alternative to X" page can honestly take. The rows
// that go against us are in it: a table with no losing row is an advertisement, and a reader who
// spots the omission stops believing the rest of the page.
function Compare({ compare }: { compare: NonNullable<Page['compare']> }) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 pt-6 pb-20">
      <Rule label={`Side by side with ${compare.against}`} />
      <div className="overflow-x-auto rounded-2xl border border-[#141310]/12 bg-[#FCFBF8] shadow-[5px_5px_0_rgba(20,19,16,0.07)]">
        <table className="w-full min-w-[46rem] border-collapse text-left">
          <thead>
            <tr>
              <th scope="col" className="w-[34%] border-b border-[#141310] px-5 py-3.5 text-[12px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
                Feature
              </th>
              <th scope="col" className="w-[33%] border-b border-[#141310] px-5 py-3.5 text-[13px] font-bold text-[#C8452D]">
                {PRODUCT.name}
              </th>
              <th scope="col" className="w-[33%] border-b border-[#141310] px-5 py-3.5 text-[13px] font-bold text-[#141310]">
                {compare.against}
              </th>
            </tr>
          </thead>
          <tbody>
            {compare.rows.map((row) => (
              <tr key={row.feature} className="border-b border-[#141310]/8 last:border-0">
                <th scope="row" className="px-5 py-3.5 align-top text-[14px] font-semibold">
                  {row.feature}
                </th>
                <td className="px-5 py-3.5 align-top text-[14px] leading-snug text-[#4A463E]">{say(row.tuval)}</td>
                <td className="px-5 py-3.5 align-top text-[14px] leading-snug text-[#4A463E]">{row.them}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-4 max-w-[70ch] text-[12.5px] leading-relaxed text-[#8A867C]">
        {compare.note ?? `Checked ${compare.checked}. ${compare.against} is a trademark of its owner;`
          + ` ${PRODUCT.name} is not affiliated with, endorsed by or sponsored by them.`
          + ' Their product changes; if a row here has gone stale, tell us and it will be corrected.'}
      </p>
    </div>
  )
}

// The trade pages are a week, not a feature list. Read across, not down.
function Week({ points, label }: { points: { title: string; body: string }[]; label: string }) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 py-20">
      <Rule label={label} />
      <ol className="grid gap-y-12 md:grid-cols-3 md:gap-x-10">
        {points.map((point, at) => (
          <li key={point.title} className="relative md:pt-10">
            <span
              aria-hidden
              className="absolute left-0 top-0 hidden h-px w-full bg-[#141310]/15 md:block"
            />
            <span
              aria-hidden
              className="absolute -top-[5px] left-0 hidden h-2.5 w-2.5 rounded-full bg-[#C8452D] md:block"
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#C8452D]">
              Step {at + 1}
            </span>
            <h3 className="mt-3 text-[28px] leading-[1.1]" style={DISPLAY}>{point.title}</h3>
            <p
              className="mt-2.5 max-w-[38ch] text-[14px] leading-[1.6] text-[#4A463E]"
              style={READING}
            >{say(point.body)}</p>
          </li>
        ))}
      </ol>
    </div>
  )
}

function Onward({ page }: { page: Page }) {
  const near = page.next.map((to) => PAGES.find((p) => p.path === to)).filter(Boolean) as Page[]
  if (!near.length) return null
  return (
    <section className="mx-auto max-w-[80rem] px-6 py-20">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A867C]">Keep reading</h2>
      <ul className="mt-5">
        {near.map((one) => (
          <li key={one.path} className="border-t border-[#141310]/10 last:border-b">
            <a
              href={one.path}
              onClick={(e) => { e.preventDefault(); go(one.path) }}
              className="group grid items-baseline gap-x-8 gap-y-1 py-5 sm:grid-cols-[11rem_minmax(0,1fr)_auto]"
            >
              <span className="text-[12px] font-bold uppercase tracking-[0.14em] text-[#C8452D]">
                {LINK_NAMES[one.path]}
              </span>
              <span
                className="min-w-0 text-[clamp(1.2rem,2vw,1.6rem)] leading-[1.15] transition-colors group-hover:text-[#C8452D]"
                style={DISPLAY}
              >{one.claim}</span>
              <ArrowRight
                size={19}
                className="hidden shrink-0 text-[#C6C2B6] transition-transform duration-300 group-hover:translate-x-1.5 group-hover:text-[#C8452D] sm:block"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Footer() {
  return (
    <footer style={{ background: '#141310', color: PAPER }}>
      <div className="mx-auto max-w-[80rem] px-6 py-16">
        <div className="flex flex-wrap gap-x-16 gap-y-10">
          <div className="min-w-[17rem] flex-1">
            <p
              className="max-w-[16ch] leading-[1.04]"
              style={{ ...DISPLAY, fontSize: 'clamp(1.8rem, 3.2vw, 2.6rem)' }}
            >The board, the page and the work.</p>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[#F2EFE9]/60">
              One record, three ways to look at it. AGPL-3.0, and yours to run.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-14 gap-y-8">
            {[PAGES.slice(1, 4), PAGES.slice(4, 6), PAGES.slice(6)].map((group, at) => (
              <ul key={at} className="space-y-2.5">
                {group.map((one) => (
                  <li key={one.path}>
                    <a
                      href={one.path}
                      onClick={(e) => { e.preventDefault(); go(one.path) }}
                      className="text-[14px] text-[#F2EFE9]/70 hover:text-[#F2EFE9]"
                    >{LINK_NAMES[one.path]}</a>
                  </li>
                ))}
              </ul>
            ))}
          </nav>
        </div>
        <div className="mt-14 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-[#F2EFE9]/12 pt-6">
          <Wordmark height={16} />
          <span className="text-[12.5px] text-[#F2EFE9]/45">AGPL-3.0</span>
          {PRODUCT.published && (
            <a href={PRODUCT.repo} className="text-[12.5px] text-[#F2EFE9]/45 hover:text-[#F2EFE9]">
              Source on GitHub
            </a>
          )}
        </div>
      </div>
    </footer>
  )
}

// Five layouts, not one applied ten times. What a page is about decides how it is built: a
// surface page opens on that surface, a trade page reads as a week, and the two pages with no
// product to show are a table and a specification sheet.

function SurfaceLayout({ page }: { page: Page }) {
  const shown = page.bands.find((b) => b.demo && b.demo !== 'none')
  const index = page.bands.find((b) => b.points)
  const said = page.bands.filter((b) => b.tone === 'pigment')

  return (
    <>
      <Hero page={page} />
      {shown && (
        <div className="bg-[#EBE7DE] py-12">
          <SiteDemo kind={shown.demo!} template={BOARD[page.path]} tall />
          <Caption title={shown.heading} body={shown.body} />
        </div>
      )}
      {said[0] && <Statement heading={said[0].heading} body={said[0].body} />}
      {index?.points && <Index points={index.points} label={index.heading} />}
      {said[1] && <Statement heading={said[1].heading} body={said[1].body} />}
    </>
  )
}

function TradeLayout({ page }: { page: Page }) {
  const shown = page.bands.find((b) => b.demo && b.demo !== 'none')
  const week = page.bands.find((b) => b.points)
  const said = page.bands.filter((b) => b.tone === 'pigment')

  return (
    <>
      <Hero page={page} />
      {shown && (
        <div className="bg-[#EBE7DE] py-12">
          <SiteDemo kind="canvas" template={BOARD[page.path]} tall />
          <Caption title={shown.heading} body={shown.body} />
        </div>
      )}
      {said[0] && <Statement heading={said[0].heading} body={said[0].body} />}
      {week?.points && <Week points={week.points} label={week.heading} />}
      {said[1] && <Statement heading={said[1].heading} body={said[1].body} />}
    </>
  )
}

// Two prices on hairlines, not two cards. A card grid says these are two products; they are one
// product and one question, which is whether somebody else keeps the disks spinning.
function PricingLayout({ page }: { page: Page }) {
  const free = page.bands.find((b) => b.heading === 'Free')
  const team = page.bands.find((b) => b.heading === 'Team')
  const pay = page.bands.find((b) => b.id === 'pay')
  const last = page.bands[page.bands.length - 1]

  const price = (label: string, amount: string, unit: string) => (
    <>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A867C]">{label}</p>
      <p className="mt-2 leading-none" style={{ ...DISPLAY, fontSize: 'clamp(3rem,6vw,4.4rem)' }}>
        {amount}
      </p>
      <p className="mt-2 text-[13px] text-[#8A867C]">{unit}</p>
    </>
  )

  return (
    <>
      <Hero page={page} />
      <div className="mx-auto max-w-[80rem] px-6 pb-20">
        <Rule label="What it costs" />
        <div className="grid gap-x-12 gap-y-12 md:grid-cols-2">
          <div className="border-t border-[#141310]/20 pt-6">
            {price('Free', '0', 'for up to three people, forever')}
            <dl className="mt-8">
              {free?.points?.map((point) => (
                <div key={point.title} className="flex gap-3 border-t border-[#141310]/12 py-3 text-[14px] leading-snug">
                  <dt className="w-[9.5rem] shrink-0 font-semibold">{point.title}</dt>
                  <dd className="min-w-0 flex-1 text-[#4A463E]" style={READING}>{say(point.body)}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="border-t-2 border-[#C8452D] pt-6">
            {price(
              'Team',
              `${PRICE.currency}${PRICE.amount}`,
              `per ${PRICE.per}, per ${PRICE.period}${PRICE.taxIncluded ? ', VAT included' : ''} · about ${PRICE.about}`,
            )}
            <p className="mt-8 max-w-[46ch] text-[15px] leading-[1.65] text-[#4A463E]" style={READING}>
              {say(team?.body ?? '')}
            </p>
            <a
              href="/dashboard"
              onClick={(e) => { e.preventDefault(); go('/dashboard') }}
              className="mt-8 inline-block rounded-xl bg-[#C8452D] px-5 py-3 text-[15px] font-semibold text-[#F2EFE9] shadow-[2px_2px_0_#9E2F1B] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310]"
            >Start free</a>
            <p className="mt-6 max-w-[46ch] border-t border-[#141310]/12 pt-3 text-[12px] leading-[1.6] text-[#8A867C]">
              {`${PRICE.currency}${PRICE.amount} since ${PRICE.since}. ${PRICE.review}`}
            </p>
          </div>
        </div>

        {pay && (
          <div className="mt-16 border-t border-[#141310]/20 pt-6">
            <h2 className="text-[26px] leading-[1.1]" style={DISPLAY}>{pay.heading}</h2>
            <p className="mt-3 max-w-[62ch] text-[15px] leading-[1.65] text-[#4A463E]" style={READING}>
              {say(pay.body ?? '')}
            </p>
          </div>
        )}
      </div>
      {last && <Statement heading={last.heading} body={last.body} />}
    </>
  )
}

function CompareLayout({ page }: { page: Page }) {
  const said = page.bands.filter((b) => b.tone === 'pigment')
  const prose = page.bands.filter((b) => b.tone === 'paper')
  return (
    <>
      <Hero page={page} />
      {page.compare && <Compare compare={page.compare} />}
      {said[0] && <Statement heading={said[0].heading} body={said[0].body} />}
      <div className="mx-auto max-w-[80rem] px-6 pt-20 pb-24">
        <dl className="grid gap-x-14 gap-y-12 md:grid-cols-3">
          {prose.map((one, at) => (
            <div key={one.heading} data-reveal style={{ '--step': at } as React.CSSProperties}>
              <dt className="border-b border-[#141310]/20 pb-2 text-[26px] leading-[1.1]" style={DISPLAY}>
                {one.heading}
              </dt>
              <dd className="mt-3 text-[14px] leading-[1.6] text-[#4A463E]" style={READING}>
                {say(one.body ?? '')}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </>
  )
}

// A specification sheet. Nothing to demonstrate here, so the page is what it is about: the
// requirements, plainly, in the order somebody would meet them.
// The instructions, as instructions. Prose about how easy something is to install is not how
// anybody decides whether to install it; the four lines they will actually type are.
function Commands({ band }: { band: Band }) {
  return (
    <div className="mt-4 mb-12 border-t border-[#141310]/12 pt-8">
      <h3 className="text-[26px] leading-[1.12]" style={DISPLAY}>{band.heading}</h3>
      <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-[1.65] text-[#4A463E]" style={READING}>
        {band.body}
      </p>
      <ol className="mt-6 overflow-x-auto rounded-xl border border-[#141310]/12 bg-[#141310] py-4 text-[#EBE7DE]">
        {band.lines?.map((line) => (
          <li key={line} className="flex gap-3 whitespace-pre px-5 py-1.5 font-mono text-[12.5px] leading-[1.6]">
            <span aria-hidden className="select-none text-[#C8452D]">$</span>
            {line}
          </li>
        ))}
      </ol>
    </div>
  )
}

function SpecLayout({ page }: { page: Page }) {
  const needs = page.bands.find((b) => b.points)
  const commands = bandOf(page, 'commands')
  const said = page.bands.filter((b) => b.tone === 'pigment')
  const note = page.bands.filter((b) => b.tone === 'paper' && !b.points && !b.lines)

  return (
    <>
      <Hero page={page} />
      <div className="mx-auto max-w-[80rem] px-6 pb-20">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A867C]">
          {needs?.heading}
        </h2>
        <dl className="mt-4">
          {needs?.points?.map((point, at) => (
            <div key={point.title} className="grid items-baseline gap-x-8 gap-y-1 border-t border-[#141310]/12 py-6 sm:grid-cols-[3rem_12rem_minmax(0,1fr)]">
              <dt className="font-mono text-[12px] tabular-nums text-[#C8452D]">
                {String(at + 1).padStart(2, '0')}
              </dt>
              <dt className="text-[22px] leading-[1.15]" style={DISPLAY}>{point.title}</dt>
              <dd className="text-[14px] leading-[1.6] text-[#4A463E]" style={READING}>
                {say(point.body)}
              </dd>
            </div>
          ))}
        </dl>
        {commands && <Commands band={commands} />}
        {note.map((one) => (
          <div key={one.heading} className="border-t border-[#141310]/12 py-8">
            <h3 className="text-[26px] leading-[1.12]" style={DISPLAY}>{one.heading}</h3>
            <p className="mt-2.5 max-w-[62ch] text-[14.5px] leading-[1.65] text-[#4A463E]" style={READING}>
              {say(one.body ?? '')}
            </p>
          </div>
        ))}
      </div>
      {said.map((one) => <Statement key={one.heading} heading={one.heading} body={one.body} />)}
    </>
  )
}

// The front door -----------------------------------------------------------------------------
// Chosen out of three finished designs by the panel and the founder. What decided it: the board
// is above the fold and it is the product, not a screenshot of it, and the argument for putting
// three tools in one place is made by letting a visitor watch one record sit in all three at once.
//
// The words are all in pages.json, so a crawler with no JavaScript is served this page and not a
// shorter one.

// A rule with a label on it, the way a wall text is set off from the work.
const Rule = ({ label }: { label: string }) => (
  <div className="flex items-center gap-4 pb-9">
    <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#8A867C]">{label}</span>
    <span className="h-px flex-1 bg-[#141310]/12" />
  </div>
)

function HomeHero({ page }: { page: Page }) {
  return (
    <section className="mx-auto max-w-[80rem] px-6 pt-14 pb-9">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C8452D]">
        AGPL-3.0 licensed · runs on your own machine · the source publishes shortly
      </p>
      <div className="mt-6 grid items-end gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,27rem)]">
        <h1
          className="text-[clamp(2.9rem,6.4vw,4rem)] leading-[0.92] tracking-[-0.015em]"
          style={DISPLAY}
        >{page.claim}</h1>
        <p className="text-[16.5px] leading-[1.5] text-[#4A463E]" style={READING}>{page.lede}</p>
      </div>
    </section>
  )
}

// Three lists side by side, on hairlines. Not three cards: a card grid says these are three
// products, and the whole page is an argument that they are one.
function Columns({ bands }: { bands: Band[] }) {
  return (
    <div className="grid gap-x-10 gap-y-12 md:grid-cols-3">
      {bands.map((band, at) => (
        <div key={band.heading} data-reveal style={{ '--step': at } as React.CSSProperties}>
          <h2 className="text-[28px] leading-[1.1]" style={DISPLAY}>{band.heading}</h2>
          <p className="mt-1 text-[14px] text-[#8A867C]" style={READING}>{band.body}</p>
          <ul className="mt-5">
            {band.lines?.map((line) => (
              <li
                key={line}
                className="border-t border-[#141310]/12 py-2.5 text-[13.5px] leading-[1.45] text-[#4A463E]"
                style={READING}
              >{line}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

// A heading, a paragraph and a numbered list, in three columns. Used for the two bands a reader
// is deciding on rather than skimming: what it costs, and what it cannot do.
function Ledger({ band, label }: { band: Band; label: string }) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 py-20">
      <Rule label={label} />
      <div className="grid items-start gap-x-12 gap-y-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
        <div>
          <h2 className="text-[clamp(1.9rem,3.2vw,2.9rem)] leading-[1.02]" style={DISPLAY}>
            {band.heading}
          </h2>
          <p className="mt-4 max-w-[34ch] text-[14px] leading-[1.6] text-[#4A463E]" style={READING}>
            {say(band.body ?? '')}
          </p>
        </div>
        <dl className={`grid gap-x-10 gap-y-7 ${
          (band.points?.length ?? 0) % 3 === 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}
        >
          {band.points?.map((point, at) => (
            <div key={point.title} className="border-t border-[#141310]/20 pt-3">
              <dt className="flex items-baseline gap-2 text-[15px] font-bold tracking-[-0.015em]">
                <span className="font-mono text-[11px] tabular-nums text-[#C8452D]">
                  {String(at + 1).padStart(2, '0')}
                </span>
                {point.title}
              </dt>
              <dd className="mt-2 text-[13.5px] leading-[1.55] text-[#4A463E]" style={READING}>
                {say(point.body)}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  )
}

function HomeLayout({ page }: { page: Page }) {
  const demo = bandOf(page, 'demo')
  const promote = bandOf(page, 'promote')
  const close = bandOf(page, 'close')
  const columns = ['canvas', 'pages', 'issues']
    .map((id) => bandOf(page, id))
    .filter(Boolean) as Band[]

  return (
    <>
      <HomeHero page={page} />
      <section className="mx-auto max-w-[80rem] px-6 pt-8 pb-6 lg:hidden">
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">{demo?.heading}</h2>
        <p className="mt-3 max-w-[74ch] text-[14.5px] leading-[1.6] text-[#4A463E]" style={READING}>
          {demo?.body}
        </p>
      </section>
      <ThreeViews />
      <section className="mx-auto max-w-[80rem] px-6 pt-8 pb-16">
        <div className="hidden lg:block">
          <h2 className="text-[19px] font-bold tracking-[-0.02em]">{demo?.heading}</h2>
          <p className="mt-3 max-w-[74ch] text-[14.5px] leading-[1.6] text-[#4A463E]" style={READING}>
            {demo?.body}
          </p>
        </div>
        <div className="mt-7 flex flex-wrap items-center gap-3">
          <a
            href="/dashboard"
            onClick={(e) => { e.preventDefault(); go('/dashboard') }}
            className="rounded-xl bg-[#141310] px-5 py-3 text-[14px] font-semibold text-[#F2EFE9] shadow-[3px_3px_0_rgba(20,19,16,0.22)] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310]"
          >Start a board — free for three people</a>
          <Second big />
          <span className="text-[12.5px] text-[#8A867C]">No card, no trial clock.</span>
        </div>
      </section>

      {promote && <Statement heading={promote.heading} body={promote.body} />}

      <section className="bg-[#EBE7DE]">
        <div className="mx-auto max-w-[80rem] px-6 py-20">
          <Rule label="The three views, in full" />
          <Columns bands={columns} />
        </div>
      </section>

      {bandOf(page, 'migrate') && (
        <Ledger band={bandOf(page, 'migrate')!} label="Coming from something else" />
      )}

      <section className="border-t border-[#141310]/12 bg-[#EBE7DE]">
        {bandOf(page, 'price') && <Ledger band={bandOf(page, 'price')!} label="What it costs" />}
      </section>

      {bandOf(page, 'ceiling') && (
        <Ledger band={bandOf(page, 'ceiling')!} label="What is not finished" />
      )}

      {close && <Statement heading={close.heading} body={close.body} />}
    </>
  )
}

export function SitePage() {
  const route = readRoute()
  const page = findPage(routePath()) ?? findPage('/')!

  useEffect(() => {
    document.title = page.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', page.description)
    document.documentElement.lang = page.lang ?? 'en'
    window.scrollTo(0, 0)
  }, [page])

  if (route.kind !== 'landing') return null

  const body = page.compare ? <CompareLayout page={page} />
    : page.path === '/' ? <HomeLayout page={page} />
    : page.path === '/pricing' ? <PricingLayout page={page} />
      : ['/self-hosting', '/mcp'].includes(page.path) ? <SpecLayout page={page} />
        : page.path.startsWith('/for/') ? <TradeLayout page={page} />
          : <SurfaceLayout page={page} />

  return (
    <div className="min-h-dvh bg-[#F2EFE9] text-[#141310]">
      <Header />
      {body}
      <Onward page={page} />
      <Footer />
    </div>
  )
}
