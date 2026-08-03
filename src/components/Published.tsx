import { useEffect, useState } from 'react'
import { readRoute } from '../board/boards'
import { PRODUCT } from '../board/brand'
import { openPage } from '../board/page'
import { readPublished } from '../board/pageAccess'
import type { Record as Row } from '../board/records'
import { t } from '../i18n'
import { PageReader } from './PageReader'

// A published page read by somebody who may have no account at all: no sidebar, no workspace,
// nothing to click into. The page and a line saying where it came from.
export function Published() {
  const route = readRoute()
  const slug = route.kind === 'published' ? route.slug : ''
  const [page, setPage] = useState<Row | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    void readPublished(slug).then(async (found) => {
      if (!live) return
      setPage(found)
      if (found) await openPage(found.id)
      if (live) setReady(true)
    })
    return () => { live = false }
  }, [slug])

  if (!ready) return null

  if (!page) {
    return (
      <main className="mx-auto max-w-[46rem] px-6 py-24">
        <h1 className="text-[22px] font-bold text-ink">{t('Nothing here')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          {t('This page is not published, or it was published and then taken down.')}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[46rem] px-6 pb-24 pt-16">
      <h1 className="text-[30px] font-bold leading-tight tracking-[-0.02em] text-ink">
        {page.icon && <span className="mr-2">{page.icon}</span>}
        {page.title || t('Untitled page')}
      </h1>
      <div className="mt-6"><PageReader /></div>
      <p className="mt-16 border-t border-hairline pt-4 text-[11px] text-[#B6B1A6]">
        {t('Published with {product}', { product: PRODUCT.name })}
      </p>
    </main>
  )
}
