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
      className="absolute z-40 rounded border border-[#C8452D] bg-white px-1 outline-none"
      style={{
        left: p.x,
        top: p.y - 13 * camera.z - 8,
        fontSize: Math.max(11, 13 * camera.z),
        minWidth: 120,
      }}
    />
  )
}
