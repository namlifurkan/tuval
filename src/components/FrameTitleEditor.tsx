import { useLayoutEffect, useRef } from 'react'
import { toScreen } from '../board/camera'
import { patchItem } from '../board/doc'
import { requestRender, useBoardStore } from '../board/store'
import { useItemIndex } from '../board/useBoard'

export function FrameTitleEditor() {
  const id = useBoardStore((s) => s.renamingFrame)
  const camera = useBoardStore((s) => s.camera)
  const update = useBoardStore((s) => s.update)
  const index = useItemIndex()
  const ref = useRef<HTMLInputElement>(null)
  const frame = id ? index.get(id) : undefined

  useLayoutEffect(() => { if (id) ref.current?.select() }, [id])
  if (!frame || frame.type !== 'frame') return null

  const p = toScreen(camera, frame.x, frame.y)
  const close = () => { update({ renamingFrame: null }); requestRender() }

  return (
    <input
      ref={ref}
      defaultValue={frame.title}
      onBlur={(e) => { patchItem(frame.id, { title: e.target.value }); close() }}
      onKeyDown={(e) => {
        e.stopPropagation()
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') close()
      }}
      className="absolute z-40 rounded border border-pigment bg-surface px-1 font-bold uppercase tracking-[0.13em] outline-none"
      style={{
        left: p.x,
        top: p.y - 11 * camera.z - 9,
        fontSize: Math.max(10, 11 * camera.z),
        minWidth: 120,
      }}
    />
  )
}
