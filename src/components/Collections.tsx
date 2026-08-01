import { useEffect, useSyncExternalStore } from 'react'
import { Filter, Plus } from 'lucide-react'
import { go } from '../board/boards'
import { addCollection, loadCollections } from '../board/collections'
import { getRecords, subscribeRecords } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'

const sets = () => getRecords('collection')

// Beside the tree rather than in it. The tree answers "where does this live"; these answer
// "what am I keeping an eye on", and a question has no place in a hierarchy of places.
export function Collections() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, sets, sets)

  useEffect(() => { if (workspace) void loadCollections() }, [workspace])

  if (!workspace) return null

  return (
    <div className="mt-5">
      <span className="flex items-center gap-1.5 px-2 pb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
        <Filter size={11} /> {t('Collections')}
      </span>
      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => go(`/c/${row.id}`)}
          className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm text-[#4A463E] hover:bg-[#EAE6DD]"
        >
          <span className="w-4 shrink-0 text-center">{row.icon || '·'}</span>
          <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled collection')}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => void addCollection('').then((made) => made && go(`/c/${made}`))}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-sm font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
      >
        <Plus size={14} className="shrink-0" /> {t('New collection')}
      </button>
    </div>
  )
}
