import {
  Circle, Diamond, Eraser, Frame, Highlighter, Image as ImageIcon, LayoutTemplate, Minus,
  MessageSquare, MousePointer2, MoreHorizontal, Pen, Redo2, Spline, Square, StickyNote, Table2,
  Triangle, Type, Undo2,
} from 'lucide-react'
import { useRef } from 'react'
import { fitRect } from '../board/camera'
import { createItems, getItems, undoManager } from '../board/doc'
import { makeFrame, makeImage } from '../board/items'
import { boxOf } from '../board/render'
import { TEMPLATES } from '../board/templates'
import { SHAPE_LIST, shapeToSvgPath } from '../board/shapes'
import { requestRender, useBoardStore } from '../board/store'
import type { Tool } from '../board/store'
import { LINE_COLORS, STICKY_COLORS, type ShapeKind } from '../board/types'
import { ColorGrid, IconButton, Popover, usePopover } from './ui'

const SHAPE_ICONS: Partial<Record<ShapeKind, typeof Square>> = {
  rect: Square, ellipse: Circle, triangle: Triangle, diamond: Diamond,
}

const dCache = new Map<ShapeKind, string>()

export function ShapeGlyph({ kind, size = 20 }: { kind: ShapeKind; size?: number }) {
  const Icon = SHAPE_ICONS[kind]
  if (Icon) return <Icon size={size} strokeWidth={1.7} />
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

export function Toolbar() {
  const tool = useBoardStore((s) => s.tool)
  const setTool = useBoardStore((s) => s.setTool)
  const stickyFill = useBoardStore((s) => s.stickyFill)
  const shape = useBoardStore((s) => s.shape)
  const pen = useBoardStore((s) => s.pen)
  const update = useBoardStore((s) => s.update)
  const stickyPop = usePopover()
  const shapePop = usePopover()
  const penPop = usePopover()
  const templatePop = usePopover()
  const framePop = usePopover()
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (t: Tool) => () => { setTool(t); requestRender() }

  const viewportCenter = () => {
    const el = document.querySelector('canvas')!
    const cam = useBoardStore.getState().camera
    return { x: cam.x + el.clientWidth / 2 / cam.z, y: cam.y + el.clientHeight / 2 / cam.z }
  }

  const insert = (items: ReturnType<typeof makeFrame>[] | Parameters<typeof createItems>[0]) => {
    createItems(items)
    const el = document.querySelector('canvas')!
    useBoardStore.getState().setCamera(fitRect(boxOf(items), el.clientWidth, el.clientHeight))
    useBoardStore.getState().setSelection([])
    requestRender()
  }

  return (
    <div className="pointer-events-auto absolute left-4 top-1/2 z-40 -translate-y-1/2">
      <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-black/5 bg-[#FCFBF8] p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
        <IconButton title="Select — V" active={tool === 'select'} onClick={pick('select')}>
          <MousePointer2 size={20} strokeWidth={1.8} />
        </IconButton>
        <div className="relative">
          <IconButton title="Templates" active={templatePop.open} onClick={templatePop.toggle}>
            <LayoutTemplate size={20} strokeWidth={1.8} />
          </IconButton>
          <Popover open={templatePop.open} onClose={templatePop.close} className="w-[268px]">
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Şablonlar</div>
            <div className="flex flex-col gap-0.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { insert(t.build(viewportCenter())); templatePop.close() }}
                  className="rounded-lg px-2.5 py-2 text-left hover:bg-[#EFEBE2]"
                >
                  <div className="text-sm font-semibold text-[#141310]">{t.name}</div>
                  <div className="text-xs text-[#8A867C]">{t.description}</div>
                </button>
              ))}
            </div>
          </Popover>
        </div>
        <IconButton title="Text — T" active={tool === 'text'} onClick={pick('text')}>
          <Type size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton
            title="Sticky note — N"
            active={tool === 'sticky'}
            onClick={(e) => {
              if (tool === 'sticky') stickyPop.toggle()
              else setTool('sticky')
              void e
            }}
          >
            <StickyNote size={20} strokeWidth={1.8} style={{ color: tool === 'sticky' ? undefined : '#141310' }} />
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-[2px] border border-black/10"
              style={{ background: stickyFill }}
            />
          </IconButton>
          <Popover open={stickyPop.open} onClose={stickyPop.close} className="w-[228px]">
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Sticky note color</div>
            <ColorGrid
              colors={STICKY_COLORS}
              value={stickyFill}
              onPick={(c) => { update({ stickyFill: c }); stickyPop.close() }}
            />
          </Popover>
        </div>

        <div className="relative">
          <IconButton
            title="Shapes — S"
            active={tool === 'shape'}
            onClick={() => { tool === 'shape' ? shapePop.toggle() : setTool('shape') }}
          >
            <ShapeGlyph kind={shape.kind} />
          </IconButton>
          <Popover open={shapePop.open} onClose={shapePop.close} className="w-[268px]">
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Shapes</div>
            <div className="grid grid-cols-6 gap-1">
              {SHAPE_LIST.map((k) => (
                <button
                  key={k}
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
          </Popover>
        </div>

        <IconButton title="Tablo" active={tool === 'table'} onClick={pick('table')}>
          <Table2 size={20} strokeWidth={1.8} />
        </IconButton>

        <IconButton title="Connection line — L" active={tool === 'connector'} onClick={pick('connector')}>
          <Spline size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton
            title="Pen — P"
            active={tool === 'pen'}
            onClick={() => { tool === 'pen' ? penPop.toggle() : setTool('pen') }}
          >
            {pen.eraser
              ? <Eraser size={20} strokeWidth={1.8} />
              : pen.highlighter ? <Highlighter size={20} strokeWidth={1.8} /> : <Pen size={20} strokeWidth={1.8} />}
          </IconButton>
          <Popover open={penPop.open} onClose={penPop.close} className="w-[212px]">
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
                type="range"
                min={1}
                max={40}
                value={pen.strokeWidth}
                onChange={(e) => update({ pen: { ...pen, strokeWidth: +e.target.value } })}
                className="flex-1 accent-[#C8452D]"
              />
              <span className="w-6 text-right text-xs tabular-nums text-[#585858]">{pen.strokeWidth}</span>
            </div>
            <ColorGrid
              colors={LINE_COLORS}
              value={pen.stroke}
              onPick={(c) => update({ pen: { ...pen, stroke: c } })}
              columns={6}
            />
          </Popover>
        </div>

        <IconButton
          title="Yorum — C (tekrar tıkla: panel)"
          active={tool === 'comment'}
          onClick={() => {
            if (tool === 'comment') update({ commentsPanel: !useBoardStore.getState().commentsPanel })
            else setTool('comment')
            requestRender()
          }}
        >
          <MessageSquare size={20} strokeWidth={1.8} />
        </IconButton>
        <div className="relative">
          <IconButton
            title="Frame — F"
            active={tool === 'frame'}
            onClick={() => { tool === 'frame' ? framePop.toggle() : setTool('frame') }}
          >
            <Frame size={20} strokeWidth={1.8} />
          </IconButton>
          <Popover open={framePop.open} onClose={framePop.close} className="w-[212px]">
            <button
              type="button"
              onClick={() => { update({ framesPanel: true }); framePop.close() }}
              className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold text-[#C8452D] hover:bg-[#EFEBE2]"
            >
              Frame panelini aç
            </button>
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#141310]">Frame boyutu</div>
            <div className="flex flex-col gap-0.5">
              {([['16:9', 1920, 1080], ['4:3', 1600, 1200], ['1:1', 1200, 1200], ['A4 dikey', 1240, 1754], ['Telefon', 750, 1334]] as [string, number, number][]).map(
                ([label, w, h]) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const c = viewportCenter()
                      const n = getItems().filter((i) => i.type === 'frame').length + 1
                      insert([makeFrame(c.x - w / 2, c.y - h / 2, w, h, `Frame ${n}`)])
                      framePop.close()
                    }}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
                  >
                    <span className="font-medium text-[#141310]">{label}</span>
                    <span className="text-xs text-[#8A867C]">{w}×{h}</span>
                  </button>
                ),
              )}
            </div>
          </Popover>
        </div>
        <IconButton title="Upload image" onClick={() => fileRef.current?.click()}>
          <ImageIcon size={20} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="More">
          <MoreHorizontal size={20} strokeWidth={1.8} />
        </IconButton>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const cam = useBoardStore.getState().camera
            const center = { x: cam.x + window.innerWidth / 2 / cam.z, y: cam.y + window.innerHeight / 2 / cam.z }
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

      <div className="mt-2 flex flex-col items-center gap-0.5 rounded-2xl border border-black/5 bg-[#FCFBF8] p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
        <IconButton title="Undo — ⌘Z" onClick={() => undoManager.undo()}>
          <Undo2 size={19} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Redo — ⌘⇧Z" onClick={() => undoManager.redo()}>
          <Redo2 size={19} strokeWidth={1.8} />
        </IconButton>
      </div>
    </div>
  )
}
