import {
  Circle, Diamond, Frame, Highlighter, Image as ImageIcon, LayoutTemplate, Minus,
  MessageSquare, MousePointer2, MoreHorizontal, Pen, Redo2, Spline, Square, StickyNote,
  Triangle, Type, Undo2,
} from 'lucide-react'
import { useRef } from 'react'
import { createItems, undoManager } from '../board/doc'
import { makeImage } from '../board/items'
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
  const fileRef = useRef<HTMLInputElement>(null)

  const pick = (t: Tool) => () => { setTool(t); requestRender() }

  return (
    <div className="pointer-events-auto absolute left-4 top-1/2 z-40 -translate-y-1/2">
      <div className="flex flex-col items-center gap-0.5 rounded-2xl border border-black/5 bg-white p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
        <IconButton title="Select — V" active={tool === 'select'} onClick={pick('select')}>
          <MousePointer2 size={20} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Templates" onClick={() => {}}>
          <LayoutTemplate size={20} strokeWidth={1.8} />
        </IconButton>
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
            <StickyNote size={20} strokeWidth={1.8} style={{ color: tool === 'sticky' ? undefined : '#050038' }} />
            <span
              className="absolute bottom-1 right-1 h-2 w-2 rounded-[2px] border border-black/10"
              style={{ background: stickyFill }}
            />
          </IconButton>
          <Popover open={stickyPop.open} onClose={stickyPop.close} className="w-[228px]">
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#050038]">Sticky note color</div>
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
            <div className="px-1 pb-2 pt-1 text-xs font-semibold text-[#050038]">Shapes</div>
            <div className="grid grid-cols-6 gap-1">
              {SHAPE_LIST.map((k) => (
                <button
                  key={k}
                  type="button"
                  title={k}
                  onClick={() => { update({ shape: { ...shape, kind: k } }); setTool('shape'); shapePop.close() }}
                  className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-[#F1F1F3]
                    ${shape.kind === k ? 'bg-[#E8ECFF] text-[#4262FF]' : 'text-[#050038]'}`}
                >
                  <ShapeGlyph kind={k} size={22} />
                </button>
              ))}
            </div>
          </Popover>
        </div>

        <IconButton title="Connection line — L" active={tool === 'connector'} onClick={pick('connector')}>
          <Spline size={20} strokeWidth={1.8} />
        </IconButton>

        <div className="relative">
          <IconButton
            title="Pen — P"
            active={tool === 'pen'}
            onClick={() => { tool === 'pen' ? penPop.toggle() : setTool('pen') }}
          >
            {pen.highlighter ? <Highlighter size={20} strokeWidth={1.8} /> : <Pen size={20} strokeWidth={1.8} />}
          </IconButton>
          <Popover open={penPop.open} onClose={penPop.close} className="w-[212px]">
            <div className="mb-2 flex gap-1">
              <button
                type="button"
                onClick={() => update({ pen: { ...pen, highlighter: false } })}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${!pen.highlighter ? 'bg-[#E8ECFF] text-[#4262FF]' : 'hover:bg-[#F1F1F3]'}`}
              >Pen</button>
              <button
                type="button"
                onClick={() => update({ pen: { ...pen, highlighter: true, strokeWidth: Math.max(pen.strokeWidth, 16) } })}
                className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${pen.highlighter ? 'bg-[#E8ECFF] text-[#4262FF]' : 'hover:bg-[#F1F1F3]'}`}
              >Marker</button>
            </div>
            <div className="mb-2 flex items-center gap-2 px-1">
              <Minus size={14} />
              <input
                type="range"
                min={1}
                max={40}
                value={pen.strokeWidth}
                onChange={(e) => update({ pen: { ...pen, strokeWidth: +e.target.value } })}
                className="flex-1 accent-[#4262FF]"
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

        <IconButton title="Comment — C" active={tool === 'comment'} onClick={pick('comment')}>
          <MessageSquare size={20} strokeWidth={1.8} />
        </IconButton>
        <IconButton title="Frame — F" active={tool === 'frame'} onClick={pick('frame')}>
          <Frame size={20} strokeWidth={1.8} />
        </IconButton>
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

      <div className="mt-2 flex flex-col items-center gap-0.5 rounded-2xl border border-black/5 bg-white p-1.5 shadow-[0_4px_16px_rgba(9,9,20,0.12)]">
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
