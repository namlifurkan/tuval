import { useEffect, useSyncExternalStore } from 'react'
import { Check } from 'lucide-react'
import {
  getUsage, loadUsage, nearlyFull, readableBytes, share, subscribePlan, uncapped,
  WHAT_YOU_GET,
} from '../board/plan'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'

const usage = getUsage

// What the workspace is using and what it may use. Written as a bill rather than as a
// billboard: somebody looking at this wants to know whether they are about to hit a wall.
export function PlanPanel() {
  const ws = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const held = useSyncExternalStore(subscribePlan, usage, usage)

  useEffect(() => { if (ws) void loadUsage() }, [ws])

  if (!held) return <p className="text-sm text-muted">{t('Reading…')}</p>

  const seats = share(held.seats, held.seat_limit)
  const bytes = share(held.bytes, held.byte_limit)
  const tight = nearlyFull(held.seats, held.seat_limit) || nearlyFull(held.bytes, held.byte_limit)

  const fills = (percent: number) => ({
    width: `${percent}%`,
    background: percent >= 90 ? '#C8664A' : percent >= 80 ? '#DE9A4E' : '#B43E28',
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-hairline bg-surface p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[15px] font-semibold text-ink">
            {held.plan === 'unlimited' ? t('Not billed') : held.plan === 'team' ? t('Team') : t('Free')}
          </span>
          {held.plan === 'unlimited' && (
            <span className="text-[11px] text-muted">
              {t('this install does not bill this workspace')}
            </span>
          )}
          {held.plan === 'team' && held.until && (
            <span className="text-[11px] text-muted">
              {t('paid until {day}', { day: held.until.slice(0, 10) })}
            </span>
          )}
          {held.plan === 'free' && (
            <span className="text-[11px] text-muted">
              {t('the paid plan is not open yet')}
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2.5">
          <div>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted">{t('People')}</span>
              <span className="text-ink-soft">
                {held.seats}{uncapped(held.seat_limit) ? '' : ` / ${held.seat_limit}`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tint">
              <div className="h-full rounded-full transition-[width]" style={fills(seats)} />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-muted">{t('Files')}</span>
              <span className="text-ink-soft">
                {readableBytes(held.bytes)}
                {uncapped(held.byte_limit) ? '' : ` / ${readableBytes(held.byte_limit)}`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tint">
              <div className="h-full rounded-full transition-[width]" style={fills(bytes)} />
            </div>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-faint">
          {t('{n} records, which are not counted against anything.', { n: held.records })}
        </p>

        {tight && held.plan === 'free' && (
          <p className="mt-2 rounded-lg bg-pigment-wash px-2 py-1.5 text-[11px] leading-snug text-pigment">
            {t('Close to a limit. Nothing is deleted when you reach one — new people and new files are refused until there is room.')}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['free', 'team'] as const).map((plan) => (
          <div
            key={plan}
            className={`rounded-xl border p-3
              ${held.plan === plan ? 'border-pigment bg-pigment-wash' : 'border-hairline bg-surface'}`}
          >
            <span className="text-[13px] font-semibold text-ink">
              {plan === 'team' ? t('Team') : t('Free')}
            </span>
            <span className="ml-2 text-[11px] text-muted">
              {plan === 'team' ? t('not on sale yet') : t('nothing')}
            </span>
            <ul className="mt-2 space-y-1">
              {WHAT_YOU_GET[plan].map((line) => (
                <li key={line} className="flex gap-1.5 text-[12px] leading-snug text-ink-soft">
                  <Check size={12} className="mt-0.5 shrink-0 text-ok" />
                  {t(line, { seats: plan === 'free' ? 3 : 200, bytes: plan === 'free' ? '1 GB' : '10 GB' })}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="max-w-[62ch] text-[12px] leading-relaxed text-muted">
        {t('The code is AGPL. Run it on your own machine and every limit here is yours to set — this price is for somebody else keeping the disks spinning.')}
      </p>
    </div>
  )
}
