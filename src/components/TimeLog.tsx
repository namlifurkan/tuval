import { useState, useSyncExternalStore } from 'react'
import { Timer, X } from 'lucide-react'
import { getUser } from '../board/supabase'
import {
  dropStint, logTime, minutesOn, readable, readMinutes, stintsOn, subscribeTime, timeVersion,
} from '../board/time'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'

// Logging time has to be one box and one key, or it does not get done. Everything else about it
// — the week, the totals — is a question asked later of what was written here.
export function TimeLog({ record, team }: { record: string; team: Teammate[] }) {
  useSyncExternalStore(subscribeTime, timeVersion, timeVersion)
  const [typed, setTyped] = useState('')
  const [note, setNote] = useState('')
  const mine = getUser()?.id ?? ''

  const total = minutesOn(record)
  const held = stintsOn(record)

  const add = () => {
    const minutes = readMinutes(typed)
    if (!minutes) return
    void logTime(record, minutes, note)
    setTyped('')
    setNote('')
  }

  const nameOf = (id: string) =>
    team.find((m) => m.userId === id)?.email.split('@')[0] ?? t('Member')

  return (
    <div className="mt-4">
      <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
        <Timer size={11} /> {t('Time')}
        {!!total && <span className="text-[#141310]">{readable(total)}</span>}
      </span>

      <div className="mt-1 flex gap-1">
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder={t('45, 1h30, 2h')}
          className="w-[86px] shrink-0 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1 text-[12px] outline-none focus:border-[#C8452D]"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') add() }}
          placeholder={t('What on?')}
          className="min-w-0 flex-1 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1 text-[12px] outline-none focus:border-[#C8452D]"
        />
      </div>

      {held.map((stint) => (
        <div key={stint.id} className="group/stint mt-1 flex items-center gap-2 rounded-md px-1 py-0.5 text-[12px] hover:bg-[#EFEBE2]">
          <span className="w-[52px] shrink-0 font-mono text-[11px] text-[#141310]">
            {readable(stint.minutes)}
          </span>
          <span className="min-w-0 flex-1 truncate text-[#4A463E]">
            {stint.note || t('no note')}
          </span>
          <span className="shrink-0 text-[10px] text-[#B6B1A6]">
            {nameOf(stint.user_id)} · {stint.spent_on.slice(5)}
          </span>
          {stint.user_id === mine && (
            <button
              type="button"
              aria-label={t('Remove')}
              onClick={() => void dropStint(stint.id)}
              className="shrink-0 text-[#B6B1A6] opacity-0 hover:text-[#DC2626] group-hover/stint:opacity-100"
            >
              <X size={11} />
            </button>
          )}
        </div>
      ))}
    </div>
  )
}
