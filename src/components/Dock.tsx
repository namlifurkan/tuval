import {
  Eraser, Frame, Highlighter, Image as ImageIcon, LayoutTemplate, Map as MapIcon, Maximize2,
  MessageSquare, Minus, MoreHorizontal, MousePointer2, Pen, Plus, Redo2, RotateCcw, Settings2,
  Spline, StickyNote, Table2, Type, Undo2, Workflow,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { clampZoom, fitRect, zoomAt } from '../board/camera'
import { createItems, getItems, undoManager } from '../board/doc'
import {
  DEFAULT_ORDER, DOCK_LABELS, getDockPrefs, moveDockItem, resetDock, setDockSize, setMagnify,
  SIZE_PX, subscribeDock, toggleDockItem, visibleDockItems,
} from '../board/dockPrefs'
import type { DockItemId, DockSize } from '../board/dockPrefs'
import { makeEmbed, makeFrame, makeImage, makeText } from '../board/items'
import { boxOf } from '../board/render'
import { SHAPE_GROUPS, shapeToSvgPath } from '../board/shapes'
import { TEMPLATES } from '../board/templates'
import { requestRender, useBoardStore } from '../board/store'
import type { Tool } from '../board/store'
import { LINE_COLORS, STICKY_COLORS, type ShapeKind } from '../board/types'
import { ColorGrid, IconButton, Popover, usePopover } from './ui'

const EMOJI = [
  '👍', '👎', '❤️', '🔥', '✅', '❌', '⭐', '🎯',
  '💡', '⚠️', '❓', '🚀', '🐛', '📌', '⏳', '🎉',
]

const MAGNIFY_AMPLITUDE = 0.5
const MAGNIFY_SPREAD = 66

const dCache = new Map<ShapeKind, string>()

export function ShapeGlyph({ kind, size = 20 }: { kind: ShapeKind; size?: number }) {
  let d = dCache.get(kind)
  if (!d) {
    d = shapeToSvgPath(kind, 2.5, 2.5, 19, 19)
    dCache.set(kind, d)
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d={d} stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" />
    </svg>
  )
}

export function Dock() {
  const prefs = useSyncExternalStore(subscribeDock, getDockPrefs, getDockPrefs)
  const items = useSyncExternalStore(subscribeDock, visibleDockItems, visibleDockItems)

  const tool = useBoardStore((s) => s.tool)
  const setTool = useBoardStore((s) => s.setTool)
  const camera = useBoardStore((s) => s.camera)
  const setCamera = useBoardStore((s) => s.setCamera)
  const stickyFill = useBoardStore((s) => s.stickyFill)
  const shape = useBoardStore((s) => s.shape)
  const pen = useBoardStore((s) => s.pen)
  const showMinimap = useBoardStore((s) => s.showMinimap)
  const update = useBoardStore((s) => s.update)

  const stickyPop = usePopover()
  const shapePop = usePopover()
  const penPop = usePopover()
  const templatePop = usePopover()
  const framePop = usePopover()
  const morePop = usePopover()
  const zoomPop = usePopover()
  const settingsPop = usePopover()

  const fileRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<DockItemId | null>(null)

  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches
  const magnify = prefs.magnify && !reduceMotion
  const unit = SIZE_PX[prefs.size]
  const glyph = Math.round(unit * 0.52)

  const resetScale = useCallback(() => {
    barRef.current?.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      el.style.transform = ''
    })
  }, [])

  useEffect(() => { if (!magnify) resetScale() }, [magnify, resetScale])

  const onMove = (e: React.PointerEvent) => {
    if (!magnify || dragId) return
    barRef.current?.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      const rect = el.getBoundingClientRect()
      const distance = Math.abs(rect.left + rect.width / 2 - e.clientX)
      const scale = 1 + MAGNIFY_AMPLITUDE * Math.exp(-((distance / MAGNIFY_SPREAD) ** 2))
      el.style.transform = `translateY(${-(scale - 1) * unit * 0.55}px) scale(${scale})`
    })
  }

  const pick = (t: Tool) => () => { setTool(t); requestRender() }
  const canvasEl = () => document.querySelector('canvas')

  const viewportCenter = () => {
    const el = canvasEl()!
    return { x: camera.x + el.clientWidth / 2 / camera.z, y: camera.y + el.clientHeight / 2 / camera.z }
  }

  const insert = (list: Parameters<typeof createItems>[0], fit = false) => {
    createItems(list)
    const store = useBoardStore.getState()
    const el = canvasEl()
    if (fit && el) {
      store.setCamera(fitRect(boxOf(list), el.clientWidth, el.clientHeight))
      store.setSelection([])
    } else store.setSelection(list.map((i) => i.id))
    requestRender()
  }

  const step = (factor: number) => {
    const el = canvasEl()!
    setCamera(zoomAt(camera, el.clientWidth / 2, el.clientHeight / 2, clampZoom(camera.z * factor)))
    requestRender()
  }

  const fitAll = () => {
    const el = canvasEl()!
    const all = getItems()
    setCamera(all.length ? fitRect(boxOf(all), el.clientWidth, el.clientHeight) : { ...camera, z: 1 })
    requestRender()
  }

  const button = (title: string, active: boolean, onClick: () => void, icon: ReactNode) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      style={{ width: unit, height: unit }}
      className={`tap-target grid place-items-center rounded-xl transition-colors
        ${active ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#141310] hover:bg-[#EFEBE2]'}`}
    >
      {icon}
    </button>
  )

  const renderItem = (id: DockItemId): ReactNode => {
    switch (id) {
      case 'undo': return button('Geri al — ⌘Z', false, () => undoManager.undo(), <Undo2 size={glyph} strokeWidth={1.8} />)
      case 'redo': return button('İleri al — ⌘⇧Z', false, () => undoManager.redo(), <Redo2 size={glyph} strokeWidth={1.8} />)
      case 'select': return button('Seç — V', tool === 'select', pick('select'), <MousePointer2 size={glyph} strokeWidth={1.8} />)
      case 'text': return button('Metin — T', tool === 'text', pick('text'), <Type size={glyph} strokeWidth={1.8} />)
      case 'connector': return button('Bağlantı — L', tool === 'connector', pick('connector'), <Spline size={glyph} strokeWidth={1.8} />)
      case 'table': return button('Tablo', tool === 'table', pick('table'), <Table2 size={glyph} strokeWidth={1.8} />)
      case 'mindmap': return button('Zihin haritası', tool === 'mindmap', pick('mindmap'), <Workflow size={glyph} strokeWidth={1.8} />)
      case 'image': return button('Görsel yükle', false, () => fileRef.current?.click(), <ImageIcon size={glyph} strokeWidth={1.8} />)
      case 'minimap': return button('Minimap', showMinimap, () => update({ showMinimap: !showMinimap }), <MapIcon size={glyph} strokeWidth={1.8} />)
      case 'fit': return button('İçeriğe sığdır — ⇧1', false, fitAll, <Maximize2 size={glyph - 1} strokeWidth={1.8} />)
      case 'comment':
        return button('Yorum — C', tool === 'comment', () => {
          if (tool === 'comment') update({ commentsPanel: !useBoardStore.getState().commentsPanel })
          else setTool('comment')
          requestRender()
        }, <MessageSquare size={glyph} strokeWidth={1.8} />)

      case 'sticky':
        return (
          <div className="relative">
            {button('Sticky — N', tool === 'sticky', () => (tool === 'sticky' ? stickyPop.toggle() : setTool('sticky')),
              <span className="relative grid place-items-center">
                <StickyNote size={glyph} strokeWidth={1.8} />
                <span className="absolute -bottom-1.5 -right-1.5 h-2 w-2 rounded-[2px] border border-black/10" style={{ background: stickyFill }} />
              </span>)}
            <Popover open={stickyPop.open} onClose={stickyPop.close} anchor="top" className="w-[228px]">
              <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Sticky rengi</div>
              <ColorGrid colors={STICKY_COLORS} value={stickyFill} onPick={(c) => { update({ stickyFill: c }); stickyPop.close() }} />
            </Popover>
          </div>
        )

      case 'shape':
        return (
          <div className="relative">
            {button('Şekil — S', tool === 'shape', () => (tool === 'shape' ? shapePop.toggle() : setTool('shape')), <ShapeGlyph kind={shape.kind} size={glyph} />)}
            <Popover open={shapePop.open} onClose={shapePop.close} anchor="top" className="w-[268px]">
              {SHAPE_GROUPS.map((group) => (
                <div key={group.name} className="mb-2 last:mb-0">
                  <div className="px-1 pb-1.5 pt-1 text-xs font-semibold text-[#141310]">{group.name}</div>
                  <div className="grid grid-cols-6 gap-1">
                    {group.kinds.map((k) => (
                      <button
                        key={`${group.name}-${k}`}
                        type="button"
                        title={k}
                        onClick={() => { update({ shape: { ...shape, kind: k } }); setTool('shape'); shapePop.close() }}
                        className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-[#EFEBE2]
                          ${shape.kind === k ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#141310]'}`}
                      >
                        <ShapeGlyph kind={k} size={22} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </Popover>
          </div>
        )

      case 'pen':
        return (
          <div className="relative">
            {button('Kalem — P', tool === 'pen', () => (tool === 'pen' ? penPop.toggle() : setTool('pen')),
              pen.eraser ? <Eraser size={glyph} strokeWidth={1.8} />
                : pen.highlighter ? <Highlighter size={glyph} strokeWidth={1.8} />
                : <Pen size={glyph} strokeWidth={1.8} />)}
            <Popover open={penPop.open} onClose={penPop.close} anchor="top" className="w-[212px]">
              <div className="mb-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => update({ pen: { ...pen, highlighter: false, eraser: false } })}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${!pen.highlighter && !pen.eraser ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                >Kalem</button>
                <button
                  type="button"
                  onClick={() => update({ pen: { ...pen, highlighter: true, eraser: false, strokeWidth: Math.max(pen.strokeWidth, 16) } })}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${pen.highlighter && !pen.eraser ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                >Marker</button>
                <button
                  type="button"
                  onClick={() => update({ pen: { ...pen, eraser: true } })}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${pen.eraser ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                >Silgi</button>
              </div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Minus size={14} />
                <input
                  type="range" min={1} max={40} value={pen.strokeWidth}
                  onChange={(e) => update({ pen: { ...pen, strokeWidth: +e.target.value } })}
                  className="flex-1 accent-[#C8452D]"
                />
                <span className="w-6 text-right text-xs tabular-nums text-[#4A463E]">{pen.strokeWidth}</span>
              </div>
              <ColorGrid colors={LINE_COLORS} value={pen.stroke} onPick={(c) => update({ pen: { ...pen, stroke: c } })} columns={6} />
            </Popover>
          </div>
        )

      case 'frame':
        return (
          <div className="relative">
            {button('Frame — F', tool === 'frame', () => (tool === 'frame' ? framePop.toggle() : setTool('frame')), <Frame size={glyph} strokeWidth={1.8} />)}
            <Popover open={framePop.open} onClose={framePop.close} anchor="top" className="w-[212px]">
              <button
                type="button"
                onClick={() => { update({ framesPanel: true }); framePop.close() }}
                className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold text-[#C8452D] hover:bg-[#EFEBE2]"
              >Frame panelini aç</button>
              <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Frame boyutu</div>
              {([['16:9', 1920, 1080], ['4:3', 1600, 1200], ['1:1', 1200, 1200], ['A4 dikey', 1240, 1754], ['Telefon', 750, 1334]] as [string, number, number][]).map(([label, w, h]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const c = viewportCenter()
                    const n = getItems().filter((i) => i.type === 'frame').length + 1
                    insert([makeFrame(c.x - w / 2, c.y - h / 2, w, h, `Frame ${n}`)], true)
                    framePop.close()
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
                >
                  <span className="font-medium text-[#141310]">{label}</span>
                  <span className="text-xs text-[#8A867C]">{w}×{h}</span>
                </button>
              ))}
            </Popover>
          </div>
        )

      case 'templates':
        return (
          <div className="relative">
            {button('Şablonlar', templatePop.open, templatePop.toggle, <LayoutTemplate size={glyph} strokeWidth={1.8} />)}
            <Popover open={templatePop.open} onClose={templatePop.close} anchor="top" className="w-[268px]">
              <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Şablonlar</div>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { insert(t.build(viewportCenter()), true); templatePop.close() }}
                  className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-[#EFEBE2]"
                >
                  <div className="text-sm font-semibold text-[#141310]">{t.name}</div>
                  <div className="text-xs text-[#8A867C]">{t.description}</div>
                </button>
              ))}
            </Popover>
          </div>
        )

      case 'more':
        return (
          <div className="relative">
            {button('Daha fazla', morePop.open, morePop.toggle, <MoreHorizontal size={glyph} strokeWidth={1.8} />)}
            <Popover open={morePop.open} onClose={morePop.close} anchor="top" className="w-[268px]">
              <button
                type="button"
                onClick={() => {
                  const url = prompt('Gömülecek bağlantı (YouTube, Vimeo, Loom, Figma veya herhangi bir site)')
                  if (url?.trim()) { const c = viewportCenter(); insert([makeEmbed(c.x, c.y, url.trim())]) }
                  morePop.close()
                }}
                className="mb-2 w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-[#C8452D] hover:bg-[#EFEBE2]"
              >Bağlantı göm</button>
              <div className="px-1 pb-1.5 text-xs font-semibold text-[#141310]">Emoji</div>
              <div className="grid grid-cols-8 gap-1">
                {EMOJI.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => {
                      const c = viewportCenter()
                      const style = { ...useBoardStore.getState().textStyle, fontSize: 96, align: 'center' as const }
                      const item = makeText(c.x - 60, c.y - 60, 120, style)
                      item.text = g
                      item.autoWidth = true
                      insert([item])
                      morePop.close()
                    }}
                    className="grid h-8 w-8 place-items-center rounded-lg text-xl hover:bg-[#EFEBE2]"
                  >{g}</button>
                ))}
              </div>
            </Popover>
          </div>
        )

      case 'zoom':
        return (
          <div className="relative flex items-center gap-0.5">
            {button('Uzaklaş', false, () => step(1 / 1.2), <Minus size={glyph - 2} strokeWidth={2} />)}
            <button
              type="button"
              onClick={zoomPop.toggle}
              style={{ height: unit }}
              className="min-w-[50px] rounded-lg px-1 text-sm font-semibold tabular-nums text-[#141310] hover:bg-[#EFEBE2]"
            >
              {Math.round(camera.z * 100)}%
            </button>
            {button('Yakınlaş', false, () => step(1.2), <Plus size={glyph - 2} strokeWidth={2} />)}
            <Popover open={zoomPop.open} onClose={zoomPop.close} anchor="top" className="w-[200px]">
              {[0.5, 1, 2, 4].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => {
                    const el = canvasEl()!
                    setCamera(zoomAt(camera, el.clientWidth / 2, el.clientHeight / 2, z))
                    requestRender()
                    zoomPop.close()
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
                >
                  <span>{z * 100}%</span>
                  {z === 1 && <span className="text-xs text-[#8A867C]">⇧3</span>}
                </button>
              ))}
            </Popover>
          </div>
        )
    }
  }

  return (
    <div className="pointer-events-auto absolute bottom-5 left-1/2 z-40 max-w-[calc(100vw-1.5rem)] -translate-x-1/2">
      <div
        ref={barRef}
        onPointerMove={onMove}
        onPointerLeave={resetScale}
        onContextMenu={(e) => { e.preventDefault(); settingsPop.setOpen(true) }}
        className="flex items-end gap-0.5 overflow-x-auto rounded-2xl border border-black/5 bg-[#FCFBF8] px-2 py-1.5 shadow-[0_6px_24px_rgba(20,19,16,0.14)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((id) => (
          <div
            key={id}
            data-slot
            draggable
            onDragStart={() => setDragId(id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId && dragId !== id) moveDockItem(dragId, id); setDragId(null) }}
            style={{ transition: 'transform 130ms cubic-bezier(0.22, 1, 0.36, 1)' }}
            className={`shrink-0 origin-bottom ${dragId === id ? 'opacity-40' : ''}`}
          >
            {renderItem(id)}
          </div>
        ))}

        <div
          className="ml-0.5 flex shrink-0 items-center self-stretch border-l border-[#E2DED5] pl-1"
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragId) moveDockItem(dragId, null); setDragId(null) }}
        >
          <div className="relative">
            <IconButton title="Dock ayarları (sağ tık)" active={settingsPop.open} onClick={settingsPop.toggle}>
              <Settings2 size={17} strokeWidth={1.8} />
            </IconButton>
            <Popover open={settingsPop.open} onClose={settingsPop.close} anchor="top" className="w-[248px]">
              <div className="mb-1 px-1 text-xs font-semibold text-[#141310]">Boyut</div>
              <div className="mb-2 flex gap-1">
                {(['sm', 'md', 'lg'] as DockSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDockSize(s)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold uppercase
                      ${prefs.size === s ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}`}
                  >{s}</button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMagnify(!prefs.magnify)}
                className="mb-2 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
              >
                <span>Büyüteç</span>
                <span className="text-xs text-[#8A867C]">{prefs.magnify ? 'Açık' : 'Kapalı'}</span>
              </button>

              <div className="mb-1 border-t border-[#EAE6DD] px-1 pt-2 text-xs font-semibold text-[#141310]">
                Görünen araçlar
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {DEFAULT_ORDER.map((id) => (
                  <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-[#EFEBE2]">
                    <input
                      type="checkbox"
                      checked={!prefs.hidden.includes(id)}
                      onChange={() => toggleDockItem(id)}
                      className="accent-[#C8452D]"
                    />
                    {DOCK_LABELS[id]}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => resetDock()}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#E2DED5] px-2 py-1.5 text-xs font-semibold hover:bg-[#EFEBE2]"
              >
                <RotateCcw size={12} /> Varsayılana dön
              </button>
              <p className="mt-2 px-1 text-[11px] leading-snug text-[#8A867C]">
                Araçları sürükleyerek sıralayabilirsin.
              </p>
            </Popover>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const center = viewportCenter()
            for (const file of e.target.files ?? []) {
              const reader = new FileReader()
              reader.onload = () => {
                const img = new Image()
                img.onload = () => {
                  const scale = Math.min(1, 600 / img.width)
                  const w = img.width * scale, h = img.height * scale
                  createItems([makeImage(center.x - w / 2, center.y - h / 2, w, h, reader.result as string)])
                  requestRender()
                }
                img.src = reader.result as string
              }
              reader.readAsDataURL(file)
            }
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
