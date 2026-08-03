import { useEffect, useState, useSyncExternalStore } from 'react'
import { Plus, Table2 } from 'lucide-react'
import { go } from '../board/boards'
import { rowsOf } from '../board/database'
import {
  createRecord, getPages, getRecords, loadPages, patchRecord, subscribeRecords,
} from '../board/records'
import type { Record as Row } from '../board/records'
import { getScope, inScope, subscribeScope } from '../board/scope'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Shell } from './Shell'

const tables = () => getRecords('database')
const pages = getPages

// Where a database lives has not changed: it is a page-tree node with a page's address. This is
// the index the tree could not be — every table in the workspace on one screen, whatever branch
// somebody filed it under.
export function Databases() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const here = useSyncExternalStore(subscribeRecords, tables, tables)
  const all = useSyncExternalStore(subscribeRecords, pages, pages)
  const scope = useSyncExternalStore(subscribeScope, getScope, getScope)

  useEffect(() => { if (workspace) void loadPages() }, [workspace])

  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    const id = await createRecord('', 'database')
    if (id && scope) patchRecord(id, { project_id: scope })
    if (id) go(`/d/${id}`)
    else setBusy(false)
  }

  const mine = [...here]
    .filter((r: Row) => inScope(r, all))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))

  return (
    <Shell title={t('Databases')}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void add()}
        className="flex items-center gap-1.5 rounded-lg bg-pigment px-3 py-2 text-sm font-semibold text-on-pigment transition-colors hover:bg-pigment-deep disabled:opacity-40"
      >
        <Plus size={15} />{t('New database')}
      </button>

      {!mine.length ? (
        <p className="mt-6 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
          {t('No databases yet. A database is a page with columns: rows you can filter, group, and read back as a table, a board, a gallery or a calendar.')}
        </p>
      ) : (
        <div className="mt-5 divide-y divide-shade border-y border-shade">
          {mine.map((table: Row) => (
            <button
              key={table.id}
              type="button"
              onClick={() => go(`/d/${table.id}`)}
              className="flex w-full items-center gap-3 py-2.5 text-left hover:text-pigment-deep"
            >
              {table.icon
                ? <span className="shrink-0">{table.icon}</span>
                : <Table2 size={14} className="shrink-0 text-muted" />}
              <span className="min-w-0 flex-1 truncate text-sm text-ink">
                {table.title || t('Untitled database')}
              </span>
              <span className="shrink-0 text-[11.5px] tabular-nums text-dim">
                {t('{n} rows', { n: rowsOf(table.id).length })}
              </span>
            </button>
          ))}
        </div>
      )}
    </Shell>
  )
}
