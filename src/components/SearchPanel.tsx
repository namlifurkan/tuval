import { Search, X } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { fitRect } from '../board/camera'
import { aabb } from '../board/geometry'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'
import type { Item } from '../board/types'

const TYPE_LABEL: Record<string, string> = {
  sticky: 'Sticky', shape: 'Shape', text: 'Metin', frame: 'Frame',
  connector: 'Bağlantı', comment: 'Yorum',
}

const textOf = (i: Item): string =>
  i.type === 'comment' ? i.replies.map((r) => r.text).join(' ') :
  i.type === 'frame' ? i.title :
  'text' in i ? i.text : ''

export function SearchPanel() {
  const open = useBoardStore((s) => s.searchOpen)
  const update = useBoardStore((s) => s.update)
  const setCamera = useBoardStore((s) => s.setCamera)
  const setSelection = useBoardStore((s) => s.setSelection)
  const items = useItems()
  const [query, setQuery] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => { if (open) ref.current?.focus() }, [open])
  if (!open) return null

  const q = query.trim().toLowerCase()
  const hits = q
    ? items.filter((i) => textOf(i).toLowerCase().includes(q)).slice(0, 30)
    : []

  const jump = (item: Item) => {
    const el = document.querySelector('canvas')!
    const b = aabb(item)
    const pad = Math.max(b.w, b.h) * 0.6 + 120
    setCamera(fitRect({ x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 }, el.clientWidth, el.clientHeight))
    setSelection([item.id])
    requestRender()
  }

  return (
    <div className="absolute left-1/2 top-4 z-50 w-[420px] -translate-x-1/2 overflow-hidden rounded-xl border border-black/5 bg-white shadow-[0_8px_28px_rgba(9,9,20,0.18)]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Search size={17} className="shrink-0 text-[#8A8A9B]" />
        <input
          ref={ref}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') update({ searchOpen: false })
            if (e.key === 'Enter' && hits[0]) jump(hits[0])
          }}
          placeholder="Board içinde ara…"
          className="flex-1 text-sm outline-none placeholder:text-[#9B9BAB]"
        />
        <button
          type="button"
          onClick={() => update({ searchOpen: false })}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-[#F1F1F3]"
        >
          <X size={15} />
        </button>
      </div>

      {q && (
        <div className="max-h-[320px] overflow-y-auto border-t border-[#EDEDF2] p-1">
          {hits.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-[#9B9BAB]">Sonuç yok</div>
          )}
          {hits.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => jump(i)}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-[#F1F1F3]"
            >
              <span className="shrink-0 rounded-md bg-[#EDEDF2] px-1.5 py-0.5 text-[10px] font-semibold text-[#585868]">
                {TYPE_LABEL[i.type] ?? i.type}
              </span>
              <span className="truncate text-sm text-[#050038]">{textOf(i)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
