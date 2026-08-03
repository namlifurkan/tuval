import { useEffect, useState, useSyncExternalStore } from 'react'
import { Repeat, Trash2 } from 'lucide-react'
import { addRule, dropRule, getRules, loadRules, setRule, subscribeRules } from '../board/recurring'
import type { Every } from '../board/recurring'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'

const EVERY: Every[] = ['day', 'week', 'month']
const rules = getRules
const field = 'rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-1 text-xs outline-none'

export function Recurring() {
  const ws = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const held = useSyncExternalStore(subscribeRules, rules, rules)
  const [team, setTeam] = useState<Teammate[]>([])
  const [title, setTitle] = useState('')
  const [every, setEvery] = useState<Every>('week')

  useEffect(() => {
    if (!ws) return
    void loadRules()
    void listTeam().then(setTeam)
  }, [ws])

  const add = () => {
    if (!title.trim()) return
    void addRule(title, every)
    setTitle('')
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder={t('Standup note, invoice, backup check…')}
          className="flex-1 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2.5 py-1.5 text-sm outline-none focus:border-[#C8452D]"
        />
        <select value={every} onChange={(e) => setEvery(e.target.value as Every)} className={field}>
          {EVERY.map((e) => <option key={e} value={e}>{t(`every ${e}`)}</option>)}
        </select>
        <button
          type="button"
          onClick={add}
          className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white hover:bg-[#A83621]"
        >{t('Add')}</button>
      </div>

      <div className="mt-2 divide-y divide-[#EAE6DD] rounded-xl border border-[#E2DED5] bg-[#FCFBF8]">
        {held.map((rule) => (
          <div key={rule.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
            <Repeat size={12} className={rule.active ? 'text-[#C8452D]' : 'text-[#C6C2B6]'} />
            <span className={`min-w-0 flex-1 truncate text-[13px]
              ${rule.active ? 'text-[#141310]' : 'text-[#B6B1A6]'}`}
            >{rule.title}</span>
            <span className="shrink-0 text-[11px] text-[#8A867C]">{t(`every ${rule.every}`)}</span>
            <span className="shrink-0 text-[11px] text-[#B6B1A6]">
              {t('next {day}', { day: rule.next_on })}
            </span>
            <select
              value={rule.assignee ?? ''}
              onChange={(e) => void setRule(rule.id, { assignee: e.target.value || null })}
              className={field}
            >
              <option value="">{t('Nobody')}</option>
              {team.map((m) => (
                <option key={m.userId} value={m.userId}>{m.email.split('@')[0] || t('Member')}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void setRule(rule.id, { active: !rule.active })}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#8A867C] hover:text-[#141310]"
            >{rule.active ? t('On') : t('Off')}</button>
            <button
              type="button"
              aria-label={t('Delete')}
              onClick={() => void dropRule(rule.id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#F7E9E4] hover:text-[#A83621]"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}
        {!held.length && (
          <p className="px-3 py-2.5 text-[12px] text-[#8A867C]">{t('Nothing repeats yet.')}</p>
        )}
      </div>
    </div>
  )
}
