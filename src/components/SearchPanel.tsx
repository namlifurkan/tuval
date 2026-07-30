import { t } from '../i18n'
import { Search, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fitRect } from '../board/camera'
import { aabb } from '../board/geometry'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'
import type { Item } from '../board/types'

const TYPE_LABEL: Record<string, string> = {
  sticky: 'Sticky', shape: 'Shape', text: 'Text', frame: 'Frame',
  connector: 'Connector', comment: 'Comment',
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
  const [cursor, setCursor] = useState(0)
  const ref = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => { if (open) ref.current?.focus() }, [open])
  useEffect(() => { setCursor(0) }, [query])
  useEffect(() => {
    listRef.current?.children[cursor]?.scrollIntoView({ block: 'nearest' })
  }, [cursor])
  if (!open) return null

  const q = query.trim().toLowerCase()
  const hits = q
    ? items.filter((i) => textOf(i).toLowerCase().includes(q)).slice(0, 30)
    : []

  const active = Math.min(cursor, Math.max(0, hits.length - 1))

  const jump = (item: Item) => {
    const el = document.querySelector('canvas')!
    const b = aabb(item)
    const pad = Math.max(b.w, b.h) * 0.6 + 120
    setCamera(fitRect({ x: b.x - pad, y: b.y - pad, w: b.w + pad * 2, h: b.h + pad * 2 }, el.clientWidth, el.clientHeight))
    setSelection([item.id])
    requestRender()
  }

  return (
    <div className="absolute left-1/2 top-4 z-50 w-[420px] -translate-x-1/2 overflow-hidden rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <Search size={17} className="shrink-0 text-[#8A867C]" />
        <input
          ref={ref}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') { update({ searchOpen: false }); return }
            if (e.key === 'ArrowDown' || (e.key === 'n' && e.ctrlKey)) {
              e.preventDefault()
              setCursor((c) => (hits.length ? (c + 1) % hits.length : 0))
              return
            }
            if (e.key === 'ArrowUp' || (e.key === 'p' && e.ctrlKey)) {
              e.preventDefault()
              setCursor((c) => (hits.length ? (c - 1 + hits.length) % hits.length : 0))
              return
            }
            if (e.key === 'Enter' && hits[active]) {
              jump(hits[active])
              if (!e.shiftKey) update({ searchOpen: false })
            }
          }}
          placeholder={t('Search the board…')}
          className="flex-1 text-sm outline-none placeholder:text-[#8A867C]"
        />
        <button
          type="button"
          onClick={() => update({ searchOpen: false })}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md hover:bg-[#EFEBE2]"
        >
          <X size={15} />
        </button>
      </div>

      {q && (
        <div ref={listRef} className="max-h-[320px] overflow-y-auto border-t border-[#EAE6DD] p-1">
          {hits.length === 0 && (
            <div className="px-3 py-4 text-center text-sm text-[#8A867C]">{t('No results')}</div>
          )}
          {hits.map((i, n) => (
            <button
              key={i.id}
              type="button"
              onClick={() => { jump(i); update({ searchOpen: false }) }}
              onPointerEnter={() => setCursor(n)}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left
                ${n === active ? 'bg-[#F7E9E4] ring-1 ring-[#C8452D]/25' : 'hover:bg-[#EFEBE2]'}`}
            >
              <span className="shrink-0 rounded-md bg-[#EAE6DD] px-1.5 py-0.5 text-[10px] font-semibold text-[#4A463E]">
                {t(TYPE_LABEL[i.type] ?? i.type)}
              </span>
              <span className="truncate text-sm text-[#141310]">{textOf(i)}</span>
            </button>
          ))}
        </div>
      )}

      {q && hits.length > 0 && (
        <div className="flex items-center gap-3 border-t border-[#EAE6DD] px-3 py-1.5 text-[11px] text-[#8A867C]">
          <span><kbd className="font-semibold">↑↓</kbd> {t('navigate')}</span>
          <span><kbd className="font-semibold">↵</kbd> {t('go')}</span>
          <span><kbd className="font-semibold">⇧↵</kbd> {t('go, keep open')}</span>
          <span className="ml-auto">{active + 1}/{hits.length}</span>
        </div>
      )}
    </div>
  )
}
