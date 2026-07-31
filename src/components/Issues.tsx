import { useEffect, useState, useSyncExternalStore } from 'react'
import { archiveRecord, createRecord, getRecords, loadRecords, patchRecord, STATUSES, subscribeRecords } from '../board/records'
import type { Status } from '../board/records'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { initials } from '../board/me'
import { t } from '../i18n'
import { Trash2 } from 'lucide-react'
import { Shell } from './Shell'

const TONE: { [K in Status]: string } = {
  todo: '#8A867C',
  doing: '#DE9A4E',
  blocked: '#C8664A',
  done: '#5E9A8A',
  cancelled: '#C6C2B6',
}

function Dot({ status }: { status: Status | null }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
      style={{ background: status ? TONE[status] : '#D6D1C6' }}
    />
  )
}

export function Issues() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const records = useSyncExternalStore(subscribeRecords, getRecords, getRecords)
  const [team, setTeam] = useState<Teammate[]>([])
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Status | 'all'>('all')

  useEffect(() => {
    if (!workspace) return
    void loadRecords('issue')
    void listTeam().then(setTeam)
  }, [workspace])

  const shown = filter === 'all'
    ? records
    : records.filter((r) => r.status === filter)

  const add = async () => {
    const text = title.trim()
    if (!text) return
    setTitle('')
    await createRecord(text)
  }

  const nameOf = (id: string | null) => {
    if (!id) return ''
    const mate = team.find((m) => m.userId === id)
    return mate?.email?.split('@')[0] ?? ''
  }

  return (
    <Shell title={t('Issues')}>
      <div className="flex flex-wrap items-center gap-1.5">
        {(['all', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors
              ${filter === s ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
          >
            {t(s)}
            {s !== 'all' && (
              <span className="ml-1.5 text-[#B6B1A6]">
                {records.filter((r) => r.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
        placeholder={t('Write an issue and press enter')}
        className="mt-5 w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#C8452D]"
      />

      <div className="mt-5 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
        {shown.map((issue) => (
          <div key={issue.id} className="group flex items-center gap-3 py-2.5">
            <Dot status={issue.status} />

            <input
              value={issue.title}
              onChange={(e) => void patchRecord(issue.id, { title: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-sm text-[#141310] outline-none focus:underline focus:decoration-[#C8452D] focus:underline-offset-4"
            />

            {issue.assignee && (
              <span
                title={nameOf(issue.assignee)}
                className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#3E5C93] text-[10px] font-bold text-white"
              >
                {initials(nameOf(issue.assignee) || '?')}
              </span>
            )}

            <select
              value={issue.assignee ?? ''}
              onChange={(e) => void patchRecord(issue.id, { assignee: e.target.value || null })}
              className="shrink-0 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1 py-0.5 text-xs outline-none"
            >
              <option value="">{t('Nobody')}</option>
              {team.map((m) => (
                <option key={m.userId} value={m.userId}>{m.email.split('@')[0] || t('Member')}</option>
              ))}
            </select>

            <select
              value={issue.status ?? 'todo'}
              onChange={(e) => void patchRecord(issue.id, { status: e.target.value as Status })}
              className="shrink-0 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1 py-0.5 text-xs outline-none"
            >
              {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
            </select>

            <button
              type="button"
              title={t('Archive')}
              onClick={() => void archiveRecord(issue.id)}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] opacity-0 transition-opacity hover:bg-[#FEF2F2] hover:text-[#DC2626] group-hover:opacity-100"
            >
              <Trash2 size={13} />
            </button>
          </div>
        ))}
      </div>

      {!shown.length && (
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
          {records.length
            ? t('Nothing with that status.')
            : t('No issues yet. They live in the workspace, not on a board, so they are here whichever board you were last in.')}
        </p>
      )}
    </Shell>
  )
}
