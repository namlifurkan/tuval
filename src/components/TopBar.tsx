import {
  Clock, Download, Grid3x3, Layers, MoreHorizontal, Printer, Radio, Search, Trash2,
} from 'lucide-react'
import { PRODUCT } from '../board/brand'
import { awareness, getItems, removeItems, room } from '../board/doc'
import { exportPng } from '../board/export'
import { me } from '../board/me'
import { printFrames } from '../board/print'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'
import { Collaborators } from './Collaborators'
import { SessionTools } from './SessionTools'
import { IconButton, Popover, usePopover } from './ui'

function Caption() {
  const boardName = useBoardStore((s) => s.boardName)
  const update = useBoardStore((s) => s.update)
  const items = useItems()
  const frames = items.filter((i) => i.type === 'frame').length

  const parts = [
    `${items.length} öğe`,
    frames ? `${frames} frame` : null,
    room,
  ].filter(Boolean)

  return (
    <div className="min-w-0">
      <input
        value={boardName}
        onChange={(e) => update({ boardName: e.target.value })}
        spellCheck={false}
        aria-label="Board adı"
        className="w-[min(46vw,420px)] truncate bg-transparent text-[19px] font-semibold leading-tight tracking-[-0.01em] text-[#141310] outline-none placeholder:text-[#8A867C] focus:underline focus:decoration-[#C8452D] focus:underline-offset-4"
      />
      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] leading-none text-[#8A867C]">
        <span className="font-semibold uppercase tracking-[0.14em] text-[#C8452D]">{PRODUCT.name}</span>
        <span aria-hidden>·</span>
        {parts.join(' · ')}
      </p>
    </div>
  )
}

export function TopBar() {
  const showGrid = useBoardStore((s) => s.showGrid)
  const update = useBoardStore((s) => s.update)
  const menu = usePopover()

  return (
    <>
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 z-30 h-24 bg-gradient-to-b from-[#F2EFE9] via-[#F2EFE9]/70 to-transparent"
      />
      <header className="pointer-events-none absolute inset-x-4 top-4 z-40 flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex items-start gap-3">
          <Caption />
          <div className="relative pt-0.5">
            <IconButton title="Board menüsü" active={menu.open} onClick={menu.toggle}>
              <MoreHorizontal size={18} strokeWidth={1.8} />
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
                onClick={() => { update({ historyPanel: true }); menu.close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Clock size={15} /> Sürüm geçmişi
              </button>
              <button
                type="button"
                onClick={() => { exportPng(getItems(), useBoardStore.getState().boardName || 'board'); menu.close() }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <Download size={15} /> PNG indir
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!printFrames(getItems())) alert('PDF için en az bir frame gerekiyor.')
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

        <div className="pointer-events-auto flex items-center gap-1.5">
          <IconButton title="Ara — ⌘F" onClick={() => update({ searchOpen: true })}>
            <Search size={18} strokeWidth={1.8} />
          </IconButton>
          <SessionTools />
          <IconButton
            title="Herkesi kendi görüşüne çağır"
            onClick={() => {
              awareness.setLocalStateField('spotlight', { at: Date.now(), name: me.name })
              setTimeout(() => awareness.setLocalStateField('spotlight', null), 15000)
            }}
          >
            <Radio size={18} strokeWidth={1.8} />
          </IconButton>

          <span className="mx-1 h-6 w-px bg-[#E2DED5]" aria-hidden />

          <Collaborators />

          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(location.href)
              update({ presenting: null })
            }}
            className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#141310] transition-colors hover:bg-[#EAE6DD]"
          >
            Bağlantıyı kopyala
          </button>
          <button
            type="button"
            onClick={() => {
              const frames = getItems().filter((i) => i.type === 'frame')
              if (frames.length) update({ presenting: 0, selection: [] })
              else alert('Sunum için en az bir frame gerekiyor.')
            }}
            className="rounded-lg bg-[#C8452D] px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-[#A83621]"
          >
            Sunum
          </button>
        </div>
      </header>
    </>
  )
}
