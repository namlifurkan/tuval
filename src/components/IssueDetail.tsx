import { useState } from 'react'
import { X } from 'lucide-react'
import { archiveRecord, patchRecord, PRIORITIES, STATUSES } from '../board/records'
import type { Record as Issue, Status } from '../board/records'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'

const field = 'w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-sm outline-none focus:border-[#C8452D]'

// A card you cannot open is half a feature. This is the panel, not a page: the list stays where
// it was, so closing it puts you back exactly where you were looking.
export function IssueDetail({ issue, team, nameOf, onClose }: {
  issue: Issue
  team: Teammate[]
  nameOf: (id: string | null) => string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const set = (changes: Parameters<typeof patchRecord>[1]) => patchRecord(issue.id, changes)

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[380px] overflow-y-auto border-l border-[#E2DED5] bg-[#FCFBF8] p-5 shadow-[-3px_0_0_rgba(20,19,16,0.06)]">
      <div className="flex items-start gap-3">
        <textarea
          value={issue.title}
          onChange={(e) => set({ title: e.target.value })}
          rows={2}
          className="min-w-0 flex-1 resize-none bg-transparent text-[17px] font-semibold leading-snug text-[#141310] outline-none"
        />
        <button
          type="button"
          onClick={onClose}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-[#EFEBE2]"
        >
          <X size={15} />
        </button>
      </div>

      <textarea
        value={issue.description}
        onChange={(e) => set({ description: e.target.value })}
        rows={6}
        placeholder={t('What needs doing, and what done looks like')}
        className="mt-3 w-full resize-none bg-transparent text-sm leading-[1.65] text-[#4A463E] outline-none placeholder:text-[#C6C2B6]"
      />

      <dl className="mt-2 grid grid-cols-[5.5rem_1fr] items-center gap-x-3 gap-y-2.5">
        <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">{t('Status')}</dt>
        <dd>
          <select value={issue.status ?? 'todo'} onChange={(e) => set({ status: e.target.value as Status })} className={field}>
            {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
          </select>
        </dd>

        <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">{t('Assignee')}</dt>
        <dd>
          <select value={issue.assignee ?? ''} onChange={(e) => set({ assignee: e.target.value || null })} className={field}>
            <option value="">{t('Nobody')}</option>
            {team.map((m) => (
              <option key={m.userId} value={m.userId}>{nameOf(m.userId) || t('Member')}</option>
            ))}
          </select>
        </dd>

        <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">{t('Priority')}</dt>
        <dd>
          <select
            value={issue.priority ?? 0}
            onChange={(e) => set({ priority: Number(e.target.value) })}
            className={field}
          >
            {PRIORITIES.map((label, level) => <option key={label} value={level}>{t(label)}</option>)}
          </select>
        </dd>

        <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">{t('Due')}</dt>
        <dd>
          <input
            type="date"
            value={issue.due_at ? issue.due_at.slice(0, 10) : ''}
            onChange={(e) => set({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className={field}
          />
        </dd>
      </dl>

      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={() => { void navigator.clipboard.writeText(`${location.origin}/i/${issue.id}`); setCopied(true) }}
          className="flex-1 rounded-lg border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1.5 text-sm font-semibold text-[#141310] hover:border-[#C8452D] hover:text-[#C8452D]"
        >
          {copied ? t('Copied') : t('Copy link')}
        </button>
        <button
          type="button"
          onClick={() => { void archiveRecord(issue.id); onClose() }}
          className="flex-1 rounded-lg px-2 py-1.5 text-sm font-semibold text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
        >
          {t('Archive')}
        </button>
      </div>
    </aside>
  )
}
