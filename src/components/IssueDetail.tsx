import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { X } from 'lucide-react'
import {
  addLabel, getCycles, getLabels, issueKey, labelsOn, subscribeIssues, toggleLabel,
} from '../board/issues'
import { archiveRecord, getRecords, patchRecord, PRIORITIES, STATUSES } from '../board/records'
import type { Record as Issue, Status } from '../board/records'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { openRecordBody } from '../board/pageBody'
import { IssueLinks } from './IssueLinks'
import { RecordHistory } from './RecordHistory'
import { TimeLog } from './TimeLog'
import { Popover } from './Popover'

const cycles = getCycles
const labels = getLabels

// The editor is a third of the bundle, and a list of issues does not need it until one is open.
const PageEditor = lazy(() => import('./PageEditor').then((m) => ({ default: m.PageEditor })))

const field = 'w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-sm outline-none focus:border-[#C8452D]'

// A card you cannot open is half a feature. This is the panel, not a page: the list stays where
// it was, so closing it puts you back exactly where you were looking.
export function IssueDetail({ issue, team, nameOf, prefix, onClose }: {
  issue: Issue
  team: Teammate[]
  nameOf: (id: string | null) => string
  prefix: string
  onClose: () => void
}) {
  const [copied, setCopied] = useState(false)
  const [typed, setTyped] = useState('')
  const known = useSyncExternalStore(subscribeIssues, labels, labels)
  const rounds = useSyncExternalStore(subscribeIssues, cycles, cycles)
  const worn = labelsOn(issue.id)
  const set = (changes: Parameters<typeof patchRecord>[1]) => patchRecord(issue.id, changes)
  const projects = getRecords('project')
  const [ready, setReady] = useState(false)

  // The body is bound after it has loaded, for the same reason a page is: an editor mounted on
  // an empty document writes an empty paragraph into it, and that paragraph outlives the load.
  useEffect(() => {
    let live = true
    setReady(false)
    void openRecordBody(issue.id).then(() => { if (live) setReady(true) })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [issue.id])

  return (
    <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-[560px] overflow-y-auto border-l border-[#E2DED5] bg-[#FCFBF8] p-5 shadow-[-3px_0_0_rgba(20,19,16,0.06)]">
      <div className="mb-1 flex items-center gap-2">
        <span className="font-mono text-[11px] text-[#B6B1A6]">{issueKey(issue, prefix)}</span>
      </div>

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

      <div className="mt-2 -ml-[54px]">
        {ready && (
          <Suspense fallback={null}>
            <PageEditor key={issue.id} title={issue.title} />
          </Suspense>
        )}
      </div>

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

        <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">{t('Estimate')}</dt>
        <dd>
          <input
            type="number"
            min={0}
            max={999}
            value={issue.estimate ?? ''}
            onChange={(e) => set({ estimate: e.target.value === '' ? null : Number(e.target.value) })}
            className={field}
          />
        </dd>

        <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">{t('Cycle')}</dt>
        <dd>
          <select
            value={issue.cycle_id ?? ''}
            onChange={(e) => set({ cycle_id: e.target.value || null })}
            className={field}
          >
            <option value="">{t('No cycle')}</option>
            {rounds.map((c) => (
              <option key={c.id} value={c.id}>{c.name || t('Cycle {n}', { n: c.number })}</option>
            ))}
          </select>
        </dd>

        <dt className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">{t('Project')}</dt>
        <dd>
          <select
            value={issue.project_id ?? ''}
            onChange={(e) => set({ project_id: e.target.value || null })}
            className={field}
          >
            <option value="">{t('No project')}</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.title || t('Untitled')}</option>
            ))}
          </select>
        </dd>
      </dl>

      <div className="mt-4">
        <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
          {t('Labels')}
        </span>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {known.filter((l) => worn.includes(l.id)).map((label) => (
            <button
              key={label.id}
              type="button"
              onClick={() => void toggleLabel(issue.id, label.id)}
              title={t('Remove')}
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#141310]"
              style={{ background: label.tone }}
            >{label.name}</button>
          ))}

          <Popover
            width={200}
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="rounded-md border border-dashed border-[#D8D5CD] px-1.5 py-0.5 text-[11px] font-semibold text-[#8A867C] hover:border-[#C8452D] hover:text-[#C8452D]"
              >+ {t('Label')}</button>
            )}
          >
            {() => (
              <>
                <input
                  autoFocus
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key !== 'Enter' || !typed.trim()) return
                    void addLabel(typed.trim()).then((made) => {
                      if (made) void toggleLabel(issue.id, made.id)
                      setTyped('')
                    })
                  }}
                  placeholder={t('Find or create')}
                  className="mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none focus:border-[#C8452D]"
                />
                {known
                  .filter((l) => l.name.toLowerCase().includes(typed.trim().toLowerCase()))
                  .map((label) => (
                    <button
                      key={label.id}
                      type="button"
                      onClick={() => void toggleLabel(issue.id, label.id)}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left hover:bg-[#EAE6DD]"
                    >
                      <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px]
                        ${worn.includes(label.id) ? 'border-[#C8452D] bg-[#C8452D] text-white' : 'border-[#D8D5CD]'}`}
                      >{worn.includes(label.id) ? '✓' : ''}</span>
                      <span
                        className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-[#141310]"
                        style={{ background: label.tone }}
                      >{label.name}</span>
                    </button>
                  ))}
              </>
            )}
          </Popover>
        </div>
      </div>

      <TimeLog record={issue.id} team={team} />

      <IssueLinks issue={issue} prefix={prefix} />

      <RecordHistory record={issue} nameOf={nameOf} />

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
