import { Plus, Search, Trash2, X } from 'lucide-react'
import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  currentRoom, discoverBoards, forgetBoard, getBoards, newRoom, openBoard, subscribeBoards,
  touchBoard,
} from '../board/boards'
import { deleteCloudBoard, listCloudBoardIds, listCloudBoards } from '../board/cloud'
import { getUser, subscribeAuth } from '../board/supabase'
import { requestRender, useBoardStore } from '../board/store'
import { t } from '../i18n'
import { Wordmark } from './Logo'
import type { BoardEntry } from '../board/boards'

function when(at: number) {
  if (!at) return t('never opened')
  const mins = Math.floor((Date.now() - at) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
  return t('{n} d ago', { n: Math.floor(mins / 1440) })
}

export function BoardsPanel() {
  const open = useBoardStore((s) => s.boardsPanel)
  const update = useBoardStore((s) => s.update)
  const local = useSyncExternalStore(subscribeBoards, getBoards, getBoards)
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const [cloud, setCloud] = useState<BoardEntry[]>([])
  const [remote, setRemote] = useState<Set<string>>(() => new Set())
  const [query, setQuery] = useState('')
  const remoteRoomKey = local.map((board) => board.room).sort().join('\n')

  useEffect(() => { if (open) void discoverBoards() }, [open])
  useEffect(() => {
    if (!open || !user) { setCloud([]); setRemote(new Set()); return }
    const rooms = remoteRoomKey ? remoteRoomKey.split('\n') : []
    setRemote(new Set(rooms))
    let live = true
    void Promise.all([listCloudBoards(), listCloudBoardIds(rooms)]).then(([boards, ids]) => {
      if (!live) return
      setCloud(boards)
      setRemote(ids)
    })
    return () => { live = false }
  }, [open, user, remoteRoomKey])
  if (!open) return null

  const cloudRooms = new Set(cloud.map((b) => b.room))
  const boards = [...cloud, ...local.filter((b) => !remote.has(b.room))]

  const here = currentRoom()
  const q = query.trim().toLowerCase()
  const shown = boards.filter((b) => !q
    || b.name.toLowerCase().includes(q) || b.room.toLowerCase().includes(q))

  const create = () => {
    const room = newRoom()
    touchBoard(room, { name: '', opened: Date.now() })
    openBoard(room)
  }

  return (
    <aside className="pointer-events-auto absolute left-4 top-[76px] z-40 flex max-h-[calc(100dvh-190px)] w-[320px] flex-col overflow-hidden rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
      <div className="flex items-center justify-between border-b border-[#EAE6DD] px-3 py-2.5">
        <Wordmark height={17} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={create}
            title={t('New board')}
            className="grid h-7 w-7 place-items-center rounded-md text-[#C8452D] hover:bg-[#F7E9E4]"
          >
            <Plus size={16} />
          </button>
          <button
            type="button"
            onClick={() => update({ boardsPanel: false })}
            className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#EFEBE2]"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2 border-b border-[#EAE6DD] px-3 py-2">
        <Search size={14} className="shrink-0 text-[#8A867C]" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder={t('Filter boards')}
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-[#8A867C]"
        />
      </div>

      <div className="flex-1 overflow-y-auto p-1">
        {shown.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-[#8A867C]">{t('No boards yet')}</p>
        )}
        {shown.map((b) => (
          <div
            key={b.room}
            className={`group flex items-center gap-2 rounded-lg px-2.5 py-2
              ${b.room === here ? 'bg-[#F7E9E4]' : 'hover:bg-[#EFEBE2]'}`}
          >
            <button
              type="button"
              onClick={() => { openBoard(b.room); requestRender() }}
              className="min-w-0 flex-1 text-left"
            >
              <div className={`truncate text-sm ${b.room === here ? 'font-semibold text-[#C8452D]' : 'text-[#141310]'}`}>
                {b.name || t('Untitled board')}
              </div>
              <div className="mt-0.5 truncate text-[11px] text-[#8A867C]">
                {b.items} {t(b.items === 1 ? 'item' : 'items')}
                {b.frames ? ` · ${b.frames} ${t(b.frames === 1 ? 'frame' : 'frames')}` : ''}
                {' · '}{when(b.opened)}
                {user && (cloudRooms.has(b.room) ? ` · ${t('Cloud')}` : ` · ${t('This browser')}`)}
              </div>
            </button>
            <button
              type="button"
              title={t('Delete board')}
              onClick={() => {
                if (b.room === here) { alert(t('Open another board before deleting this one.')); return }
                const inCloud = cloudRooms.has(b.room)
                const question = inCloud
                  ? t('Delete "{name}" for everyone? This cannot be undone.', { name: b.name || t('Untitled board') })
                  : t('Delete "{name}" from this browser? This cannot be undone.', { name: b.name || t('Untitled board') })
                if (confirm(question)) {
                  forgetBoard(b.room)
                  if (inCloud) {
                    void deleteCloudBoard(b.room).then(() => listCloudBoards().then(setCloud))
                    setCloud((list) => list.filter((x) => x.room !== b.room))
                  }
                }
              }}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#8A867C] opacity-0 transition-opacity hover:bg-[#FEF2F2] hover:text-[#DC2626] group-hover:opacity-100"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <p className="border-t border-[#EAE6DD] px-3 py-2 text-[11px] leading-snug text-[#8A867C]">
        {user
          ? t('Signed in: boards are saved to the cloud. Share the link to invite someone.')
          : t('Boards live in this browser. Share the link to let someone else open one.')}
      </p>
    </aside>
  )
}
