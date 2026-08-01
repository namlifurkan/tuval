import { useEffect, useMemo, useState } from 'react'
import { readRoute } from '../board/boards'
import { book, readPage, slotsFor, takenSlots } from '../board/booking'
import type { Page } from '../board/booking'
import { PRODUCT } from '../board/brand'
import { getLang, t } from '../i18n'

const box = 'w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2 text-sm outline-none focus:border-[#C8452D]'

// Shown to somebody with no account, in their own timezone, with nothing else on the page. The
// times offered are worked out from the owner's hours; whether one is allowed is decided by the
// database, so what is drawn here can only ever be a shorter list than what is permitted.
export function PublicBooking() {
  const route = readRoute()
  const slug = route.kind === 'booking' ? route.slug : ''
  const [page, setPage] = useState<Page | null>(null)
  const [taken, setTaken] = useState<string[]>([])
  const [ready, setReady] = useState(false)
  const [picked, setPicked] = useState<Date | null>(null)
  const [who, setWho] = useState('')
  const [mail, setMail] = useState('')
  const [note, setNote] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let live = true
    void Promise.all([readPage(slug), takenSlots(slug)]).then(([found, gone]) => {
      if (!live) return
      setPage(found)
      setTaken(gone)
      setReady(true)
    })
    return () => { live = false }
  }, [slug])

  const slots = useMemo(
    () => (page ? slotsFor(page, new Date(), page.horizon_days) : []),
    [page],
  )

  if (!ready) return null

  if (!page || !page.active) {
    return (
      <main className="mx-auto max-w-[34rem] px-6 py-24">
        <h1 className="text-[22px] font-bold text-[#141310]">{t('Nothing here')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4A463E]">
          {t('This link is closed, or it never existed.')}
        </p>
      </main>
    )
  }

  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB'
  const free = slots.filter((slot) => !taken.includes(slot.toISOString()))
  const byDay = new Map<string, Date[]>()
  for (const slot of free) {
    const key = slot.toLocaleDateString(locale, { weekday: 'long', day: '2-digit', month: 'long' })
    byDay.set(key, [...(byDay.get(key) ?? []), slot])
  }

  const send = async () => {
    if (!picked) return
    setSending(true)
    setFailed(false)
    const went = await book(slug, picked, who, mail, note)
    setSending(false)
    if (went) setDone(true)
    else { setFailed(true); void takenSlots(slug).then(setTaken) }
  }

  if (done) {
    return (
      <main className="mx-auto max-w-[34rem] px-6 py-24">
        <h1 className="text-[22px] font-bold text-[#141310]">{t('Booked')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4A463E]">
          {picked?.toLocaleString(locale, { dateStyle: 'full', timeStyle: 'short' })}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[40rem] px-6 pb-24 pt-16">
      <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#141310]">
        {page.title || t('A conversation')}
      </h1>
      {!!page.intro && (
        <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-[#4A463E]">{page.intro}</p>
      )}
      <p className="mt-1 text-[12px] text-[#8A867C]">
        {t('{n} min', { n: page.minutes })} · {Intl.DateTimeFormat().resolvedOptions().timeZone}
      </p>

      {!free.length && (
        <p className="mt-8 text-sm text-[#8A867C]">{t('Nothing free just now.')}</p>
      )}

      <div className="mt-7 space-y-4">
        {[...byDay.entries()].slice(0, 14).map(([day, times]) => (
          <div key={day}>
            <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
              {day}
            </span>
            <div className="mt-1 flex flex-wrap gap-1.5">
              {times.map((slot) => (
                <button
                  key={slot.toISOString()}
                  type="button"
                  onClick={() => setPicked(slot)}
                  className={`rounded-md border px-2.5 py-1 text-[13px] transition-colors
                    ${picked?.getTime() === slot.getTime()
                      ? 'border-[#C8452D] bg-[#C8452D] text-white'
                      : 'border-[#E2DED5] bg-[#FCFBF8] text-[#141310] hover:border-[#C8452D]'}`}
                >
                  {slot.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {!!picked && (
        <form
          className="mt-8 max-w-[26rem] space-y-3 border-t border-[#E2DED5] pt-5"
          onSubmit={(e) => { e.preventDefault(); void send() }}
        >
          <input value={who} onChange={(e) => setWho(e.target.value)} placeholder={t('Your name')} className={box} />
          <input type="email" value={mail} onChange={(e) => setMail(e.target.value)} placeholder={t('Your email')} className={box} />
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder={t('What is it about?')} className={`${box} resize-none`} />
          <button
            type="submit"
            disabled={sending}
            className="rounded-lg bg-[#C8452D] px-4 py-2 text-sm font-semibold text-white hover:bg-[#A83621] disabled:opacity-40"
          >{sending ? t('Sending…') : t('Book it')}</button>
          {failed && (
            <p className="text-[12px] text-[#DC2626]">{t('That time has gone. Pick another.')}</p>
          )}
        </form>
      )}

      <p className="mt-16 border-t border-[#E2DED5] pt-4 text-[11px] text-[#B6B1A6]">
        {t('Published with {product}', { product: PRODUCT.name })}
      </p>
    </main>
  )
}
