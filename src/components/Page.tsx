import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronRight, FileText, Plus } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { openPage } from '../board/page'
import {
  ancestors, createRecord, getRecords, loadRecords, patchRecord, subscribeRecords,
} from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Shell } from './Shell'

// The editor is a third of the bundle and only a page needs it.
const PageEditor = lazy(() => import('./PageEditor').then((m) => ({ default: m.PageEditor })))

const pages = () => getRecords('doc')

export function Page() {
  const route = readRoute()
  const id = route.kind === 'page' ? route.id : ''
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, pages, pages)
  const [title, setTitle] = useState('')
  const [ready, setReady] = useState(false)
  const name = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!id) return
    let live = true
    void openPage(id).then(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [id])

  useEffect(() => {
    if (!workspace || !id) return
    void loadRecords('doc').then(() => {
      const row = getRecords('doc').find((r) => r.id === id)
      setTitle(row?.title ?? '')
      // A page that has never been named was made a moment ago, and naming it is the next thing
      // anyone does. A page with a title is one you came back to read.
      if (row && !row.title) name.current?.focus()
    })
  }, [workspace, id])

  if (!id) return null

  const trail = ancestors(rows, id)
  const children = rows.filter((r) => r.parent_id === id)

  return (
    <Shell title={title || t('Untitled page')}>
      {!!trail.length && (
        <nav aria-label={t('Breadcrumb')} className="mb-3 flex flex-wrap items-center gap-1">
          {trail.map((up) => (
            <span key={up.id} className="flex items-center gap-1">
              <a
                href={`/d/${up.id}`}
                onClick={(e) => { e.preventDefault(); go(`/d/${up.id}`) }}
                className="max-w-[22ch] truncate text-[12px] font-medium text-[#8A867C] hover:text-[#C8452D]"
              >
                {up.title || t('Untitled page')}
              </a>
              <ChevronRight size={12} className="text-[#C6C2B6]" />
            </span>
          ))}
        </nav>
      )}

      <input
        ref={name}
        value={title}
        onChange={(e) => { setTitle(e.target.value); patchRecord(id, { title: e.target.value }) }}
        placeholder={t('Untitled page')}
        className="w-full bg-transparent text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#141310] outline-none placeholder:text-[#C6C2B6]"
      />

      <div className="mt-5 -ml-[54px]">
        {ready && <Suspense fallback={null}><PageEditor /></Suspense>}
      </div>

      <section className="mt-10 border-t border-[#EAE6DD] pt-4">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
          {t('Inside this page')}
        </h2>
        <ul className="mt-2">
          {children.map((kid) => (
            <li key={kid.id}>
              <a
                href={`/d/${kid.id}`}
                onClick={(e) => { e.preventDefault(); go(`/d/${kid.id}`) }}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#141310] hover:bg-[#EAE6DD]"
              >
                <FileText size={14} className="shrink-0 text-[#8A867C]" />
                {kid.title || t('Untitled page')}
              </a>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={() => void createRecord('', 'doc', id).then((made) => made && go(`/d/${made}`))}
          className="mt-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
        >
          <Plus size={14} /> {t('Add a page inside')}
        </button>
      </section>
    </Shell>
  )
}
