import { useEffect, useState } from 'react'
import { ExternalLink, LayoutGrid, FileText } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { PRODUCT } from '../board/brand'
import { published, readProfile } from '../board/publicProfile'
import type { Profile as Person, Shown } from '../board/publicProfile'
import { t } from '../i18n'
import { Wordmark } from './Logo'

// Somebody's own page, read by anybody, account or not. What is on it is what they chose to
// open: nothing here is gathered, ranked or recommended.
export function Profile() {
  const route = readRoute()
  const handle = route.kind === 'profile' ? route.handle : ''
  const [person, setPerson] = useState<Person | null>(null)
  const [shown, setShown] = useState<Shown[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let live = true
    void readProfile(handle).then(async (found) => {
      if (!live) return
      setPerson(found)
      if (found) setShown(await published(found.user_id))
      if (live) setReady(true)
    })
    return () => { live = false }
  }, [handle])

  if (!ready) return null

  if (!person) {
    return (
      <main className="mx-auto max-w-[46rem] px-6 py-24">
        <h1 className="text-[22px] font-bold text-[#141310]">{t('Nobody here')}</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#4A463E]">
          {t('There is no page at this address.')}
        </p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-[46rem] px-6 pb-24 pt-14">
      <header className="flex items-start gap-4">
        {person.avatar
          ? <img src={person.avatar} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
          : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-[#EBE7DE] text-[22px] font-bold text-[#8A867C]">
              {(person.name || person.handle).slice(0, 1).toUpperCase()}
            </span>
          )}
        <div className="min-w-0 flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.02em] text-[#141310]">
            {person.name || person.handle}
          </h1>
          <p className="mt-0.5 text-[13px] text-[#8A867C]">@{person.handle}</p>
          {person.bio && (
            <p className="mt-2 max-w-[54ch] text-[14px] leading-relaxed text-[#4A463E]">{person.bio}</p>
          )}
        </div>
      </header>

      {!!person.links?.length && (
        <div className="mt-5 flex flex-wrap gap-1.5">
          {person.links.map((link) => (
            <a
              key={link.url}
              href={link.url}
              target="_blank"
              rel="noopener nofollow ugc"
              className="flex items-center gap-1.5 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2.5 py-1.5 text-[13px] font-semibold text-[#4A463E] transition-colors hover:border-[#C8452D] hover:text-[#C8452D]"
            >
              {link.label || new URL(link.url).hostname.replace(/^www\./, '')}
              <ExternalLink size={12} />
            </a>
          ))}
        </div>
      )}

      <h2 className="mt-10 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
        {t('Out in the open')}
      </h2>

      {!shown.length && (
        <p className="mt-2 max-w-[54ch] text-sm leading-relaxed text-[#8A867C]">
          {t('Nothing opened yet.')}
        </p>
      )}

      <ul className="mt-2 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
        {shown.map((one) => (
          <li key={`${one.kind}:${one.id}`}>
            <a
              href={one.href}
              onClick={(e) => { e.preventDefault(); go(one.href) }}
              className="group flex items-center gap-2.5 py-3"
            >
              {one.icon
                ? <span className="w-4 shrink-0 text-center leading-none">{one.icon}</span>
                : one.kind === 'board'
                  ? <LayoutGrid size={15} className="shrink-0 text-[#8A867C]" />
                  : <FileText size={15} className="shrink-0 text-[#8A867C]" />}
              <span className="min-w-0 flex-1 truncate text-[15px] text-[#141310] group-hover:text-[#C8452D]">
                {one.title || t(one.kind === 'board' ? 'Untitled board' : 'Untitled page')}
              </span>
              <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-[#B6B1A6]">
                {t(one.kind === 'board' ? 'Board' : 'Page')}
              </span>
            </a>
          </li>
        ))}
      </ul>

      <footer className="mt-16 flex items-center gap-2 border-t border-[#E2DED5] pt-4">
        <a href="/" className="opacity-60 transition-opacity hover:opacity-100">
          <Wordmark height={14} />
        </a>
        <span className="text-[11px] text-[#B6B1A6]">
          {t('Published with {product}', { product: PRODUCT.name })}
        </span>
      </footer>
    </main>
  )
}
