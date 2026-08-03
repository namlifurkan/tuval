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

  if (!held) return <p className="text-sm text-[#8A867C]">{t('Reading…')}</p>

  const seats = share(held.seats, held.seat_limit)
  const bytes = share(held.bytes, held.byte_limit)
  const tight = nearlyFull(held.seats, held.seat_limit) || nearlyFull(held.bytes, held.byte_limit)

  const fills = (percent: number) => ({
    width: `${percent}%`,
    background: percent >= 90 ? '#C8664A' : percent >= 80 ? '#DE9A4E' : '#C8452D',
  })

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#E2DED5] bg-[#FCFBF8] p-3">
        <div className="flex flex-wrap items-baseline gap-2">
          <span className="text-[15px] font-semibold text-[#141310]">
            {held.plan === 'unlimited' ? t('Not billed') : held.plan === 'team' ? t('Team') : t('Free')}
          </span>
          {held.plan === 'unlimited' && (
            <span className="text-[11px] text-[#8A867C]">
              {t('this install does not bill this workspace')}
            </span>
          )}
          {held.plan === 'team' && held.until && (
            <span className="text-[11px] text-[#8A867C]">
              {t('paid until {day}', { day: held.until.slice(0, 10) })}
            </span>
          )}
          {held.plan === 'free' && (
            <span className="text-[11px] text-[#8A867C]">
              {t('the paid plan is not open yet')}
            </span>
          )}
        </div>

        <div className="mt-3 space-y-2.5">
          <div>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-[#8A867C]">{t('People')}</span>
              <span className="text-[#4A463E]">
                {held.seats}{uncapped(held.seat_limit) ? '' : ` / ${held.seat_limit}`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EFEBE2]">
              <div className="h-full rounded-full transition-[width]" style={fills(seats)} />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between text-[11px]">
              <span className="text-[#8A867C]">{t('Files')}</span>
              <span className="text-[#4A463E]">
                {readableBytes(held.bytes)}
                {uncapped(held.byte_limit) ? '' : ` / ${readableBytes(held.byte_limit)}`}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#EFEBE2]">
              <div className="h-full rounded-full transition-[width]" style={fills(bytes)} />
            </div>
          </div>
        </div>

        <p className="mt-2 text-[11px] text-[#B6B1A6]">
          {t('{n} records, which are not counted against anything.', { n: held.records })}
        </p>

        {tight && held.plan === 'free' && (
          <p className="mt-2 rounded-lg bg-[#F7E9E4] px-2 py-1.5 text-[11px] leading-snug text-[#C8452D]">
            {t('Close to a limit. Nothing is deleted when you reach one — new people and new files are refused until there is room.')}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {(['free', 'team'] as const).map((plan) => (
          <div
            key={plan}
            className={`rounded-xl border p-3
              ${held.plan === plan ? 'border-[#C8452D] bg-[#F7E9E4]' : 'border-[#E2DED5] bg-[#FCFBF8]'}`}
          >
            <span className="text-[13px] font-semibold text-[#141310]">
              {plan === 'team' ? t('Team') : t('Free')}
            </span>
            <span className="ml-2 text-[11px] text-[#8A867C]">
              {plan === 'team' ? t('not on sale yet') : t('nothing')}
            </span>
            <ul className="mt-2 space-y-1">
              {WHAT_YOU_GET[plan].map((line) => (
                <li key={line} className="flex gap-1.5 text-[12px] leading-snug text-[#4A463E]">
                  <Check size={12} className="mt-0.5 shrink-0 text-[#8FA96B]" />
                  {t(line, { seats: plan === 'free' ? 3 : 200, bytes: plan === 'free' ? '1 GB' : '10 GB' })}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">
        {t('The code is AGPL. Run it on your own machine and every limit here is yours to set — this price is for somebody else keeping the disks spinning.')}
      </p>
    </div>
  )
}
