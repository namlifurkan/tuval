import { useEffect, useState } from 'react'
import { bookingUrl, dropPage, makePage, myPage, setPage } from '../board/booking'
import type { Page } from '../board/booking'
import { t } from '../i18n'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const LENGTHS = [15, 30, 45, 60, 90]
const field = 'rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-1 text-xs outline-none'

// Your own booking link. One per person, because "my link" is how anybody refers to it.
export function BookingSetup() {
  const [page, setHeld] = useState<Page | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { void myPage().then(setHeld) }, [])

  const change = (changes: Partial<Page>) => {
    if (!page) return
    setHeld({ ...page, ...changes })
    void setPage(page.id, changes)
  }

  if (!page) {
    return (
      <button
        type="button"
        onClick={() => void makePage(t('A conversation')).then(setHeld)}
        className="rounded-lg bg-[#C8452D] px-3 py-2 text-sm font-semibold text-white hover:bg-[#A83621]"
      >{t('Make a booking link')}</button>
    )
  }

  return (
    <div className="rounded-xl border border-[#E2DED5] bg-[#FCFBF8] p-3">
      <input
        value={page.title}
        onChange={(e) => change({ title: e.target.value })}
        placeholder={t('What is being booked?')}
        className="w-full bg-transparent text-[15px] font-semibold text-[#141310] outline-none"
      />
      <textarea
        value={page.intro}
        onChange={(e) => change({ intro: e.target.value })}
        placeholder={t('A line for whoever is booking')}
        rows={2}
        className="mt-1 w-full resize-none bg-transparent text-[13px] leading-relaxed text-[#4A463E] outline-none placeholder:text-[#C6C2B6]"
      />

      <div className="mt-2 flex flex-wrap items-center gap-1">
        {DAYS.map((day, i) => {
          const on = page.weekdays.includes(i + 1)
          return (
            <button
              key={day}
              type="button"
              aria-pressed={on}
              onClick={() => change({
                weekdays: on
                  ? page.weekdays.filter((d) => d !== i + 1)
                  : [...page.weekdays, i + 1].sort(),
              })}
              className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors
                ${on ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#8A867C] hover:bg-[#EAE6DD]'}`}
            >{t(day)}</button>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#8A867C]">
        <input
          type="time"
          value={page.opens_at.slice(0, 5)}
          onChange={(e) => change({ opens_at: e.target.value })}
          className={field}
        />
        <span>—</span>
        <input
          type="time"
          value={page.closes_at.slice(0, 5)}
          onChange={(e) => change({ closes_at: e.target.value })}
          className={field}
        />
        <select
          value={page.minutes}
          onChange={(e) => change({ minutes: Number(e.target.value) })}
          className={field}
        >
          {LENGTHS.map((m) => <option key={m} value={m}>{t('{n} min', { n: m })}</option>)}
        </select>
        <span className="text-[#B6B1A6]">{page.zone}</span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[#8A867C]">
        <label className="flex items-center gap-1">
          {t('at least')}
          <input
            type="number"
            min={0}
            max={336}
            value={page.notice_hours}
            onChange={(e) => change({ notice_hours: Number(e.target.value) })}
            className={`${field} w-[62px]`}
          />
          {t('hours notice')}
        </label>
        <label className="flex items-center gap-1">
          {t('up to')}
          <input
            type="number"
            min={1}
            max={120}
            value={page.horizon_days}
            onChange={(e) => change({ horizon_days: Number(e.target.value) })}
            className={`${field} w-[62px]`}
          />
          {t('days ahead')}
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#EAE6DD] pt-2">
        <button
          type="button"
          onClick={() => change({ active: !page.active })}
          className="rounded-md px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
        >{page.active ? t('Open') : t('Closed')}</button>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(bookingUrl(page))
            setCopied(true)
            setTimeout(() => setCopied(false), 1600)
          }}
          className="min-w-0 flex-1 truncate rounded-md px-2 py-1 text-left text-[11px] text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
        >{copied ? t('Copied') : bookingUrl(page)}</button>
        <button
          type="button"
          onClick={() => void dropPage(page.id).then(() => setHeld(null))}
          className="rounded-md px-2 py-1 text-[12px] text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >{t('Delete')}</button>
      </div>
    </div>
  )
}
