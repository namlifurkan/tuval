import { useEffect, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { go } from '../board/boards'
import { marksBetween } from '../board/calendar'
import type { Mark, MarkKind } from '../board/calendar'
import { monthGrid, monthKey, shiftMonth, today } from '../board/database'
import { getCycles, loadCycles, subscribeIssues } from '../board/issues'
import { createRecord, getRecords, loadRecords, patchRecord, subscribeRecords } from '../board/records'
import { getRules, loadRules, subscribeRules } from '../board/recurring'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { getLang, t } from '../i18n'
import { Shell } from './Shell'

const dayNumber = (iso: string) => Number(iso.slice(8, 10))

const issues = () => getRecords('issue')

// A day is written the way every other screen writes one: UTC midnight, read back with the first
// ten characters.
const stampOf = (iso: string) => new Date(iso).toISOString()

const TAG: { [K in MarkKind]: string } = {
  issue: '', page: '', row: '', project: 'Project', cycle: 'Cycle', rule: 'Repeats',
}

export function Calendar() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  useSyncExternalStore(subscribeRecords, issues, issues)
  useSyncExternalStore(subscribeIssues, getCycles, getCycles)
  useSyncExternalStore(subscribeRules, getRules, getRules)

  const [month, setMonth] = useState(() => monthKey(today()))
  const [over, setOver] = useState('')

  useEffect(() => {
    if (!workspace) return
    void loadRecords('issue')
    void loadRecords('project')
    void loadCycles()
    void loadRules()
  }, [workspace])

  const days = monthGrid(month)
  const marks = marksBetween(days[0], days[days.length - 1])
  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB'
  const heading = new Date(`${month}-01T00:00:00Z`)
    .toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const weekdays = days.slice(0, 7).map((iso) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(locale, { weekday: 'short', timeZone: 'UTC' }))

  const on = (iso: string) => marks.filter((m) => m.day === iso)

  const drop = (iso: string) => (e: React.DragEvent) => {
    e.preventDefault()
    setOver('')
    const id = e.dataTransfer.getData('text/plain')
    if (id && marks.some((m) => m.id === id && m.movable)) patchRecord(id, { due_at: stampOf(iso) })
  }

  const chip = (mark: Mark) => (
    <button
      key={mark.id}
      type="button"
      draggable={mark.movable}
      onDragStart={(e) => e.dataTransfer.setData('text/plain', mark.id)}
      onClick={() => go(mark.href)}
      className="mt-1 flex w-full items-center gap-1 truncate rounded-md border border-hairline bg-surface px-1.5 py-1 text-left text-[12px] text-ink hover:border-pigment"
    >
      {mark.icon && <span>{mark.icon}</span>}
      {TAG[mark.kind] && (
        <span className="shrink-0 text-[9px] font-bold uppercase tracking-[0.1em] text-muted">
          {t(TAG[mark.kind])}
        </span>
      )}
      <span className="truncate">{mark.title || t('Untitled')}</span>
    </button>
  )

  return (
    <Shell title={t('Calendar')} wide>
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

      <p className="mb-3 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
        {t('Every date the workspace already holds, on one month. Nothing is stored here twice: move a card and the record it came from is what changes.')}
      </p>

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
              className={`group min-h-[104px] border-b border-r border-hairline p-1
                ${outside ? 'bg-raise' : ''} ${over === iso ? 'ring-1 ring-inset ring-pigment' : ''}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`grid h-5 w-5 place-items-center rounded-full text-[11px]
                    ${now ? 'bg-pigment font-bold text-on-pigment' : outside ? 'text-dim' : 'text-muted'}`}
                >{dayNumber(iso)}</span>
                <button
                  type="button"
                  aria-label={t('New issue')}
                  onClick={() => void createRecord('', 'issue').then((id) => {
                    if (id) { patchRecord(id, { due_at: stampOf(iso) }); go(`/i/${id}`) }
                  })}
                  className="rounded px-1 text-[13px] leading-none text-muted opacity-0 hover:bg-shade hover:text-pigment focus-visible:opacity-100 group-hover:opacity-100"
                >+</button>
              </div>

              {on(iso).map(chip)}
            </div>
          )
        })}
      </div>
    </Shell>
  )
}
