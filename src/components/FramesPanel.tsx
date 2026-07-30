import { Play, Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { fitRect } from '../board/camera'
import { patchItem, removeItems } from '../board/doc'
import { renderToCanvas } from '../board/export'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'
import type { FrameItem } from '../board/types'
import { aabb, contains } from '../board/geometry'
import { IconButton } from './ui'

function Thumb({ frame }: { frame: FrameItem }) {
  const items = useItems()
  const inside = items.filter((i) => i.id === frame.id || contains(frame, aabb(i)))
  const canvas = renderToCanvas(inside, 0.12, 0)
  return (
    <div className="h-[52px] w-[84px] shrink-0 overflow-hidden rounded-md border border-[#E2DED5] bg-[#FCFBF8]">
      {canvas && (
        <img
          src={canvas.toDataURL()}
          alt=""
          className="h-full w-full object-cover"
          draggable={false}
        />
      )}
    </div>
  )
}

export function FramesPanel() {
  const open = useBoardStore((s) => s.framesPanel)
  const update = useBoardStore((s) => s.update)
  const setCamera = useBoardStore((s) => s.setCamera)
  const setSelection = useBoardStore((s) => s.setSelection)
  const items = useItems()
  const [renaming, setRenaming] = useState<string | null>(null)
  const frames = items.filter((i): i is FrameItem => i.type === 'frame')

  if (!open) return null

  const jump = (frame: FrameItem) => {
    const el = document.querySelector('canvas')!
    setCamera(fitRect(frame, el.clientWidth, el.clientHeight))
    setSelection([frame.id])
    requestRender()
  }

  return (
    <div className="absolute left-[76px] top-[76px] z-40 flex max-h-[calc(100dvh-140px)] w-[220px] flex-col rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[0_8px_28px_rgba(9,9,20,0.16)]">
      <div className="flex items-center justify-between border-b border-[#EAE6DD] px-3 py-2">
        <span className="text-xs font-semibold text-[#141310]">Frame'ler ({frames.length})</span>
        <div className="flex items-center gap-0.5">
          <IconButton
            title="Sunumu başlat"
            onClick={() => frames.length && update({ presenting: 0, selection: [] })}
          >
            <Play size={15} strokeWidth={2} />
          </IconButton>
          <IconButton title="Kapat" onClick={() => update({ framesPanel: false })}>
            <X size={15} strokeWidth={2} />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-1.5">
        {frames.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-[#8A867C]">
            Henüz frame yok. Sol araç çubuğundaki frame aracını kullan.
          </p>
        )}
        {frames.map((frame, i) => (
          <div
            key={frame.id}
            className="group mb-1 flex items-center gap-2 rounded-lg p-1.5 hover:bg-[#F2EFE9]"
          >
            <span className="w-4 shrink-0 text-center text-[11px] font-semibold text-[#8A867C]">{i + 1}</span>
            <button type="button" onClick={() => jump(frame)} className="shrink-0">
              <Thumb frame={frame} />
            </button>
            <div className="min-w-0 flex-1">
              {renaming === frame.id ? (
                <input
                  autoFocus
                  defaultValue={frame.title}
                  onBlur={(e) => { patchItem(frame.id, { title: e.target.value }); setRenaming(null); requestRender() }}
                  onKeyDown={(e) => {
                    e.stopPropagation()
                    if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
                    if (e.key === 'Escape') setRenaming(null)
                  }}
                  className="w-full rounded border border-[#C8452D] px-1 py-0.5 text-xs outline-none"
                />
              ) : (
                <button
                  type="button"
                  onDoubleClick={() => setRenaming(frame.id)}
                  onClick={() => jump(frame)}
                  className="block w-full truncate text-left text-xs font-medium text-[#141310]"
                  title="Çift tıkla: yeniden adlandır"
                >
                  {frame.title}
                </button>
              )}
            </div>
            <button
              type="button"
              title="Sil"
              onClick={() => { removeItems([frame.id]); requestRender() }}
              className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#DC2626] opacity-0 hover:bg-[#FEF2F2] group-hover:opacity-100"
            >
              <Trash2 size={13} strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
