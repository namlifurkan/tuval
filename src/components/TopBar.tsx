import { ChevronDown, Clock, Play, Search, Star, Users } from 'lucide-react'
import { room } from '../board/doc'
import { useBoardStore } from '../board/store'
import { IconButton } from './ui'

export function TopBar() {
  const boardName = useBoardStore((s) => s.boardName)
  const update = useBoardStore((s) => s.update)

  return (
    <>
      <div className="pointer-events-auto absolute left-4 top-4 z-40 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-black/5 bg-white p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-[#FFD02F] text-sm font-black text-[#050038]">
            m
          </div>
          <input
            value={boardName}
            onChange={(e) => update({ boardName: e.target.value })}
            className="w-[170px] rounded-lg px-2 py-1.5 text-sm font-semibold text-[#050038] outline-none hover:bg-[#F1F1F3] focus:bg-[#F1F1F3]"
          />
          <IconButton title="Favorite"><Star size={17} strokeWidth={1.8} /></IconButton>
          <IconButton title="Board menu"><ChevronDown size={17} strokeWidth={1.8} /></IconButton>
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 z-40 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-black/5 bg-white p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
          <IconButton title="Search"><Search size={18} strokeWidth={1.8} /></IconButton>
          <IconButton title="Activity"><Clock size={18} strokeWidth={1.8} /></IconButton>
          <IconButton title="Collaborators"><Users size={18} strokeWidth={1.8} /></IconButton>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-white p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(location.href)}
            className="rounded-lg bg-[#4262FF] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#3450E0]"
          >
            Share
          </button>
          <IconButton title="Present"><Play size={18} strokeWidth={1.8} /></IconButton>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 text-[11px] font-medium text-[#8A8A9B]">
        board: {room}
      </div>
    </>
  )
}
