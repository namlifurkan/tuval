import { Map as MapIcon, Maximize2, Minus, Plus } from 'lucide-react'
import { clampZoom, fitRect, zoomAt } from '../board/camera'
import { getItems } from '../board/doc'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { Minimap } from './Minimap'
import { IconButton } from './ui'

export function ZoomControls() {
  const camera = useBoardStore((s) => s.camera)
  const setCamera = useBoardStore((s) => s.setCamera)
  const showMinimap = useBoardStore((s) => s.showMinimap)
  const update = useBoardStore((s) => s.update)

  const step = (factor: number) => {
    const el = document.querySelector('canvas')!
    setCamera(zoomAt(camera, el.clientWidth / 2, el.clientHeight / 2, clampZoom(camera.z * factor)))
    requestRender()
  }
  const fit = () => {
    const el = document.querySelector('canvas')!
    const all = getItems()
    if (!all.length) return setCamera({ ...camera, z: 1 })
    setCamera(fitRect(boxOf(all), el.clientWidth, el.clientHeight))
    requestRender()
  }

  return (
    <div className="pointer-events-auto absolute bottom-4 right-4 z-40 flex flex-col items-end gap-2">
      {showMinimap && <Minimap />}
      <div className="flex items-center gap-0.5 rounded-xl border border-black/5 bg-white p-1 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
        <IconButton title="Minimap" active={showMinimap} onClick={() => update({ showMinimap: !showMinimap })}>
          <MapIcon size={18} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Zoom to fit — ⇧1" onClick={fit}>
          <Maximize2 size={17} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Zoom out" onClick={() => step(1 / 1.2)}>
          <Minus size={18} strokeWidth={2} />
        </IconButton>
        <button
          type="button"
          onDoubleClick={() => { setCamera({ ...camera, z: 1 }); requestRender() }}
          className="min-w-[54px] rounded-lg px-2 py-1.5 text-sm font-semibold tabular-nums text-[#050038] hover:bg-[#F1F1F3]"
          title="Double-click for 100%"
        >
          {Math.round(camera.z * 100)}%
        </button>
        <IconButton title="Zoom in" onClick={() => step(1.2)}>
          <Plus size={18} strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  )
}
