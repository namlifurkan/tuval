import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { go } from '../board/boards'
import { dayOf, monthGrid, monthKey, setCell, shiftMonth, today } from '../board/database'
import type { Field, View } from '../board/database'
import { createRecord, getPages } from '../board/records'
import type { Record as Row } from '../board/records'
import { getLang, t } from '../i18n'

const dayNumber = (iso: string) => Number(iso.slice(8, 10))

// A calendar is a database view, so the rows are the same rows and dragging one to another day
// writes the column it is placed by. Nothing here is a second store of events.
export function DatabaseCalendar({ db, rows, view, fields }: {
  db: Row
  rows: Row[]
  view: View
  fields: Field[]
}) {
  const [month, setMonth] = useState(() => monthKey(today()))
  const [over, setOver] = useState('')
  const placing = fields.find((f) => f.id === view.dateBy)

  if (!placing) {
    return (
      <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
        {t('A calendar places rows by a date column. Add one, then choose it above.')}
      </p>
    )
  }

  const days = monthGrid(month)
  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB'
  const heading = new Date(`${month}-01T00:00:00Z`)
    .toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const weekdays = days.slice(0, 7).map((iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }))

  const on = (iso: string) => rows.filter((r) => dayOf(r, placing.id) === iso)

  const drop = (iso: string) => (e: React.DragEvent) => {
    e.preventDefault()
    setOver('')
    const id = e.dataTransfer.getData('text/plain')
    const row = rows.find((r) => r.id === id)
    if (row) setCell(row, placing.id, iso)
  }

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          aria-label={t('Previous month')}
          onClick={() => setMonth((was) => shiftMonth(was, -1))}
          className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-shade hover:text-ink"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          aria-label={t('Next month')}
          onClick={() => setMonth((was) => shiftMonth(was, 1))}
          className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-shade hover:text-ink"
        >
          <ChevronRight size={14} />
        </button>
        <span className="ml-1 text-sm font-semibold capitalize text-ink">{heading}</span>
        <button
          type="button"
          onClick={() => setMonth(monthKey(today()))}
          className="ml-2 rounded-md px-2 py-0.5 text-[11px] font-semibold text-muted hover:bg-shade"
        >{t('Today')}</button>
      </div>

      <div className="grid grid-cols-7 border-l border-t border-hairline">
        {weekdays.map((name) => (
          <div
            key={name}
            className="border-b border-r border-hairline px-2 py-1 text-[11px] font-bold uppercase tracking-[0.1em] text-muted"
          >{name}</div>
        ))}

        {days.map((iso) => {
          const outside = monthKey(iso) !== month
          const now = iso === today()
          return (
            <div
              key={iso}
              onDragOver={(e) => { e.preventDefault(); setOver(iso) }}
              onDragLeave={() => setOver((was) => (was === iso ? '' : was))}
              onDrop={drop(iso)}
              className={`group min-h-[92px] border-b border-r border-hairline p-1
                ${outside ? 'bg-[#F7F5F0]' : ''} ${over === iso ? 'ring-1 ring-inset ring-pigment' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px]
                    ${now ? 'bg-pigment font-bold text-white' : outside ? 'text-[#C6C2B6]' : 'text-muted'}`}
                >{dayNumber(iso)}</span>
                <button
                  type="button"
                  aria-label={t('New row')}
                  onClick={() => void createRecord('', 'doc', db.id).then((id) => {
                    const made = getPages().find((r) => r.id === id)
                    if (made) setCell(made, placing.id, iso)
                  })}
                  className="rounded px-1 text-[13px] leading-none text-muted opacity-0 hover:bg-shade hover:text-pigment focus-visible:opacity-100 group-hover:opacity-100"
                >+</button>
              </div>

              {on(iso).map((row) => (
                <button
                  key={row.id}
                  type="button"
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData('text/plain', row.id)}
                  onClick={() => go(`/d/${row.id}`)}
                  className="mt-1 block w-full truncate rounded-md border border-hairline bg-surface px-1.5 py-1 text-left text-[12px] text-ink hover:border-pigment"
                >
                  {row.icon && <span className="mr-1">{row.icon}</span>}
                  {row.title || t('Untitled')}
                </button>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
