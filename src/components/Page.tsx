import { lazy, Suspense, useEffect, useState, useSyncExternalStore } from 'react'
import { readRoute } from '../board/boards'
import { openPage } from '../board/page'
import { getRecords, loadRecords, patchRecord } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Shell } from './Shell'

// The editor is a third of the bundle and only a page needs it.
const PageEditor = lazy(() => import('./PageEditor').then((m) => ({ default: m.PageEditor })))

export function Page() {
  const route = readRoute()
  const id = route.kind === 'page' ? route.id : ''
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const [title, setTitle] = useState('')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!id) return
    let live = true
    void openPage(id).then(() => { if (live) setReady(true) })
    return () => { live = false }
  }, [id])

  useEffect(() => {
    if (!workspace || !id) return
    void loadRecords('doc').then(() => {
      setTitle(getRecords().find((r) => r.id === id)?.title ?? '')
    })
  }, [workspace, id])

  if (!id) return null

  return (
    <Shell title={title || t('Untitled page')}>
      <input
        value={title}
        onChange={(e) => { setTitle(e.target.value); patchRecord(id, { title: e.target.value }) }}
        placeholder={t('Untitled page')}
        className="w-full bg-transparent text-[30px] font-bold leading-tight tracking-[-0.02em] text-[#141310] outline-none placeholder:text-[#C6C2B6]"
      />

      <div className="mt-5 -ml-[54px]">
        {ready && <Suspense fallback={null}><PageEditor /></Suspense>}
      </div>
    </Shell>
  )
}
