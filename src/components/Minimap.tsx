import { useEffect, useRef } from 'react'
import { viewportRect } from '../board/camera'
import { aabb, union } from '../board/geometry'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'

const W = 190
const H = 120

export function Minimap() {
  const ref = useRef<HTMLCanvasElement>(null)
  const items = useItems()
  const camera = useBoardStore((s) => s.camera)
  const setCamera = useBoardStore((s) => s.setCamera)

  useEffect(() => {
    const canvas = ref.current!
    const ctx = canvas.getContext('2d')!
    const dpr = window.devicePixelRatio || 1
    canvas.width = W * dpr
    canvas.height = H * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const view = viewportRect(camera, window.innerWidth, window.innerHeight)
    const world = union([...items.map(aabb), view])
    const pad = Math.max(world.w, world.h) * 0.06 + 40
    const scale = Math.min((W - 12) / (world.w + pad * 2), (H - 12) / (world.h + pad * 2))
    const ox = 6 - (world.x - pad) * scale
    const oy = 6 - (world.y - pad) * scale

    for (const item of items) {
      const r = aabb(item)
      ctx.fillStyle =
        item.type === 'sticky' ? item.fill :
        item.type === 'frame' ? '#EAE6DD' :
        item.type === 'shape' ? (item.fill === 'transparent' ? '#C9C9D4' : item.fill) : '#C9C9D4'
      ctx.fillRect(ox + r.x * scale, oy + r.y * scale, Math.max(1.5, r.w * scale), Math.max(1.5, r.h * scale))
    }
    ctx.strokeStyle = '#C8452D'
    ctx.lineWidth = 1.5
    ctx.strokeRect(ox + view.x * scale, oy + view.y * scale, view.w * scale, view.h * scale)

    const onDown = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      const bx = (e.clientX - rect.left - ox) / scale
      const by = (e.clientY - rect.top - oy) / scale
      setCamera((c) => ({ ...c, x: bx - window.innerWidth / 2 / c.z, y: by - window.innerHeight / 2 / c.z }))
      requestRender()
    }
    canvas.addEventListener('pointerdown', onDown)
    return () => canvas.removeEventListener('pointerdown', onDown)
  }, [items, camera, setCamera])

  return (
    <canvas
      ref={ref}
      style={{ width: W, height: H }}
      className="cursor-pointer rounded-xl border border-black/5 bg-[#FCFBF8] shadow-[2px_2px_0_rgba(20,19,16,0.07)]"
    />
  )
}
