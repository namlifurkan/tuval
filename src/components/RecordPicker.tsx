import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { issueKey } from '../board/issues'
import { getPages, getRecords, loadPages, loadRecords, subscribeRecords } from '../board/records'
import type { Record as Row } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'

const issues = () => getRecords('issue')
const projects = () => getRecords('project')

const KIND_NAMES: { [kind: string]: string } = {
  issue: 'Issue', doc: 'Page', database: 'Database', project: 'Project',
}

// Everything a card can stand for, in one list, because somebody looking for "the launch" does
// not know or care whether it was written down as an issue or a page.
export function RecordPicker({ onPick }: { onPick: (rows: Row[]) => void }) {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const work = useSyncExternalStore(subscribeRecords, issues, issues)
  const pages = useSyncExternalStore(subscribeRecords, getPages, getPages)
  const plans = useSyncExternalStore(subscribeRecords, projects, projects)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!workspace) return
    void loadRecords('issue')
    void loadRecords('project')
    void loadPages()
  }, [workspace])

  const prefix = workspace?.prefix ?? ''
  const found = useMemo(() => {
    const all = [...work, ...pages, ...plans]
    const needle = query.trim().toLowerCase()
    const hits = needle
      ? all.filter((r) => r.title.toLowerCase().includes(needle)
        || issueKey(r, prefix).toLowerCase().includes(needle))
      : all
    return hits.slice(0, 60)
  }, [work, pages, plans, query, prefix])

  if (!workspace) {
    return (
      <p className="px-1 py-2 text-[12px] leading-snug text-muted">
        {t('Sign in to put work on a board.')}
      </p>
    )
  }

  return (
    <div>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t('Search issues, pages and projects')}
        className="mb-1.5 w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-sm text-ink outline-none placeholder:text-faint focus:border-pigment"
      />
      <div className="max-h-[280px] overflow-y-auto">
        {!found.length && (
          <p className="px-1 py-2 text-[12px] text-muted">{t('Nothing to show.')}</p>
        )}
        {found.map((row) => {
          const key = row.kind === 'issue' ? issueKey(row, prefix) : ''
          return (
            <button
              key={row.id}
              type="button"
              onClick={() => onPick([row])}
              className="flex w-full items-baseline gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-tint"
            >
              <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-faint">
                {t(KIND_NAMES[row.kind] ?? row.kind)}
              </span>
              <span className="truncate text-sm text-ink">{row.title || t('Untitled')}</span>
              {key && <span className="ml-auto shrink-0 text-[11px] tabular-nums text-muted">{key}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}
