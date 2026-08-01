import { useEffect, useSyncExternalStore } from 'react'
import { Star } from 'lucide-react'
import { go } from '../board/boards'
import { getFavourites, loadFavourites, subscribeFavourites } from '../board/favourites'
import { getPages, subscribeRecords } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'

const pages = getPages
const starred = getFavourites

// Kept above the tree because the tree answers "where does this live" and this answers "what am
// I in the middle of", which is a different question with a much shorter answer.
export function Favourites() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const mine = useSyncExternalStore(subscribeFavourites, starred, starred)
  const rows = useSyncExternalStore(subscribeRecords, pages, pages)

  useEffect(() => { if (workspace) void loadFavourites() }, [workspace])

  const held = rows.filter((r) => mine.has(r.id))
  if (!held.length) return null

  return (
    <div className="mt-5">
      <span className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
        <Star size={11} /> {t('Favourites')}
      </span>
      {held.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => go(`/d/${row.id}`)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm text-[#4A463E] hover:bg-[#EAE6DD]"
        >
          <span className="w-4 shrink-0 text-center">{row.icon || '·'}</span>
          <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled page')}</span>
        </button>
      ))}
    </div>
  )
}
