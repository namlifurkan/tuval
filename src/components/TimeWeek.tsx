import { useEffect, useState, useSyncExternalStore } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addDays, today } from '../board/database'
import { loadTime, readable, subscribeTime, timeVersion, weekOf, weekTable } from '../board/time'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { getLang, t } from '../i18n'

// The week as a table: a line per person, a column per day. Every number is read from the stints
// themselves, so no total here can disagree with the entries it came from.
export function TimeWeek() {
  const ws = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  useSyncExternalStore(subscribeTime, timeVersion, timeVersion)
  const [team, setTeam] = useState<Teammate[]>([])
  const [at, setAt] = useState(today())

  useEffect(() => {
    if (!ws) return
    void loadTime()
    void listTeam().then(setTeam)
  }, [ws])

  const days = weekOf(at)
  const rows = weekTable(days, team.map((m) => m.userId)).filter((r) => r.total)
  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB'
  const label = (iso: string) =>
    new Date(`${iso}T00:00:00Z`)
      .toLocaleDateString(locale, { weekday: 'short', day: '2-digit', timeZone: 'UTC' })

  const nameOf = (id: string) =>
    team.find((m) => m.userId === id)?.email.split('@')[0] ?? t('Member')

  return (
    <div>
      <div className="mb-2 flex items-center gap-1">
        <button
          type="button"
          aria-label={t('Previous month')}
          onClick={() => setAt(addDays(at, -7))}
          className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-shade"
        >
          <ChevronLeft size={14} />
        </button>
        <button
          type="button"
          aria-label={t('Next month')}
          onClick={() => setAt(addDays(at, 7))}
          className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-shade"
        >
          <ChevronRight size={14} />
        </button>
        <span className="ml-1 text-[12px] font-semibold text-ink">
          {label(days[0])} – {label(days[6])}
        </span>
        <button
          type="button"
          onClick={() => setAt(today())}
          className="ml-2 rounded-md px-2 py-0.5 text-[11px] font-semibold text-muted hover:bg-shade"
        >{t('This week')}</button>
      </div>

      {!rows.length ? (
        <p className="text-sm text-muted">{t('Nobody has logged any time this week.')}</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
          {/* Its natural width, not the container's: nine columns squeezed into a settings panel
              is nine columns nobody can read. The box beside it scrolls instead. */}
          <table className="w-full min-w-max border-collapse whitespace-nowrap text-[12px]">
            <thead>
              <tr>
                <th scope="col" className="border-b border-hairline px-3 py-2 text-left font-bold uppercase tracking-[0.1em] text-muted">
                  {t('Member')}
                </th>
                {days.map((day) => (
                  <th
                    key={day}
                    scope="col"
                    className={`border-b border-hairline px-2 py-2 text-right font-bold uppercase tracking-[0.1em]
                      ${day === today() ? 'text-pigment' : 'text-muted'}`}
                  >{label(day)}</th>
                ))}
                <th scope="col" className="border-b border-hairline px-3 py-2 text-right font-bold uppercase tracking-[0.1em] text-ink">
                  {t('Total')}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.user} className="border-b border-shade last:border-0">
                  <th scope="row" className="px-3 py-1.5 text-left font-normal text-ink">
                    {nameOf(row.user)}
                  </th>
                  {row.days.map((minutes, i) => (
                    <td key={days[i]} className="px-2 py-1.5 text-right text-ink-soft">
                      {minutes ? readable(minutes) : <span className="text-[#D8D5CD]">·</span>}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right font-semibold text-ink">
                    {readable(row.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
