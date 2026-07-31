import { Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  discoverBoards, forgetBoard, getBoards, newRoom, openBoard, subscribeBoards, touchBoard,
} from '../board/boards'
import type { BoardEntry } from '../board/boards'
import { deleteCloudBoard, listCloudBoards, myRoles } from '../board/cloud'
import type { CloudBoard } from '../board/cloud'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { TEMPLATES } from '../board/templates'
import { t } from '../i18n'
import { Account } from './Account'
import { Wordmark } from './Logo'

function when(at: number) {
  if (!at) return t('never opened')
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
  return t('{n} d ago', { n: Math.floor(mins / 1440) })
}

const start = (template?: string) => {
  const room = newRoom()
  touchBoard(room, { name: '', opened: Date.now() })
  openBoard(room, template)
}

function Tile({ board, mine, onForget }: {
  board: BoardEntry & { owned?: boolean; role?: string }
  mine: boolean
  onForget?: () => void
}) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={() => openBoard(board.room)}
        className="block w-full overflow-hidden rounded-xl border border-[#E2DED5] bg-[#F2EFE9] transition-shadow hover:shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
      >
        {board.thumb
          ? <img src={board.thumb} alt="" className="aspect-[8/5] w-full object-cover" />
          : (
            <span className="grid aspect-[8/5] w-full place-items-center text-[11px] uppercase tracking-[0.13em] text-[#B6B1A6]">
              {board.items ? t('no preview yet') : t('empty')}
            </span>
          )}
      </button>

      <div className="mt-2 flex items-baseline gap-2 px-0.5">
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[#141310]">
          {board.name || t('Untitled board')}
        </span>
        {!mine && board.role && (
          <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
            {t(board.role)}
          </span>
        )}
      </div>
      <div className="mt-0.5 truncate px-0.5 text-[11px] text-[#8A867C]">
        {board.items} {t(board.items === 1 ? 'item' : 'items')}
        {board.frames ? ` · ${board.frames} ${t(board.frames === 1 ? 'frame' : 'frames')}` : ''}
        {' · '}{when(board.opened)}
      </div>

      {onForget && (
        <button
          type="button"
          title={t('Delete board')}
          onClick={onForget}
          className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-md border border-[#E2DED5] bg-[#FCFBF8] text-[#8A867C] opacity-0 transition-opacity hover:text-[#DC2626] group-hover:opacity-100"
        >
          <Trash2 size={13} />
        </button>
      )}
    </div>
  )
}

const Band = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-10">
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">{title}</h2>
    <div className="mt-3 grid gap-x-5 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
      {children}
    </div>
  </section>
)

export function Dashboard() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const local = useSyncExternalStore(subscribeBoards, getBoards, getBoards)
  const [cloud, setCloud] = useState<CloudBoard[]>([])
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(cloudEnabled)

  useEffect(() => { void discoverBoards() }, [])
  useEffect(() => {
    if (!user) { setCloud([]); setLoading(false); return }
    setLoading(true)
    void listCloudBoards().then((list) => { setCloud(list); setLoading(false) })
    void myRoles().then(setRoles)
  }, [user])

  const cloudRooms = new Set(cloud.map((b) => b.room))
  const mine = [...cloud.filter((b) => b.owned), ...local.filter((b) => !cloudRooms.has(b.room))]
  const shared = cloud.filter((b) => !b.owned)

  const drop = (board: BoardEntry, inCloud: boolean) => () => {
    const name = board.name || t('Untitled board')
    const question = inCloud
      ? t('Delete "{name}" for everyone? This cannot be undone.', { name })
      : t('Delete "{name}" from this browser? This cannot be undone.', { name })
    if (!confirm(question)) return
    forgetBoard(board.room)
    if (inCloud) {
      setCloud((list) => list.filter((x) => x.room !== board.room))
      void deleteCloudBoard(board.room)
    }
  }

  return (
    <div className="h-dvh overflow-y-auto bg-[#F2EFE9]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E2DED5] bg-[#F2EFE9]/92 px-6 py-3 backdrop-blur-[2px] sm:px-10">
        <Wordmark height={18} />
        <Account />
      </header>

      <main className="mx-auto w-full max-w-[1180px] px-6 pb-24 pt-8 sm:px-10">
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
          <h1 className="font-[600] text-[clamp(1.5rem,3vw,2rem)] leading-none tracking-[-0.015em] text-[#141310]">
            {user ? t('Good to see you, {name}', { name: (user.email ?? '').split('@')[0] }) : t('Your boards')}
          </h1>
          <button
            type="button"
            onClick={() => start()}
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-[#C8452D] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
          >
            <Plus size={15} strokeWidth={2.4} /> {t('New board')}
          </button>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          {TEMPLATES.map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              title={t(tpl.description)}
              onClick={() => start(tpl.id)}
              className="rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2.5 py-1.5 text-xs font-semibold text-[#4A463E] transition-colors hover:border-[#C8452D] hover:text-[#C8452D]"
            >
              {t(tpl.name)}
            </button>
          ))}
        </div>

        {loading && (
          <Band title={t('Your boards')}>
            {[0, 1, 2, 3].map((i) => (
              <div key={i}>
                <div className="aspect-[8/5] w-full animate-pulse rounded-xl bg-[#EAE6DD]" />
                <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-[#EAE6DD]" />
              </div>
            ))}
          </Band>
        )}

        {!loading && (
          <Band title={t('Your boards')}>
            {mine.map((b) => (
              <Tile
                key={b.room}
                board={b}
                mine
                onForget={drop(b, cloudRooms.has(b.room))}
              />
            ))}
          </Band>
        )}

        {!loading && !mine.length && (
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
            {t('Nothing here yet. A board is an endless sheet: drop a sticky, connect two of them, and hand the result to an agent when it is ready.')}
          </p>
        )}

        {!!shared.length && (
          <Band title={t('Shared with you')}>
            {shared.map((b) => <Tile key={b.room} board={{ ...b, role: roles[b.room] }} mine={false} />)}
          </Band>
        )}

        {!user && cloudEnabled && (
          <p className="mt-10 max-w-[62ch] text-sm leading-relaxed text-[#8A867C]">
            {t('These boards live in this browser only. Sign in and they follow you to any device.')}
          </p>
        )}
      </main>
    </div>
  )
}
