import {
  Eraser, Frame, Highlighter, Image as ImageIcon, LayoutTemplate, Map as MapIcon, Maximize2,
  MessageSquare, Minus, MoreHorizontal, MousePointer2, Pen, Plus, Redo2, Spline, StickyNote,
  Table2, Type, Undo2, Workflow,
} from 'lucide-react'
import { useRef } from 'react'
import { clampZoom, fitRect, zoomAt } from '../board/camera'
import { createItems, getItems, undoManager } from '../board/doc'
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

const Divider = () => <div className="mx-1.5 h-6 w-px shrink-0 bg-[#E2DED5]" />

export function Dock() {
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
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (t: Tool) => () => { setTool(t); requestRender() }
  const canvasEl = () => document.querySelector('canvas')

  const viewportCenter = () => {
    const el = canvasEl()!
    return { x: camera.x + el.clientWidth / 2 / camera.z, y: camera.y + el.clientHeight / 2 / camera.z }
  }

  const insert = (items: Parameters<typeof createItems>[0], fit = false) => {
    createItems(items)
    const store = useBoardStore.getState()
    const el = canvasEl()
    if (fit && el) {
      store.setCamera(fitRect(boxOf(items), el.clientWidth, el.clientHeight))
      store.setSelection([])
    } else store.setSelection(items.map((i) => i.id))
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

  return (
    <div className="pointer-events-auto absolute bottom-5 left-1/2 z-40 max-w-[calc(100vw-1.5rem)] -translate-x-1/2">
      <div className="flex items-center gap-0.5 overflow-x-auto rounded-2xl border border-black/5 bg-[#FCFBF8] px-2 py-1.5 shadow-[0_6px_24px_rgba(20,19,16,0.14)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <IconButton title="Geri al — ⌘Z" onClick={() => undoManager.undo()}>
          <Undo2 size={19} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="İleri al — ⌘⇧Z" onClick={() => undoManager.redo()}>
          <Redo2 size={19} strokeWidth={1.8} />
        </IconButton>

        <Divider />

        <IconButton title="Seç — V" active={tool === 'select'} onClick={pick('select')}>
          <MousePointer2 size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton
            title="Sticky — N"
            active={tool === 'sticky'}
            onClick={() => (tool === 'sticky' ? stickyPop.toggle() : setTool('sticky'))}
          >
            <StickyNote size={20} strokeWidth={1.8} />
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-[2px] border border-black/10"
              style={{ background: stickyFill }}
            />
          </IconButton>
          <Popover open={stickyPop.open} onClose={stickyPop.close} anchor="top" className="w-[228px]">
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Sticky rengi</div>
            <ColorGrid
              colors={STICKY_COLORS}
              value={stickyFill}
              onPick={(c) => { update({ stickyFill: c }); stickyPop.close() }}
            />
          </Popover>
        </div>

        <IconButton title="Metin — T" active={tool === 'text'} onClick={pick('text')}>
          <Type size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton
            title="Şekil — S"
            active={tool === 'shape'}
            onClick={() => (tool === 'shape' ? shapePop.toggle() : setTool('shape'))}
          >
            <ShapeGlyph kind={shape.kind} />
          </IconButton>
          <Popover open={shapePop.open} onClose={shapePop.close} anchor="top" className="max-h-[60vh] w-[268px] overflow-y-auto">
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

        <IconButton title="Bağlantı — L" active={tool === 'connector'} onClick={pick('connector')}>
          <Spline size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton
            title="Kalem — P"
            active={tool === 'pen'}
            onClick={() => (tool === 'pen' ? penPop.toggle() : setTool('pen'))}
          >
            {pen.eraser ? <Eraser size={20} strokeWidth={1.8} />
              : pen.highlighter ? <Highlighter size={20} strokeWidth={1.8} />
              : <Pen size={20} strokeWidth={1.8} />}
          </IconButton>
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
                type="range" min={1} max={40}
                value={pen.strokeWidth}
                onChange={(e) => update({ pen: { ...pen, strokeWidth: +e.target.value } })}
                className="flex-1 accent-[#C8452D]"
              />
              <span className="w-6 text-right text-xs tabular-nums text-[#4A463E]">{pen.strokeWidth}</span>
            </div>
            <ColorGrid colors={LINE_COLORS} value={pen.stroke} onPick={(c) => update({ pen: { ...pen, stroke: c } })} columns={6} />
          </Popover>
        </div>

        <IconButton title="Tablo" active={tool === 'table'} onClick={pick('table')}>
          <Table2 size={20} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Zihin haritası" active={tool === 'mindmap'} onClick={pick('mindmap')}>
          <Workflow size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton
            title="Frame — F"
            active={tool === 'frame'}
            onClick={() => (tool === 'frame' ? framePop.toggle() : setTool('frame'))}
          >
            <Frame size={20} strokeWidth={1.8} />
          </IconButton>
          <Popover open={framePop.open} onClose={framePop.close} anchor="top" className="w-[212px]">
            <button
              type="button"
              onClick={() => { update({ framesPanel: true }); framePop.close() }}
              className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold text-[#C8452D] hover:bg-[#EFEBE2]"
            >
              Frame panelini aç
            </button>
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Frame boyutu</div>
            {([['16:9', 1920, 1080], ['4:3', 1600, 1200], ['1:1', 1200, 1200], ['A4 dikey', 1240, 1754], ['Telefon', 750, 1334]] as [string, number, number][]).map(
              ([label, w, h]) => (
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
              ),
            )}
          </Popover>
        </div>

        <IconButton title="Yorum — C" active={tool === 'comment'} onClick={() => {
          if (tool === 'comment') update({ commentsPanel: !useBoardStore.getState().commentsPanel })
          else setTool('comment')
          requestRender()
        }}>
          <MessageSquare size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton title="Şablonlar" active={templatePop.open} onClick={templatePop.toggle}>
            <LayoutTemplate size={20} strokeWidth={1.8} />
          </IconButton>
          <Popover open={templatePop.open} onClose={templatePop.close} anchor="top" className="w-[268px]">
            <TemplateList onPick={(items) => { insert(items, true); templatePop.close() }} />
          </Popover>
        </div>

        <IconButton title="Görsel yükle" onClick={() => fileRef.current?.click()}>
          <ImageIcon size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton title="Daha fazla" active={morePop.open} onClick={morePop.toggle}>
            <MoreHorizontal size={20} strokeWidth={1.8} />
          </IconButton>
          <Popover open={morePop.open} onClose={morePop.close} anchor="top" className="w-[268px]">
            <button
              type="button"
              onClick={() => {
                const url = prompt('Gömülecek bağlantı (YouTube, Vimeo, Loom, Figma veya herhangi bir site)')
                if (url?.trim()) insert([makeEmbed(viewportCenter().x, viewportCenter().y, url.trim())])
                morePop.close()
              }}
              className="mb-2 w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-[#C8452D] hover:bg-[#EFEBE2]"
            >
              Bağlantı göm
            </button>
            <div className="px-1 pb-1.5 text-xs font-semibold text-[#141310]">Emoji</div>
            <div className="grid grid-cols-8 gap-1">
              {EMOJI.map((glyph) => (
                <button
                  key={glyph}
                  type="button"
                  onClick={() => {
                    const c = viewportCenter()
                    const style = { ...useBoardStore.getState().textStyle, fontSize: 96, align: 'center' as const }
                    const item = makeText(c.x - 60, c.y - 60, 120, style)
                    item.text = glyph
                    item.autoWidth = true
                    insert([item])
                    morePop.close()
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg text-xl hover:bg-[#EFEBE2]"
                >
                  {glyph}
                </button>
              ))}
            </div>
          </Popover>
        </div>

        <Divider />

        <IconButton title="Minimap" active={showMinimap} onClick={() => update({ showMinimap: !showMinimap })}>
          <MapIcon size={19} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="İçeriğe sığdır — ⇧1" onClick={fitAll}>
          <Maximize2 size={18} strokeWidth={1.8} />
        </IconButton>
        <span className="hidden items-center gap-0.5 md:flex">
        <IconButton title="Uzaklaş" onClick={() => step(1 / 1.2)}>
          <Minus size={18} strokeWidth={2} />
        </IconButton>
        <div className="relative">
          <button
            type="button"
            onClick={zoomPop.toggle}
            className="min-w-[52px] rounded-lg px-1 py-1.5 text-sm font-semibold tabular-nums text-[#141310] hover:bg-[#EFEBE2]"
          >
            {Math.round(camera.z * 100)}%
          </button>
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
        <IconButton title="Yakınlaş" onClick={() => step(1.2)}>
          <Plus size={18} strokeWidth={2} />
        </IconButton>
        </span>

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

function TemplateList({ onPick }: { onPick: (items: Parameters<typeof createItems>[0]) => void }) {
  const camera = useBoardStore((s) => s.camera)
  const el = document.querySelector('canvas')
  const center = el
    ? { x: camera.x + el.clientWidth / 2 / camera.z, y: camera.y + el.clientHeight / 2 / camera.z }
    : { x: 0, y: 0 }
  return (
    <>
      <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Şablonlar</div>
      <div className="flex flex-col gap-0.5">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => onPick(t.build(center))}
            className="rounded-lg px-2.5 py-2 text-left hover:bg-[#EFEBE2]"
          >
            <div className="text-sm font-semibold text-[#141310]">{t.name}</div>
            <div className="text-xs text-[#8A867C]">{t.description}</div>
          </button>
        ))}
      </div>
    </>
  )
}
