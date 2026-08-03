import { Plus, X } from 'lucide-react'
import { today } from '../board/database'
import { addCycle, getCycles, removeCycle } from '../board/issues'
import type { Burn, Cycle } from '../board/issues'
import type { Record as Issue } from '../board/records'
import { getLang, t } from '../i18n'

// Two weeks at a time, and the one you are in said plainly. A cycle is the only thing on this
// screen with a deadline, so it is the only thing that gets a bar.
export function CycleBar({ rows, only, onPick, burn, current }: {
  rows: Issue[]
  only: string
  onPick: (id: string) => void
  burn: Burn | null
  current: Cycle | null
}) {
  const cycles = getCycles()
  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB'
  const day = (iso: string) =>
    new Date(`${iso}T00:00:00Z`)
      .toLocaleDateString(locale, { day: '2-digit', month: 'short', timeZone: 'UTC' })

  const named = (cycle: Cycle) => cycle.name || t('Cycle {n}', { n: cycle.number })
  const count = (id: string) => rows.filter((r) => r.cycle_id === id).length

  return (
    <div className="rounded-xl border border-hairline bg-surface p-3">
      <div className="flex flex-wrap items-center gap-1">
        <button
          type="button"
          onClick={() => onPick('')}
          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors
            ${!only ? 'bg-[#F7E9E4] text-pigment' : 'text-ink-soft hover:bg-shade'}`}
        >{t('Everything')}</button>

        {cycles.slice(0, 6).map((cycle) => (
          <span key={cycle.id} className="group flex items-center">
            <button
              type="button"
              onClick={() => onPick(cycle.id)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors
                ${only === cycle.id ? 'bg-[#F7E9E4] text-pigment' : 'text-ink-soft hover:bg-shade'}`}
            >
              {named(cycle)}
              {cycle.id === current?.id && <span className="ml-1 text-pigment">•</span>}
              <span className="ml-1.5 text-[#B6B1A6]">{count(cycle.id)}</span>
            </button>
            <button
              type="button"
              aria-label={t('Remove')}
              onClick={() => void removeCycle(cycle.id)}
              className="ml-0.5 grid h-5 w-5 place-items-center rounded text-muted opacity-0 hover:text-[#943321] group-hover:opacity-100"
            >
              <X size={10} />
            </button>
          </span>
        ))}

        <button
          type="button"
          onClick={() => void addCycle(today())}
          className="ml-auto flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-muted hover:bg-shade hover:text-ink"
        >
          <Plus size={12} /> {t('New cycle')}
        </button>
      </div>

      {!!current && !!burn && (
        <div className="mt-2 border-t border-shade pt-2">
          <div className="flex items-baseline justify-between text-[11px] text-muted">
            <span>
              {named(current)} · {day(current.starts_on)} – {day(current.ends_on)}
            </span>
            <span>
              {burn.closed}/{burn.total} {t('points')} · {burn.open} {t('open')} ·{' '}
              {burn.left} {t('days left')}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tint">
            <div
              className="h-full rounded-full bg-pigment transition-[width]"
              style={{ width: `${burn.total ? Math.round((burn.closed / burn.total) * 100) : 0}%` }}
            />
          </div>
        </div>
      )}

      {!cycles.length && (
        <p className="mt-2 text-[11px] leading-snug text-muted">
          {t('A cycle is two weeks of work. The next one starts where the last ended.')}
        </p>
      )}
    </div>
  )
}
