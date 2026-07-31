import { useEffect, useState, useSyncExternalStore } from 'react'
import { Plus } from 'lucide-react'
import { go } from '../board/boards'
import {
  ancestors, archiveRecord, createRecord, deleteRecord, emptyOldTrash, getPages, getTrash,
  loadPages, loadTrash, restoreRecord, subscribeRecords,
} from '../board/records'
import type { Record as Row } from '../board/records'
import { removeCover } from '../board/cover'
import { TRASH_DAYS } from '../board/cloud'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
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

  useEffect(() => {
    if (!workspace) return
    void loadPages()
    void loadTrash().then(() => emptyOldTrash(removeCover))
  }, [workspace])

  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    const id = await createRecord('', 'doc')
    if (id) go(`/d/${id}`)
    else setBusy(false)
  }

  const recent = [...records]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 40)

  return (
    <Shell title={t('Docs')}>
      <button
        type="button"
        disabled={busy}
        onClick={() => void add()}
        className="flex items-center gap-1.5 rounded-lg bg-[#C8452D] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A83621] disabled:opacity-40"
      >
        <Plus size={15} strokeWidth={2.4} /> {t('New page')}
      </button>

      <h2 className="mt-8 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
        {t('Recently edited')}
      </h2>

      <div className="mt-2 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
        {recent.map((page) => {
          const trail = ancestors(records, page.id)
          return (
            <div key={page.id} className="group flex items-center gap-3 py-2.5">
              <button
                type="button"
                onClick={() => go(`/d/${page.id}`)}
                className="min-w-0 flex-1 text-left"
              >
                <span className="block truncate text-sm text-[#141310] group-hover:text-[#C8452D]">
                  {page.icon && <span className="mr-1.5">{page.icon}</span>}
                  {page.title || t('Untitled page')}
                </span>
                {!!trail.length && (
                  <span className="mt-0.5 block truncate text-[11px] text-[#8A867C]">
                    {trail.map((up) => up.title || t('Untitled page')).join(' / ')}
                  </span>
                )}
              </button>
              <span className="shrink-0 text-[11px] text-[#B6B1A6]">{when(page.updated_at)}</span>
              <button
                type="button"
                onClick={() => void archiveRecord(page.id).then(loadTrash)}
                className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-[#8A867C] opacity-0 transition-opacity hover:text-[#DC2626] group-hover:opacity-100"
              >
                {t('Archive')}
              </button>
            </div>
          )
        })}
      </div>

      {!!binned.length && (
        <>
          <h2 className="mt-9 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
            {t('Trash')}
          </h2>
          <p className="mt-1 max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">
            {t('Emptied automatically after {n} days. Until then a page here can be brought back exactly as it was.', { n: TRASH_DAYS })}
          </p>
          <div className="mt-2 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
            {binned.map((page: Row) => (
              <div key={page.id} className="flex items-center gap-3 py-2.5">
                <span className="min-w-0 flex-1 truncate text-sm text-[#8A867C]">
                  {page.icon && <span className="mr-1.5">{page.icon}</span>}
                  {page.title || t(page.kind === 'database' ? 'Untitled database' : 'Untitled page')}
                </span>
                <button
                  type="button"
                  onClick={() => void restoreRecord(page)}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#C8452D] hover:bg-[#F7E9E4]"
                >{t('Restore')}</button>
                <button
                  type="button"
                  onClick={() => {
                    const name = page.title || t('Untitled page')
                    if (confirm(t('Delete "{name}" for good? This cannot be undone.', { name }))) {
                      void deleteRecord(page, removeCover)
                    }
                  }}
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                >{t('Delete for good')}</button>
              </div>
            ))}
          </div>
        </>
      )}

      {!records.length && (
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
          {t('No pages yet. A page is a record like anything else: it has a title you can search for, and a body two people can write at once.')}
        </p>
      )}
    </Shell>
  )
}
