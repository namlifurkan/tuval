import { Map as MapIcon, Maximize2, Minus, Plus } from 'lucide-react'
import { clampZoom, fitRect, zoomAt } from '../board/camera'
import { getItems } from '../board/doc'
import { boxOf } from '../board/render'
import { requestRender, useBoardStore } from '../board/store'
import { Minimap } from './Minimap'
import { IconButton, Popover, usePopover } from './ui'

export function ZoomControls() {
  const camera = useBoardStore((s) => s.camera)
  const setCamera = useBoardStore((s) => s.setCamera)
  const showMinimap = useBoardStore((s) => s.showMinimap)
  const showGrid = useBoardStore((s) => s.showGrid)
  const selection = useBoardStore((s) => s.selection)
  const update = useBoardStore((s) => s.update)
  const zoomPop = usePopover()

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
        <div className="relative">
          <button
            type="button"
            onClick={zoomPop.toggle}
            className="min-w-[54px] rounded-lg px-2 py-1.5 text-sm font-semibold tabular-nums text-[#141310] hover:bg-[#EFEBE2]"
          >
            {Math.round(camera.z * 100)}%
          </button>
          <Popover open={zoomPop.open} onClose={zoomPop.close} anchor="topLeft" className="w-[214px]">
            <button
              type="button"
              onClick={() => { fit(); zoomPop.close() }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
            >
              <span>İçeriğe sığdır</span><span className="text-xs text-[#8A867C]">⇧1</span>
            </button>
            <button
              type="button"
              disabled={!selection.length}
              onClick={() => {
                const el = document.querySelector('canvas')!
                const index = getItems().filter((i) => selection.includes(i.id))
                if (index.length) setCamera(fitRect(boxOf(index), el.clientWidth, el.clientHeight))
                requestRender(); zoomPop.close()
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2] disabled:opacity-35"
            >
              <span>Seçime yakınlaş</span><span className="text-xs text-[#8A867C]">⇧2</span>
            </button>
            <div className="my-1 h-px bg-[#EAE6DD]" />
            {[0.5, 1, 2, 4].map((z) => (
              <button
                key={z}
                type="button"
                onClick={() => { setCamera(zoomAt(camera, innerWidth / 2, innerHeight / 2, z)); requestRender(); zoomPop.close() }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <span>{z * 100}%</span>
                {z === 1 && <span className="text-xs text-[#8A867C]">⇧3</span>}
              </button>
            ))}
            <div className="my-1 h-px bg-[#EAE6DD]" />
            <button
              type="button"
              onClick={() => { update({ showGrid: !showGrid }); requestRender() }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
            >
              <span>Izgara</span>
              <span className="text-xs text-[#8A867C]">{showGrid ? 'Açık' : 'Kapalı'}</span>
            </button>
          </Popover>
        </div>
        <IconButton title="Zoom in" onClick={() => step(1.2)}>
          <Plus size={18} strokeWidth={2} />
        </IconButton>
      </div>
    </div>
  )
}
