import { Copy, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  discoverBoards, forgetBoard, getBoards, getTrash, newRoom, openBoard, restoreLocalBoard,
  subscribeBoards, touchBoard, trashLocalBoard,
} from '../board/boards'
import type { BoardEntry } from '../board/boards'
import {
  deleteCloudBoard, emptyExpiredTrash, listCloudBoards, myRoles, restoreBoard, TRASH_DAYS,
  trashBoard,
} from '../board/cloud'
import type { CloudBoard } from '../board/cloud'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { duplicateBoard } from '../board/duplicate'
import { TEMPLATES } from '../board/templates'
import { t } from '../i18n'
import { PasswordGate } from './PasswordGate'
import { Shell } from './Shell'

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

function Tile({ board, mine, onForget, onCopy }: {
  board: BoardEntry & { owned?: boolean; role?: string }
  mine: boolean
  onForget?: () => void
  onCopy?: () => void
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

      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        {onCopy && (
          <button
            type="button"
            title={t('Duplicate')}
            onClick={onCopy}
            className="grid h-7 w-7 place-items-center rounded-md border border-[#E2DED5] bg-[#FCFBF8] text-[#8A867C] hover:text-[#C8452D]"
          >
            <Copy size={13} />
          </button>
        )}
        {onForget && (
          <button
            type="button"
            title={t('Move to trash')}
            onClick={onForget}
            className="grid h-7 w-7 place-items-center rounded-md border border-[#E2DED5] bg-[#FCFBF8] text-[#8A867C] hover:text-[#DC2626]"
          >
            <Trash2 size={13} />
          </button>
        )}
      </div>
    </div>
  )
}

const Band = ({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) => (
  <section className="mt-10">
    <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">{title}</h2>
    {note && <p className="mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">{note}</p>}
    <div className="mt-3 grid gap-x-5 gap-y-7 [grid-template-columns:repeat(auto-fill,minmax(232px,1fr))]">
      {children}
    </div>
  </section>
)

export function Dashboard() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const local = useSyncExternalStore(subscribeBoards, getBoards, getBoards)
  const localTrash = useSyncExternalStore(subscribeBoards, getTrash, getTrash)
  const [cloud, setCloud] = useState<CloudBoard[]>([])
  const [roles, setRoles] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(cloudEnabled)
  const [copying, setCopying] = useState('')

  useEffect(() => { void discoverBoards() }, [])
  useEffect(() => {
    if (!user) { setCloud([]); setLoading(false); return }
    setLoading(true)
    void listCloudBoards().then((list) => {
      setCloud(list)
      setLoading(false)
      void emptyExpiredTrash(list)
    })
    void myRoles().then(setRoles)
  }, [user])

  const cloudRooms = new Set(cloud.map((b) => b.room))
  const alive = cloud.filter((b) => !b.deleted)
  // Local boards belong to the browser, not to the account: signing in as somebody else does
  // not change them, and mixing them into your own boards makes that look like a bug.
  const mine = user ? alive.filter((b) => b.owned) : []
  const here = local.filter((b) => !cloudRooms.has(b.room))
  const shared = alive.filter((b) => !b.owned)
  const trash = [
    ...cloud.filter((b) => b.deleted && b.owned),
    ...localTrash.filter((b) => !cloudRooms.has(b.room)),
  ]

  const drop = (board: BoardEntry, inCloud: boolean) => () => {
    if (inCloud) {
      setCloud((list) => list.map((b) => (b.room === board.room ? { ...b, deleted: Date.now() } : b)))
      void trashBoard(board.room)
    } else trashLocalBoard(board.room)
  }

  const copy = (board: BoardEntry) => () => {
    if (copying) return
    setCopying(board.room)
    void duplicateBoard(board.room, board.name)
      .then((made) => openBoard(made))
      .catch((e: Error) => { alert(e.message); setCopying('') })
  }

  const restore = (board: BoardEntry, inCloud: boolean) => () => {
    if (inCloud) {
      setCloud((list) => list.map((b) => (b.room === board.room ? { ...b, deleted: undefined } : b)))
      void restoreBoard(board.room)
    } else restoreLocalBoard(board.room)
  }

  const erase = (board: BoardEntry, inCloud: boolean) => () => {
    const name = board.name || t('Untitled board')
    if (!confirm(t('Delete "{name}" for good? This cannot be undone.', { name }))) return
    forgetBoard(board.room)
    if (inCloud) {
      setCloud((list) => list.filter((x) => x.room !== board.room))
      void deleteCloudBoard(board.room)
    }
  }

  // A board opened by accident and closed again. There is nothing on it to lose, which is what
  // makes clearing the lot in one go safe enough to offer.
  const bare = [
    ...mine.filter((b) => !b.items && !b.frames).map((b) => [b, true] as const),
    ...here.filter((b) => !b.items && !b.frames).map((b) => [b, false] as const),
  ]

  // The trash empties itself after a month; this is for somebody who has decided sooner. Named
  // with the count, because "empty the trash" and "delete eleven boards" are the same sentence
  // and only one of them makes you stop and read it.
  const burn = () => {
    if (!confirm(t('Delete {n} boards in the trash for good? This cannot be undone.', { n: trash.length }))) return
    const rooms = new Set(trash.filter((b) => cloudRooms.has(b.room)).map((b) => b.room))
    for (const board of trash) forgetBoard(board.room)
    setCloud((list) => list.filter((x) => !rooms.has(x.room)))
    for (const room of rooms) void deleteCloudBoard(room)
  }

  const sweep = () => {
    if (!confirm(t('Delete {n} empty boards for good? Nothing was ever put on them.', { n: bare.length }))) return
    const rooms = new Set(bare.filter(([, inCloud]) => inCloud).map(([b]) => b.room))
    for (const [board] of bare) forgetBoard(board.room)
    setCloud((list) => list.filter((x) => !rooms.has(x.room)))
    for (const room of rooms) void deleteCloudBoard(room)
  }

  return (
    <Shell title={t('Boards')} wide>
      <PasswordGate />
      <div>
        {copying && (
          <p className="mb-4 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2 text-sm text-[#4A463E]">
            {t('Copying the board and its images…')}
          </p>
        )}

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

        {!loading && bare.length > 1 && (
          <button
            type="button"
            onClick={sweep}
            className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2.5 py-1.5 text-xs font-semibold text-[#8A867C] transition-colors hover:border-[#C8452D] hover:text-[#C8452D]"
          >
            <Trash2 size={13} /> {t('Delete {n} empty boards', { n: bare.length })}
          </button>
        )}

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

        {!loading && !!mine.length && (
          <Band title={t('Your boards')}>
            {mine.map((b) => <Tile key={b.room} board={b} mine onCopy={copy(b)} onForget={drop(b, true)} />)}
          </Band>
        )}

        {!loading && !mine.length && !here.length && (
          <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
            {t('Nothing here yet. A board is an endless sheet: drop a sticky, connect two of them, and hand the result to an agent when it is ready.')}
          </p>
        )}

        {!loading && !!here.length && (
          <Band
            title={t('In this browser')}
            note={user
              ? t('Not part of any account: these were made before signing in and stay with this browser whoever is signed in. Open one and it moves to the cloud under {email}.', { email: user.email ?? '' })
              : t('These live in this browser. Sign in and they follow you to any device.')}
          >
            {here.map((b) => <Tile key={b.room} board={b} mine onCopy={copy(b)} onForget={drop(b, false)} />)}
          </Band>
        )}

        {!!shared.length && (
          <Band title={t('Shared with you')}>
            {shared.map((b) => <Tile key={b.room} board={{ ...b, role: roles[b.room] }} mine={false} />)}
          </Band>
        )}

        {!!trash.length && (
          <>
          <button
            type="button"
            onClick={burn}
            className="mt-10 -mb-8 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
          >{t('Empty the trash ({n})', { n: trash.length })}</button>
          <Band
            title={t('Trash')}
            note={t('Emptied automatically after {n} days. Until then a board here can be brought back exactly as it was.', { n: TRASH_DAYS })}
          >
            {trash.map((b) => (
              <div key={b.room} className="opacity-70 transition-opacity hover:opacity-100">
                <div className="aspect-[8/5] w-full overflow-hidden rounded-xl border border-[#E2DED5] bg-[#F2EFE9]">
                  {b.thumb && <img src={b.thumb} alt="" className="h-full w-full object-cover grayscale" />}
                </div>
                <div className="mt-2 truncate px-0.5 text-sm font-semibold text-[#141310]">
                  {b.name || t('Untitled board')}
                </div>
                <div className="mt-1 flex gap-1.5 px-0.5">
                  <button
                    type="button"
                    onClick={restore(b, cloudRooms.has(b.room))}
                    className="rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#C8452D] hover:bg-[#F7E9E4]"
                  >{t('Restore')}</button>
                  <button
                    type="button"
                    onClick={erase(b, cloudRooms.has(b.room))}
                    className="rounded-md px-1.5 py-0.5 text-[11px] text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                  >{t('Delete for good')}</button>
                </div>
              </div>
            ))}
          </Band>
          </>
        )}
      </div>
    </Shell>
  )
}
