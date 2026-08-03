import { useEffect, useState, useSyncExternalStore } from 'react'
import { Plus } from 'lucide-react'
import {
  addLabel, getLabels, labelsOn, loadLabels, loadWorn, subscribeIssues, toggleLabel,
} from '../board/issues'
import { patchRecord, STATUSES } from '../board/records'
import type { Record as Row, Status } from '../board/records'
import { displayName } from '../board/supabase'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { Popover } from './Popover'
import { ProjectPicker } from './ProjectPicker'

const labels = getLabels

// A page that is not a row in a database still has things worth saying about it: whose it is,
// where it has got to, when it is wanted. The columns are already on every record, so this is
// not a new shape of data — only the four of them shown on the one screen that never showed them.
export function PageProps({ row, locked }: { row: Row; locked?: boolean }) {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const known = useSyncExternalStore(subscribeIssues, labels, labels)
  const [team, setTeam] = useState<Teammate[]>([])
  const [typed, setTyped] = useState('')

  useEffect(() => {
    if (!workspace) return
    void listTeam().then(setTeam)
    void loadLabels()
    void loadWorn()
  }, [workspace])

  const worn = labelsOn(row.id)
  const set = (changes: Parameters<typeof patchRecord>[1]) => patchRecord(row.id, changes)

  const field = 'rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] text-ink outline-none hover:bg-shade focus:border-pigment focus:bg-surface disabled:hover:bg-transparent'
  const label = 'w-[76px] shrink-0 text-[11px] font-bold uppercase tracking-[0.13em] text-muted'

  return (
    <dl className="mt-3 space-y-0.5">
      <div className="flex items-center">
        <dt className={label}>{t('Status')}</dt>
        <dd>
          <select
            disabled={locked}
            value={row.status ?? ''}
            onChange={(e) => set({ status: (e.target.value || null) as Status | null })}
            className={field}
          >
            <option value="">{t('Nothing')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
          </select>
        </dd>
      </div>

      <div className="flex items-center">
        <dt className={label}>{t('Owner')}</dt>
        <dd>
          <select
            disabled={locked}
            value={row.assignee ?? ''}
            onChange={(e) => set({ assignee: e.target.value || null })}
            className={field}
          >
            <option value="">{t('Nobody')}</option>
            {team.map((m) => (
              <option key={m.userId} value={m.userId}>{displayName(m.email) || t('Member')}</option>
            ))}
          </select>
        </dd>
      </div>

      <div className="flex items-center">
        <dt className={label}>{t('Project')}</dt>
        <dd>
          <ProjectPicker
            value={row.project_id}
            onPick={(project) => set({ project_id: project })}
          />
        </dd>
      </div>

      <div className="flex items-center">
        <dt className={label}>{t('Due')}</dt>
        <dd>
          <input
            type="date"
            disabled={locked}
            value={row.due_at ? row.due_at.slice(0, 10) : ''}
            onChange={(e) => set({ due_at: e.target.value ? new Date(e.target.value).toISOString() : null })}
            className={field}
          />
        </dd>
      </div>

      <div className="flex min-h-[30px] items-center">
        <dt className={label}>{t('Tags')}</dt>
        <dd className="flex flex-wrap items-center gap-1">
          {known.filter((l) => worn.includes(l.id)).map((l) => (
            <button
              key={l.id}
              type="button"
              disabled={locked}
              onClick={() => void toggleLabel(row.id, l.id)}
              className="rounded px-1.5 py-0.5 text-[11px] font-semibold text-ink"
              style={{ background: l.tone }}
            >{l.name}</button>
          ))}
          {!locked && (
            <Popover
              width={200}
              trigger={({ toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  className="grid h-5 w-5 place-items-center rounded text-[#B6B1A6] hover:bg-shade hover:text-ink"
                  title={t('Add a tag')}
                ><Plus size={13} /></button>
              )}
            >
              {(close) => (
                <>
                  <input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter' || !typed.trim()) return
                      void addLabel(typed).then((made) => { if (made) void toggleLabel(row.id, made.id) })
                      setTyped('')
                      close()
                    }}
                    placeholder={t('Find or make one')}
                    className="mb-1 w-full rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] outline-none focus:border-pigment"
                  />
                  {known
                    .filter((l) => l.name.toLowerCase().includes(typed.trim().toLowerCase()))
                    .map((l) => (
                      <button
                        key={l.id}
                        type="button"
                        onClick={() => { void toggleLabel(row.id, l.id); close() }}
                        className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-left text-[12px] hover:bg-shade"
                      >
                        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: l.tone }} />
                        <span className="min-w-0 flex-1 truncate">{l.name}</span>
                        {worn.includes(l.id) && <span className="text-muted">✓</span>}
                      </button>
                    ))}
                </>
              )}
            </Popover>
          )}
        </dd>
      </div>
    </dl>
  )
}
