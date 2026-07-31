import { lazy, Suspense, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { ChevronRight, CornerUpLeft, FileText, Plus, Table2 } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { relatedTo } from '../board/database'
import { backlinks } from '../board/mention'
import type { Backlink } from '../board/mention'
import { openPage } from '../board/page'
import {
  ancestors, createRecord, getPages, loadPages, patchRecord, subscribeRecords,
} from '../board/records'
import { getRecords } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Database } from './Database'
import { Cover } from './Cover'
import { IconPicker } from './IconPicker'
import { Shell } from './Shell'

// The editor is a third of the bundle and only a page needs it.
const PageEditor = lazy(() => import('./PageEditor').then((m) => ({ default: m.PageEditor })))

const pages = getPages

export function Page() {
  const route = readRoute()
  const id = route.kind === 'page' ? route.id : ''
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, pages, pages)
  const [title, setTitle] = useState('')
  const [ready, setReady] = useState(false)
  const name = useRef<HTMLInputElement>(null)
  const [links, setLinks] = useState<Backlink[]>([])

  useEffect(() => {
    if (!id) return
    let live = true
    void openPage(id).then(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [id])

  useEffect(() => {
    if (!workspace || !id) return
    void loadPages().then(() => {
      const row = getPages().find((r) => r.id === id)
      setTitle(row?.title ?? '')
      // A page that has never been named was made a moment ago, and naming it is the next thing
      // anyone does. A page with a title is one you came back to read.
      if (row && !row.title) name.current?.focus()
    })
  }, [workspace, id])

  // Read once on arrival rather than kept live: what points at a page changes when somebody
  // else writes, which is a different problem than what this page says.
  useEffect(() => {
    if (!workspace || !id) return
    let live = true
    void backlinks(id).then((found) => { if (live) setLinks(found) })
    return () => { live = false }
  }, [workspace, id])

  if (!id) return null

  const trail = ancestors(rows, id)
  const here = rows.find((r) => r.id === id)
  const database = here?.kind === 'database'
  const children = database ? [] : rows.filter((r) => r.parent_id === id)
  const icon = here?.icon ?? ''
  const cover = here?.cover ?? ''
  const related = here ? relatedTo(here, getRecords('database'), rows) : []

  return (
    <Shell title={title || t('Untitled page')}>
      {!!cover && <Cover id={id} path={cover} />}

      {!!trail.length && (
        <nav aria-label={t('Breadcrumb')} className="mb-3 flex flex-wrap items-center gap-1">
          {trail.map((up) => (
            <span key={up.id} className="flex items-center gap-1">
              <a
                href={`/d/${up.id}`}
                onClick={(e) => { e.preventDefault(); go(`/d/${up.id}`) }}
                className="max-w-[22ch] truncate text-[12px] font-medium text-[#8A867C] hover:text-[#C8452D]"
              >
                {up.icon && <span className="mr-1">{up.icon}</span>}
                {up.title || t('Untitled page')}
              </a>
              <ChevronRight size={12} className="text-[#C6C2B6]" />
            </span>
          ))}
        </nav>
      )}

      <div className="-ml-2 mb-1 flex items-center gap-1">
        <IconPicker value={icon} onPick={(emoji) => patchRecord(id, { icon: emoji })} />
        {!cover && <Cover id={id} path="" />}
      </div>

      <input
        ref={name}
        value={title}
        onChange={(e) => { setTitle(e.target.value); patchRecord(id, { title: e.target.value }) }}
        placeholder={t(database ? 'Untitled database' : 'Untitled page')}
        className="w-full bg-transparent text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#141310] outline-none placeholder:text-[#C6C2B6]"
      />

      {database
        ? <Database db={here} />
        : (
          <div className="mt-5 -ml-[54px]">
            {ready && <Suspense fallback={null}><PageEditor /></Suspense>}
          </div>
        )}

      {!!related.length && (
        <section className="mt-10 border-t border-[#EAE6DD] pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
            {t('Related to this')}
          </h2>
          <ul className="mt-2">
            {related.map(({ row, field, db }) => (
              <li key={`${row.id}:${field.id}`}>
                <a
                  href={`/d/${row.id}`}
                  onClick={(e) => { e.preventDefault(); go(`/d/${row.id}`) }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#141310] hover:bg-[#EAE6DD]"
                >
                  <Table2 size={14} className="shrink-0 text-[#8A867C]" />
                  <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled')}</span>
                  <span className="shrink-0 text-[11px] text-[#8A867C]">
                    {db.title || t('Untitled database')} · {field.name}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!!links.length && (
        <section className="mt-10 border-t border-[#EAE6DD] pt-4">
          <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
            {t('Linked from')}
          </h2>
          <ul className="mt-2">
            {links.map((from) => (
              <li key={from.id}>
                <a
                  href={`/d/${from.id}`}
                  onClick={(e) => { e.preventDefault(); go(`/d/${from.id}`) }}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-[#141310] hover:bg-[#EAE6DD]"
                >
                  <CornerUpLeft size={14} className="shrink-0 text-[#8A867C]" />
                  {from.title || t('Untitled page')}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!database && (
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
                {kid.icon
                  ? <span className="w-[14px] shrink-0 text-center leading-none">{kid.icon}</span>
                  : <FileText size={14} className="shrink-0 text-[#8A867C]" />}
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
      )}
    </Shell>
  )
}
