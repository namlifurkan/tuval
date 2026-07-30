import { Check, MessageSquare, X } from 'lucide-react'
import { useState } from 'react'
import { fitRect } from '../board/camera'
import { patchItem } from '../board/doc'
import { initials } from '../board/me'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'
import type { CommentItem } from '../board/types'

const timeAgo = (at: number) => {
  const m = Math.floor((Date.now() - at) / 60000)
  if (m < 1) return 'şimdi'
  if (m < 60) return `${m}dk`
  if (m < 1440) return `${Math.floor(m / 60)}sa`
  return `${Math.floor(m / 1440)}g`
}

export function CommentsPanel() {
  const open = useBoardStore((s) => s.commentsPanel)
  const update = useBoardStore((s) => s.update)
  const setCamera = useBoardStore((s) => s.setCamera)
  const setSelection = useBoardStore((s) => s.setSelection)
  const items = useItems()
  const [showResolved, setShowResolved] = useState(false)

  if (!open) return null

  const all = items.filter((i): i is CommentItem => i.type === 'comment')
  const shown = showResolved ? all : all.filter((c) => !c.resolved)
  const resolvedCount = all.length - all.filter((c) => !c.resolved).length

  const jump = (comment: CommentItem) => {
    const el = document.querySelector('canvas')!
    setCamera(fitRect({ x: comment.x - 500, y: comment.y - 350, w: 1000, h: 700 }, el.clientWidth, el.clientHeight, 0))
    setSelection([comment.id])
    update({ openComment: comment.id })
    requestRender()
  }

  return (
    <div className="absolute right-4 top-[76px] z-40 flex max-h-[calc(100dvh-160px)] w-[292px] flex-col rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[0_8px_28px_rgba(20,19,16,0.16)]">
      <div className="flex items-center justify-between border-b border-[#EAE6DD] px-3 py-2">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-[#141310]">
          <MessageSquare size={14} strokeWidth={2} />
          Yorumlar ({shown.length})
        </span>
        <button
          type="button"
          onClick={() => update({ commentsPanel: false })}
          className="grid h-7 w-7 place-items-center rounded-md hover:bg-[#EFEBE2]"
        >
          <X size={15} strokeWidth={2} />
        </button>
      </div>

      {resolvedCount > 0 && (
        <button
          type="button"
          onClick={() => setShowResolved((v) => !v)}
          className="flex items-center gap-1.5 border-b border-[#EAE6DD] px-3 py-1.5 text-left text-[11px] font-medium text-[#8A867C] hover:bg-[#EFEBE2]"
        >
          <Check size={12} strokeWidth={2.5} />
          {showResolved ? 'Çözülmüşleri gizle' : `Çözülmüşleri göster (${resolvedCount})`}
        </button>
      )}

      <div className="flex-1 overflow-y-auto p-1.5">
        {shown.length === 0 && (
          <p className="px-2 py-6 text-center text-xs text-[#8A867C]">
            {all.length ? 'Açık yorum yok.' : 'Henüz yorum yok. Yorum aracıyla tuvale pin bırak.'}
          </p>
        )}
        {shown.map((comment) => {
          const first = comment.replies[0]
          return (
            <div key={comment.id} className="mb-1 rounded-lg p-2 hover:bg-[#EFEBE2]">
              <button type="button" onClick={() => jump(comment)} className="w-full text-left">
                <div className="mb-1 flex items-center gap-1.5">
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[9px] font-bold text-white"
                    style={{ background: first?.color ?? '#8A867C' }}
                  >
                    {initials(first?.author ?? '?')}
                  </span>
                  <span className="text-[11px] font-semibold text-[#141310]">{first?.author ?? 'Bilinmeyen'}</span>
                  <span className="text-[10px] text-[#8A867C]">{first ? timeAgo(first.at) : ''}</span>
                  {comment.resolved && (
                    <span className="ml-auto rounded bg-[#EAE6DD] px-1.5 py-0.5 text-[9px] font-semibold text-[#4A463E]">
                      çözüldü
                    </span>
                  )}
                </div>
                <p className="line-clamp-3 text-xs text-[#2E2B26]">{first?.text ?? '(boş)'}</p>
                {comment.replies.length > 1 && (
                  <span className="mt-1 block text-[10px] text-[#8A867C]">
                    +{comment.replies.length - 1} yanıt
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => { patchItem(comment.id, { resolved: !comment.resolved }); requestRender() }}
                className="mt-1.5 text-[10px] font-semibold text-[#8A867C] hover:text-[#C8452D]"
              >
                {comment.resolved ? 'Yeniden aç' : 'Çözüldü işaretle'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
