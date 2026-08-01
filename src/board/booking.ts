import { nanoid } from 'nanoid'
import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// A booking link, small enough to be worth having and not a calendar. What decides whether a
// time is allowed lives in the database, so the page below is only a way of showing the answer.
export interface Page {
  id: string
  slug: string
  title: string
  intro: string
  minutes: number
  weekdays: number[]
  opens_at: string
  closes_at: string
  zone: string
  horizon_days: number
  notice_hours: number
  active: boolean
}

const COLUMNS =
  'id, slug, title, intro, minutes, weekdays, opens_at, closes_at, zone, horizon_days, '
  + 'notice_hours, active'

export const bookingUrl = (page: Page) => `${location.origin}/t/${page.slug}`

// Whatever the machine says, because that is where the person setting this up actually is.
export const hereZone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Istanbul'

export async function myPage(): Promise<Page | null> {
  const me = getUser()?.id
  if (!supabase || !me) return null
  const { data } = await supabase
    .from('booking_pages').select(COLUMNS).eq('owner', me).maybeSingle()
  return (data as unknown as Page) ?? null
}

export async function makePage(title: string): Promise<Page | null> {
  const ws = getWorkspace()
  const me = getUser()
  if (!supabase || !ws || !me) return null
  const handle = (me.email ?? 'me').split('@')[0].replace(/[^a-z0-9]+/gi, '').toLowerCase()
  const { data } = await supabase.from('booking_pages').insert({
    workspace_id: ws.id,
    owner: me.id,
    slug: `${handle || 'me'}-${nanoid(5)}`,
    title,
    zone: hereZone(),
  }).select(COLUMNS).single()
  return (data as unknown as Page) ?? null
}

export async function setPage(id: string, changes: Partial<Page>) {
  if (!supabase) return
  await supabase.from('booking_pages').update(changes).eq('id', id)
}

export async function dropPage(id: string) {
  if (!supabase) return
  await supabase.from('booking_pages').delete().eq('id', id)
}

export async function readPage(slug: string): Promise<Page | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('booking_pages').select(COLUMNS).eq('slug', slug).maybeSingle()
  return (data as unknown as Page) ?? null
}

export async function takenSlots(slug: string): Promise<string[]> {
  if (!supabase) return []
  const { data } = await supabase.rpc('taken_slots', { page_slug: slug })
  return ((data ?? []) as string[]).map((iso) => new Date(iso).toISOString())
}

export async function book(
  slug: string,
  at: Date,
  who: string,
  mail: string,
  note: string,
): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('book_slot', {
    page_slug: slug,
    at: at.toISOString(),
    who,
    mail,
    note,
  })
  return !error && !!data
}

// The slots on offer, worked out in the owner's timezone and handed back as instants. The page
// draws them in whatever timezone the visitor is in, which is the one thing about this that
// crosses a border and so the one thing that has to be an instant rather than a clock reading.
export function slotsFor(page: Page, from: Date, days: number): Date[] {
  const out: Date[] = []
  const [openH, openM] = page.opens_at.split(':').map(Number)
  const [shutH, shutM] = page.closes_at.split(':').map(Number)
  const span = (shutH * 60 + shutM) - (openH * 60 + openM)
  if (span <= 0) return out

  const earliest = from.getTime() + page.notice_hours * 3600_000

  for (let day = 0; day < days; day++) {
    // Midday of the day being asked about, in the owner's zone, so that reading its date parts
    // is not thrown off by an hour either way.
    const noon = new Date(from.getTime() + day * 86400000)
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: page.zone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short',
    }).formatToParts(noon)
    const on = (kind: string) => parts.find((p) => p.type === kind)?.value ?? ''
    const weekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(on('weekday')) + 1
    if (!page.weekdays.includes(weekday)) continue

    for (let at = 0; at + page.minutes <= span; at += page.minutes) {
      const minutes = openH * 60 + openM + at
      const clock = `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
      const slot = zoned(`${on('year')}-${on('month')}-${on('day')}`, clock, page.zone)
      if (slot.getTime() >= earliest) out.push(slot)
    }
  }
  return out
}

// A clock reading in a named zone, as an instant. Worked out by asking what that instant looks
// like in that zone and correcting by the difference, which is the way to do this without a
// timezone library and without being wrong twice a year.
function zoned(day: string, clock: string, zone: string): Date {
  const guess = new Date(`${day}T${clock}:00Z`)
  const shown = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(guess)
  const at = (kind: string) => Number(shown.find((p) => p.type === kind)?.value ?? 0)
  const asShown = Date.UTC(at('year'), at('month') - 1, at('day'), at('hour') % 24, at('minute'), at('second'))
  return new Date(guess.getTime() + (guess.getTime() - asShown))
}
