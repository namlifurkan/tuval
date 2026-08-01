import { useEffect } from 'react'
import { ArrowRight } from 'lucide-react'
import { go, readRoute, routePath } from '../board/boards'
import { PRODUCT } from '../board/brand'
import { PRICE } from '../board/plan'
import { findPage, LINK_NAMES, PAGES } from '../site/pages'
import type { Page } from '../site/pages'
import { Account } from './Account'
import { BoardPicture } from './BoardPicture'
import { ProofBand } from './ProofBand'
import { SiteDemo } from './SiteDemo'
import { Wordmark } from './Logo'

const DEEP = '#9E2F1B'
const PAPER = '#F2EFE9'

// Which board a page opens on. This is most of what makes the pages different from each other:
// a consultant lands on a five whys, a software team on a kanban, and the words on top of them
// are describing something the reader can already see.
const BOARD: { [path: string]: string } = {
  '/': 'journey',
  '/canvas': 'architecture',
  '/for/software-teams': 'kanban',
  '/for/agencies': 'brainwriting',
  '/for/freelancers': 'mindmap',
  '/for/consultants': 'fivewhys',
}

const NAV = ['/canvas', '/docs', '/issues', '/pricing']

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
          <a
            href={PRODUCT.repo}
            target="_blank"
            rel="noreferrer"
            className="hidden rounded-lg px-2.5 py-1.5 text-[13.5px] font-semibold text-[#141310] hover:bg-[#141310]/6 sm:block"
          >GitHub</a>
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

function Hero({ page }: { page: Page }) {
  return (
    <section className="mx-auto max-w-[80rem] px-6 pb-14 pt-20 sm:pt-28">
      <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#C8452D]">
        {page.path === '/' ? 'Open source workspace' : LINK_NAMES[page.path]}
      </span>
      <h1
        className="mt-5 max-w-[15ch] font-bold leading-[0.94] tracking-[-0.045em]"
        style={{ fontSize: 'clamp(2.7rem, 7.4vw, 5.8rem)' }}
      >{page.claim}</h1>
      <p
        className="mt-7 max-w-[54ch] text-[#4A463E]"
        style={{
          fontFamily: '"Instrument Sans", system-ui, sans-serif',
          fontSize: 'clamp(1.06rem, 1.4vw, 1.3rem)',
          lineHeight: 1.6,
        }}
      >{page.lede}</p>
      <div className="mt-9 flex flex-wrap items-center gap-3">
        <a
          href="/dashboard"
          onClick={(e) => { e.preventDefault(); go('/dashboard') }}
          className="rounded-xl bg-[#C8452D] px-5 py-3 text-[15px] font-semibold text-[#F2EFE9] shadow-[2px_2px_0_#9E2F1B] transition-[transform,box-shadow,background-color] duration-150 hover:-translate-y-0.5 hover:bg-[#A83621] hover:shadow-[3px_4px_0_#9E2F1B] active:translate-y-0 active:shadow-[1px_1px_0_#9E2F1B] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310]"
        >Start a board</a>
        <a
          href={PRODUCT.repo}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl border border-[#141310]/20 px-5 py-3 text-[15px] font-semibold transition-colors duration-150 hover:border-[#141310] hover:bg-[#EBE7DE] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310]"
        >Read the source</a>
      </div>
    </section>
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
function Index({ points }: { points: { title: string; body: string }[] }) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 pt-24 pb-28">
      <dl className="grid gap-x-14 gap-y-10 md:grid-cols-3">
        {points.map((point) => (
          <div key={point.title}>
            <dt className="border-b border-[#141310] pb-2.5 text-[19px] font-bold tracking-[-0.02em]">
              {point.title}
            </dt>
            <dd
              className="mt-3 text-[14.5px] leading-[1.7] text-[#4A463E]"
              style={{ fontFamily: '"Instrument Sans", system-ui, sans-serif' }}
            >{point.body}</dd>
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
    <section style={{ background: DEEP, color: PAPER }}>
      <div className={`mx-auto max-w-[80rem] px-6 py-32 sm:py-40 ${picture ? 'grid items-center gap-x-16 gap-y-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]' : ''}`}>
        <div>
          <h2
            className="max-w-[17ch] font-bold leading-[1.02] tracking-[-0.038em]"
            style={{ fontSize: picture ? 'clamp(1.9rem, 3.6vw, 2.9rem)' : 'clamp(2.2rem, 5.4vw, 4.2rem)' }}
          >{heading}</h2>
          {body && (
            <p
              className="mt-6 max-w-[52ch]"
              style={{
                fontFamily: '"Instrument Sans", system-ui, sans-serif',
                fontSize: '18px',
                lineHeight: 1.66,
                color: 'rgba(242,239,233,0.86)',
              }}
            >{body}</p>
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

// The trade pages are a week, not a feature list. Read across, not down.
function Week({ points }: { points: { title: string; body: string }[] }) {
  return (
    <div className="mx-auto max-w-[80rem] px-6 pt-24 pb-28">
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
            <h3 className="mt-3 text-[26px] font-bold leading-[1.12] tracking-[-0.03em]">{point.title}</h3>
            <p
              className="mt-2.5 max-w-[38ch] text-[15px] leading-[1.68] text-[#4A463E]"
              style={{ fontFamily: '"Instrument Sans", system-ui, sans-serif' }}
            >{point.body}</p>
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
              <span className="min-w-0 text-[clamp(1.1rem,1.8vw,1.45rem)] font-semibold leading-[1.2] tracking-[-0.025em] transition-colors group-hover:text-[#C8452D]">
                {one.claim}
              </span>
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
              className="max-w-[16ch] font-bold leading-[1.02] tracking-[-0.03em]"
              style={{ fontSize: 'clamp(1.6rem, 3vw, 2.4rem)' }}
            >The board, the page and the work.</p>
            <p className="mt-4 max-w-[34ch] text-[14px] leading-relaxed text-[#F2EFE9]/60">
              One record, three ways to look at it. AGPL-3.0, and yours to run.
            </p>
          </div>
          <nav className="flex flex-wrap gap-x-14 gap-y-8">
            {[PAGES.slice(1, 4), PAGES.slice(4, 8), PAGES.slice(8)].map((group, at) => (
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
          <a href={PRODUCT.repo} className="text-[12.5px] text-[#F2EFE9]/45 hover:text-[#F2EFE9]">Source on GitHub</a>
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
      {index?.points && <Index points={index.points} />}
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
      {week?.points && <Week points={week.points} />}
      {said[1] && <Statement heading={said[1].heading} body={said[1].body} />}
    </>
  )
}

// Two columns and one number, because a price is a comparison and a comparison is a table.
function PricingLayout({ page }: { page: Page }) {
  const free = page.bands.find((b) => b.heading === 'Free')
  const team = page.bands.find((b) => b.heading === 'Team')
  const last = page.bands[page.bands.length - 1]

  const row = 'flex gap-3 py-3 text-[14.5px] leading-snug border-t'

  return (
    <>
      <Hero page={page} />
      <div className="mx-auto grid max-w-[80rem] gap-12 px-6 pb-20 md:grid-cols-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A867C]">Free</p>
          <p className="mt-2 font-bold leading-none tracking-[-0.05em]" style={{ fontSize: 'clamp(3rem,6vw,4.5rem)' }}>
            0
          </p>
          <p className="mt-2 text-[14px] text-[#8A867C]">for up to three people, forever</p>
          <div className="mt-8">
            {free?.points?.map((point) => (
              <div key={point.title} className={`${row} border-[#141310]/12`}>
                <span className="w-[9.5rem] shrink-0 font-semibold">{point.title}</span>
                <span className="min-w-0 flex-1 text-[#4A463E]">{point.body}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl p-8" style={{ background: DEEP, color: PAPER }}>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#F2EFE9]/60">Team</p>
          <p className="mt-2 font-bold leading-none tracking-[-0.05em]" style={{ fontSize: 'clamp(3rem,6vw,4.5rem)' }}>
            {PRICE.amount}{PRICE.currency}
          </p>
          <p className="mt-2 text-[14px] text-[#F2EFE9]/70">
            per {PRICE.per}, per {PRICE.period}{PRICE.taxIncluded ? ', VAT included' : ''}
            {' · '}about {PRICE.about}
          </p>
          <p
            className="mt-8 text-[16px] leading-[1.7] text-[#F2EFE9]/90"
            style={{ fontFamily: '"Instrument Sans", system-ui, sans-serif' }}
          >{team?.body}</p>
          <a
            href="/dashboard"
            onClick={(e) => { e.preventDefault(); go('/dashboard') }}
            className="mt-8 inline-block rounded-xl bg-[#F2EFE9] px-5 py-3 text-[15px] font-semibold text-[#141310] transition-transform duration-150 hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F2EFE9]"
          >Start free</a>
        </div>
      </div>
      {last && <Statement heading={last.heading} body={last.body} />}
    </>
  )
}

// A specification sheet. Nothing to demonstrate here, so the page is what it is about: the
// requirements, plainly, in the order somebody would meet them.
function SpecLayout({ page }: { page: Page }) {
  const needs = page.bands.find((b) => b.points)
  const said = page.bands.filter((b) => b.tone === 'pigment')
  const note = page.bands.filter((b) => b.tone === 'paper' && !b.points)

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
              <dt className="text-[13px] font-bold tabular-nums text-[#C8452D]">
                {String(at + 1).padStart(2, '0')}
              </dt>
              <dt className="text-[17px] font-bold tracking-[-0.02em]">{point.title}</dt>
              <dd
                className="text-[15px] leading-[1.7] text-[#4A463E]"
                style={{ fontFamily: '"Instrument Sans", system-ui, sans-serif' }}
              >{point.body}</dd>
            </div>
          ))}
        </dl>
        {note.map((one) => (
          <div key={one.heading} className="border-t border-[#141310]/12 py-8">
            <h3 className="text-[19px] font-bold tracking-[-0.025em]">{one.heading}</h3>
            <p
              className="mt-2.5 max-w-[62ch] text-[15.5px] leading-[1.72] text-[#4A463E]"
              style={{ fontFamily: '"Instrument Sans", system-ui, sans-serif' }}
            >{one.body}</p>
          </div>
        ))}
      </div>
      {said.map((one) => <Statement key={one.heading} heading={one.heading} body={one.body} />)}
    </>
  )
}

// The front door opens on the work itself, before a word of explanation. Everything else on this
// page is a caption for it.
function HomeLayout({ page }: { page: Page }) {
  const index = page.bands.find((b) => b.points)
  const said = page.bands.filter((b) => b.tone === 'pigment')
  const last = page.bands[page.bands.length - 1]

  return (
    <>
      <Hero page={page} />
      <ProofBand />
      {said[0] && <Statement heading={said[0].heading} body={said[0].body} />}
      {index?.points && <Index points={index.points} />}
      {last && last.tone === 'paper' && (
        <div className="mx-auto max-w-[80rem] px-6 pt-24 pb-28">
          <h2 className="max-w-[16ch] font-bold leading-[1.06] tracking-[-0.035em]" style={{ fontSize: 'clamp(1.7rem,3.2vw,2.6rem)' }}>
            {last.heading}
          </h2>
          <p
            className="mt-5 max-w-[58ch] text-[17px] leading-[1.7] text-[#4A463E]"
            style={{ fontFamily: '"Instrument Sans", system-ui, sans-serif' }}
          >{last.body}</p>
        </div>
      )}
    </>
  )
}

export function SitePage() {
  const route = readRoute()
  const page = findPage(routePath()) ?? findPage('/')!

  useEffect(() => {
    document.title = page.title
    document.querySelector('meta[name="description"]')?.setAttribute('content', page.description)
    window.scrollTo(0, 0)
  }, [page])

  if (route.kind !== 'landing') return null

  const body = page.path === '/' ? <HomeLayout page={page} />
    : page.path === '/pricing' ? <PricingLayout page={page} />
      : page.path === '/self-hosting' ? <SpecLayout page={page} />
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
