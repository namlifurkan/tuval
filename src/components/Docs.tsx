import { useEffect, useState, useSyncExternalStore } from 'react'
import { Plus } from 'lucide-react'
import { go } from '../board/boards'
import { archiveRecord, createRecord, getRecords, loadRecords, subscribeRecords } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Shell } from './Shell'

export function Docs() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const records = useSyncExternalStore(subscribeRecords, getRecords, getRecords)

  useEffect(() => { if (workspace) void loadRecords('doc') }, [workspace])

  const [busy, setBusy] = useState(false)
  const add = async () => {
    setBusy(true)
    const id = await createRecord('', 'doc')
    if (id) go(`/d/${id}`)
    else setBusy(false)
  }

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

      <div className="mt-5 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
        {records.map((page) => (
          <div key={page.id} className="group flex items-center gap-3 py-2.5">
            <button
              type="button"
              onClick={() => go(`/d/${page.id}`)}
              className="min-w-0 flex-1 truncate text-left text-sm text-[#141310] hover:text-[#C8452D]"
            >
              {page.title || t('Untitled page')}
            </button>
            <button
              type="button"
              onClick={() => void archiveRecord(page.id)}
              className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-[#8A867C] opacity-0 transition-opacity hover:text-[#DC2626] group-hover:opacity-100"
            >
              {t('Archive')}
            </button>
          </div>
        ))}
      </div>

      {!records.length && (
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
          {t('No pages yet. A page is a record like anything else: it has a title you can search for, and a body two people can write at once.')}
        </p>
      )}
    </Shell>
  )
}
