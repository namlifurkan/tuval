import { useEffect, useState, useSyncExternalStore } from 'react'
import { FileText, Plus, Trash2 } from 'lucide-react'
import { go } from '../board/boards'
import {
  ancestors, archiveRecord, createRecord, deleteRecord, emptyOldTrash, emptyPages, emptyTrash,
  getPages, getTrash, loadPages, loadTrash, patchRecord, restoreRecord, subscribeRecords,
} from '../board/records'
import type { Record as Row } from '../board/records'
import { removeCover } from '../board/cover'
import { TRASH_DAYS } from '../board/cloud'
import { getScope, inScope, subscribeScope } from '../board/scope'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { ImportButton } from './ImportButton'
import { KitPicker } from './KitPicker'
import { Shell } from './Shell'

const pages = getPages
const trash = getTrash

function when(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
  return t('{n} d ago', { n: Math.floor(mins / 1440) })
}

// The sidebar answers "where does this page live". This answers "what was I doing", which is a
// different question and the reason the two are not the same list.
export function Docs() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const records = useSyncExternalStore(subscribeRecords, pages, pages)
  const binned = useSyncExternalStore(subscribeRecords, trash, trash)
  const scope = useSyncExternalStore(subscribeScope, getScope, getScope)

  useEffect(() => {
    if (!workspace) return
    void loadPages()
    void loadTrash().then(() => emptyOldTrash(removeCover))
  }, [workspace])

  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    const id = await createRecord('', 'doc')
    // Made while looking at one project, so it lands in that project rather than nowhere.
    if (id && scope) patchRecord(id, { project_id: scope })
    if (id) go(`/d/${id}`)
    else setBusy(false)
  }

  const recent = [...records]
    .filter((r) => inScope(r, records))
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 40)

  const sweep = async () => {
    const bare = await emptyPages()
    if (!bare.length) { alert(t('No empty pages — everything here has something on it.')); return }
    if (!confirm(t('Move {n} empty pages to the trash? Nothing is written on any of them, and the trash keeps them for {days} days.', { n: bare.length, days: TRASH_DAYS }))) return
    for (const page of bare) await archiveRecord(page.id)
    await Promise.all([loadPages(), loadTrash()])
  }

  const burn = async () => {
    if (!confirm(t('Empty the trash? {n} pages go for good.', { n: binned.length }))) return
    await emptyTrash(removeCover)
    await loadTrash()
  }

  return (
    <Shell title={t('Docs')}>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void add()}
          className="flex items-center gap-1.5 rounded-lg bg-pigment px-3 py-2 text-sm font-semibold text-on-pigment transition-colors hover:bg-pigment-deep disabled:opacity-40"
        >
          <Plus size={15} strokeWidth={2.4} /> {t('New page')}
        </button>
        <ImportButton />
        <KitPicker />
      </div>

      <div className="mt-10 flex items-baseline justify-between gap-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
          {t('Recently edited')}
        </h2>
        <button
          type="button"
          onClick={() => void sweep()}
          className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[12px] font-semibold text-muted hover:bg-pigment-wash hover:text-pigment-deep"
        >
          <Trash2 size={12} /> {t('Clear out empty pages')}
        </button>
      </div>

      <div className="mt-2 divide-y divide-shade border-y border-shade">
        {recent.map((page) => {
          const trail = ancestors(records, page.id)
          return (
            <div key={page.id} className="group -mx-2 flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-shade/60">
              <button
                type="button"
                onClick={() => go(`/d/${page.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-[14.5px] font-medium text-ink group-hover:text-pigment">
                  {page.icon
                    ? <span className="mr-2">{page.icon}</span>
                    : <FileText size={13} className="mr-2 inline-block -translate-y-px text-dim" />}
                  {page.title || t('Untitled page')}
                </span>
                {!!trail.length && (
                  <span className="mt-0.5 block truncate pl-[1.35rem] text-[11.5px] text-faint">
                    {trail.map((up) => up.title || t('Untitled page')).join(' / ')}
                  </span>
                )}
              </button>
              <span className="shrink-0 text-[11.5px] tabular-nums text-dim">{when(page.updated_at)}</span>
              <button
                type="button"
                onClick={() => void archiveRecord(page.id).then(loadTrash)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted opacity-0 transition-opacity hover:text-pigment-deep group-hover:opacity-100"
              >
                {t('Archive')}
              </button>
            </div>
          )
        })}
      </div>

      {!!binned.length && (
        <>
          <h2 className="mt-9 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            {t('Trash')}
          </h2>
          <p className="mt-1 max-w-[62ch] text-[12px] leading-relaxed text-muted">
            {t('Emptied automatically after {n} days. Until then a page here can be brought back exactly as it was.', { n: TRASH_DAYS })}
          </p>
          <button
            type="button"
            onClick={() => void burn()}
            className="mt-2 rounded-lg px-2 py-1 text-[12px] font-semibold text-muted hover:bg-pigment-wash hover:text-pigment-deep"
          >{t('Empty it now')}</button>
          <div className="mt-2 divide-y divide-shade border-y border-shade">
            {binned.map((page: Row) => (
              <div key={page.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-muted">
                  {page.icon && <span className="mr-1.5">{page.icon}</span>}
                  {page.title || t(page.kind === 'database' ? 'Untitled database' : 'Untitled page')}
                </span>
                <button
                  type="button"
                  onClick={() => void restoreRecord(page)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-pigment hover:bg-pigment-wash"
                >{t('Restore')}</button>
                <button
                  type="button"
                  onClick={() => {
                    const name = page.title || t('Untitled page')
                    if (confirm(t('Delete "{name}" for good? This cannot be undone.', { name }))) {
                      void deleteRecord(page, removeCover)
                    }
                  }}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-muted hover:bg-pigment-wash hover:text-pigment-deep"
                >{t('Delete for good')}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {!records.length && (
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-ink-soft">
          {t('No pages yet. A page is a record like anything else: it has a title you can search for, and a body two people can write at once.')}
        </p>
      )}
    </Shell>
  )
}
