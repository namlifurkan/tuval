import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { useEffect } from 'react'
import { animateCamera, fitRect } from '../board/camera'
import { requestRender, useBoardStore } from '../board/store'
import { sortedFrames } from '../board/items'
import { useItems } from '../board/useBoard'
import type { FrameItem } from '../board/types'

export function usePresentationFrames(): FrameItem[] {
  return sortedFrames(useItems())
}

export function Presentation() {
  const presenting = useBoardStore((s) => s.presenting)
  const update = useBoardStore((s) => s.update)
  const setCamera = useBoardStore((s) => s.setCamera)
  const frames = usePresentationFrames()

  useEffect(() => {
    if (presenting === null) return
    const frame = frames[presenting]
    if (!frame) return
    const el = document.querySelector('canvas')
    if (!el) return
    const target = fitRect(frame, el.clientWidth, el.clientHeight, 40)
    animateCamera(useBoardStore.getState().camera, target, (c) => {
      setCamera(c)
      requestRender()
    })
  }, [presenting, frames, setCamera])

  useEffect(() => {
    if (presenting === null) return
    const go = (d: number) =>
      update({ presenting: Math.min(frames.length - 1, Math.max(0, (presenting ?? 0) + d)) })
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.stopPropagation(); update({ presenting: null }); return }
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') { e.preventDefault(); go(1) }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(-1) }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [presenting, frames.length, update])

  if (presenting === null) return null
  const frame = frames[presenting]

  return (
    <div className="pointer-events-none absolute inset-0 z-50">
      <div className="pointer-events-auto absolute bottom-6 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-black/5 bg-[#FCFBF8] p-1.5 shadow-[3px_3px_0_rgba(20,19,16,0.09)]">
        <button
          type="button"
          disabled={presenting === 0}
          onClick={() => update({ presenting: presenting - 1 })}
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#EFEBE2] disabled:opacity-30"
        >
          <ChevronLeft size={19} />
        </button>
        <span className="min-w-[132px] px-2 text-center text-sm font-semibold text-[#141310]">
          {frame ? frame.title : 'Frame yok'}
          <span className="ml-2 text-[#8A867C]">{presenting + 1}/{frames.length}</span>
        </span>
        <button
          type="button"
          disabled={presenting >= frames.length - 1}
          onClick={() => update({ presenting: presenting + 1 })}
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#EFEBE2] disabled:opacity-30"
        >
          <ChevronRight size={19} />
        </button>
        <div className="mx-1 h-6 w-px bg-[#E2DED5]" />
        <button
          type="button"
          onClick={() => update({ presenting: null })}
          className="grid h-9 w-9 place-items-center rounded-lg hover:bg-[#EFEBE2]"
          title="Çıkış — Esc"
        >
          <X size={19} />
        </button>
      </div>
    </div>
  )
}
