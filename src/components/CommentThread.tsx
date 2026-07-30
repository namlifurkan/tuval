import { Check, Trash2 } from 'lucide-react'
import { useLayoutEffect, useRef, useState } from 'react'
import { patchItem, removeItems } from '../board/doc'
import { makeReply } from '../board/items'
import { initials, me } from '../board/me'
import { commentPinScreen } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { useItemIndex } from '../board/useBoard'

const timeAgo = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60000)
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m}dk`
  if (m < 1440) return `${Math.floor(m / 60)}sa`
  return `${Math.floor(m / 1440)}g`
}

export function CommentThread() {
  const openComment = useBoardStore((s) => s.openComment)
  const camera = useBoardStore((s) => s.camera)
  const update = useBoardStore((s) => s.update)
  const index = useItemIndex()
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const item = openComment ? index.get(openComment) : undefined

  useLayoutEffect(() => {
    if (openComment) inputRef.current?.focus({ preventScroll: true })
  }, [openComment])

  if (!item || item.type !== 'comment') return null

  const pin = commentPinScreen(camera, item)
  const close = () => { update({ openComment: null }); setDraft('') }

  const submit = () => {
    const text = draft.trim()
    if (!text) return
    patchItem(item.id, { replies: [...item.replies, makeReply(text)] })
    setDraft('')
    requestRender()
  }

  const remove = () => {
    removeItems([item.id])
    close()
    requestRender()
  }

  return (
    <div
      className="absolute z-50 w-[286px] rounded-xl border border-black/5 bg-white shadow-[0_8px_28px_rgba(9,9,20,0.18)]"
      style={{ left: pin.x + 24, top: Math.max(12, pin.y - 20) }}
      onPointerDown={(e) => e.stopPropagation()}
      onWheel={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-[#EAE6DD] px-3 py-2">
        <span className="text-xs font-semibold text-[#8A867C]">
          {item.replies.length ? `${item.replies.length} yorum` : 'Yeni yorum'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title={item.resolved ? 'Yeniden aç' : 'Çözüldü olarak işaretle'}
            onClick={() => { patchItem(item.id, { resolved: !item.resolved }); requestRender() }}
            className={`grid h-7 w-7 place-items-center rounded-md ${item.resolved ? 'bg-[#E4F7EC] text-[#00875A]' : 'hover:bg-[#EFEBE2]'}`}
          >
            <Check size={15} strokeWidth={2.2} />
          </button>
          <button
            type="button"
            title="Sil"
            onClick={remove}
            className="grid h-7 w-7 place-items-center rounded-md text-[#DC2626] hover:bg-[#FEF2F2]"
          >
            <Trash2 size={14} strokeWidth={2} />
          </button>
        </div>
      </div>

      <div className="max-h-[240px] overflow-y-auto px-3 py-2">
        {item.replies.map((r) => (
          <div key={r.id} className="mb-3 flex gap-2 last:mb-0">
            <div
              className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
              style={{ background: r.color }}
            >
              {initials(r.author)}
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-1.5">
                <span className="text-xs font-semibold text-[#141310]">{r.author}</span>
                <span className="text-[10px] text-[#8A867C]">{timeAgo(r.at)}</span>
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-[#2E2B26]">{r.text}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-end gap-2 border-t border-[#EAE6DD] p-2">
        <div
          className="grid h-6 w-6 shrink-0 place-items-center rounded-full text-[10px] font-bold text-white"
          style={{ background: me.color }}
        >
          {initials(me.name)}
        </div>
        <textarea
          ref={inputRef}
          value={draft}
          rows={1}
          placeholder="Yorum yaz…"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit() }
            if (e.key === 'Escape') close()
          }}
          className="max-h-24 min-h-[30px] flex-1 resize-none rounded-lg bg-[#F2EFE9] px-2.5 py-1.5 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-[#C8452D]"
        />
        <button
          type="button"
          onClick={submit}
          disabled={!draft.trim()}
          className="rounded-lg bg-[#C8452D] px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-35"
        >
          Gönder
        </button>
      </div>
    </div>
  )
}
