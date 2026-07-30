import { ChevronDown, Clock, Download, Grid3x3, Layers, Play, Printer, Search, Star, Trash2 } from 'lucide-react'
import { COLOR, PRODUCT } from '../board/brand'
import { getItems, removeItems, room } from '../board/doc'
import { exportPng } from '../board/export'
import { printFrames } from '../board/print'
import { requestRender, useBoardStore } from '../board/store'
import { Collaborators } from './Collaborators'
import { IconButton, Popover, usePopover } from './ui'

export function TopBar() {
  const boardName = useBoardStore((s) => s.boardName)
  const showGrid = useBoardStore((s) => s.showGrid)
  const update = useBoardStore((s) => s.update)
  const menu = usePopover()

  return (
    <>
      <div className="pointer-events-auto absolute left-4 top-4 z-40 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-black/5 bg-[#FCFBF8] p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
          <div
            className="grid h-9 w-9 place-items-center rounded-lg text-sm font-bold text-white"
            style={{ background: COLOR.ink }}
            title={PRODUCT.name}
          >
            {PRODUCT.mark}
          </div>
          <input
            value={boardName}
            onChange={(e) => update({ boardName: e.target.value })}
            className="w-[170px] rounded-lg px-2 py-1.5 text-sm font-semibold text-[#141310] outline-none hover:bg-[#EFEBE2] focus:bg-[#EFEBE2]"
          />
          <IconButton title="Favorite"><Star size={17} strokeWidth={1.8} /></IconButton>
          <div className="relative">
            <IconButton title="Board menüsü" active={menu.open} onClick={menu.toggle}>
              <ChevronDown size={17} strokeWidth={1.8} />
            </IconButton>
            <Popover open={menu.open} onClose={menu.close} anchor="bottom" className="w-[236px]">
              <button
                type="button"
                onClick={() => { update({ framesPanel: true }); menu.close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Layers size={15} /> Frame paneli
              </button>
              <button
                type="button"
                onClick={() => { exportPng(getItems(), boardName || 'board'); menu.close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Download size={15} /> Board'u PNG indir
              </button>
              <button
                type="button"
                onClick={() => {
                  const count = printFrames(getItems())
                  if (!count) alert('PDF için en az bir frame gerekiyor.')
                  menu.close()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Printer size={15} /> Frame'leri PDF yazdır
              </button>
              <button
                type="button"
                onClick={() => { update({ showGrid: !showGrid }); requestRender() }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <span className="flex items-center gap-2"><Grid3x3 size={15} /> Izgara</span>
                <span className="text-xs text-[#8A867C]">{showGrid ? 'Açık' : 'Kapalı'}</span>
              </button>
              <div className="my-1 h-px bg-[#EAE6DD]" />
              <button
                type="button"
                onClick={() => {
                  if (confirm('Board\'daki her şey silinsin mi?')) {
                    removeItems(getItems().map((i) => i.id))
                    requestRender()
                  }
                  menu.close()
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-[#DC2626] hover:bg-[#FEF2F2]"
              >
                <Trash2 size={15} /> Board'u temizle
              </button>
            </Popover>
          </div>
        </div>
      </div>

      <div className="pointer-events-auto absolute right-4 top-4 z-40 flex items-center gap-2">
        <div className="flex items-center gap-1 rounded-xl border border-black/5 bg-[#FCFBF8] p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
          <IconButton title="Ara — ⌘F" onClick={() => update({ searchOpen: true })}>
            <Search size={18} strokeWidth={1.8} />
          </IconButton>
          <IconButton title="Activity"><Clock size={18} strokeWidth={1.8} /></IconButton>
          <Collaborators />
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-black/5 bg-[#FCFBF8] p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
          <button
            type="button"
            onClick={() => navigator.clipboard?.writeText(location.href)}
            className="rounded-lg bg-[#C8452D] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
          >
            Share
          </button>
          <IconButton
            title="Present"
            onClick={() => {
              const frames = getItems().filter((i) => i.type === 'frame')
              if (frames.length) update({ presenting: 0, selection: [] })
            }}
          >
            <Play size={18} strokeWidth={1.8} />
          </IconButton>
        </div>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 text-[11px] font-medium text-[#8A867C]">
        board: {room}
      </div>
    </>
  )
}
