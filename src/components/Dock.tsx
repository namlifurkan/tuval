import { Minus, Plus, Redo2, RotateCcw, Settings2, Undo2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import type { ReactNode } from 'react'
import { readOnly, subscribeAccess } from '../board/access'
import { clampZoom, skipsMotion, zoomAt } from '../board/camera'
import { getItems, redo, undo } from '../board/doc'
import {
  DEFAULT_ORDER, DOCK_LABELS, DOCK_SIDES, getDockPrefs, moveDockItem, resetDock, setDockSide,
  setDockSize, setMagnify, SIZE_PX, subscribeDock, toggleDockItem, visibleDockItems,
} from '../board/dockPrefs'
import type { DockItemId, DockSize } from '../board/dockPrefs'
import { addImage } from '../board/images'
import { addPdf, isPdf } from '../board/pdf'
import { makeEmbed, makeFrame, makeText, RECORD_H, RECORD_W } from '../board/items'
import { recordItemsFor } from '../board/promote'
import { insertItems } from '../board/interaction'
import { boxOf } from '../board/render'
import { SHAPE_GROUPS } from '../board/shapes'
import { TEMPLATES } from '../board/templates'
import { flyToRect, requestRender, useBoardStore } from '../board/store'
import type { Tool } from '../board/store'
import { t } from '../i18n'
import { LINE_COLORS, STICKY_COLORS, type Item } from '../board/types'
import {
  CodeTool, Comment, Connector, EraserTool, Fit, FrameTool, Highlight, ImageTool, Minimap, Mindmap, More,
  Nib, RecordTool, Select, ShapeGlyph, Sticky, TableTool, Templates, TextTool,
} from './icons'
import { RecordPicker } from './RecordPicker'
import { ColorGrid, IconButton, Popover, usePopover } from './ui'

const EMOJI = [
  '👍', '👎', '❤️', '🔥', '✅', '❌', '⭐', '🎯',
  '💡', '⚠️', '❓', '🚀', '🐛', '📌', '⏳', '🎉',
]

const VIEW_SAFE = new Set<DockItemId>(['select', 'minimap', 'fit', 'zoom'])

const MAGNIFY_AMPLITUDE = 0.5
const MAGNIFY_SPREAD = 66

export function Dock() {
  const prefs = useSyncExternalStore(subscribeDock, getDockPrefs, getDockPrefs)
  const items = useSyncExternalStore(subscribeDock, visibleDockItems, visibleDockItems)
  const ro = useSyncExternalStore(subscribeAccess, readOnly, readOnly)

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
  const recordPop = usePopover()
  const morePop = usePopover()
  const zoomPop = usePopover()
  const settingsPop = usePopover()

  const fileRef = useRef<HTMLInputElement>(null)
  const barRef = useRef<HTMLDivElement>(null)
  const [dragId, setDragId] = useState<DockItemId | null>(null)

  const magnify = prefs.magnify && !skipsMotion()
  const side = prefs.side
  const vertical = side === 'left' || side === 'right'
  const originClass = { bottom: 'origin-bottom', top: 'origin-top', left: 'origin-left', right: 'origin-right' }[side]
  const popSide = { bottom: 'top', top: 'bottom', left: 'right', right: 'left' }[side] as 'top' | 'bottom' | 'right' | 'left'
  const unit = SIZE_PX[prefs.size]
  const glyph = Math.round(unit * 0.52)

  const resetScale = useCallback(() => {
    barRef.current?.querySelectorAll<HTMLElement>('[data-slot]').forEach((el) => {
      el.style.transform = ''
    })
  }, [])

  useEffect(() => { if (!magnify) resetScale() }, [magnify, resetScale])

  // A popover covers the bar, so no pointermove/leave reaches it and the last
  // magnification transform would stick after the popover closes.
  const popoverOpen = stickyPop.open || shapePop.open || penPop.open || templatePop.open
    || framePop.open || recordPop.open || morePop.open || zoomPop.open || settingsPop.open
  useEffect(() => { if (popoverOpen) resetScale() }, [popoverOpen, resetScale])

  const onMove = (e: React.PointerEvent) => {
    if (!magnify || dragId || popoverOpen) return
    const bar = barRef.current
    if (!bar) return
    const slots = [...bar.querySelectorAll<HTMLElement>('[data-slot]')]
    if (!slots.length) return

    const box = bar.getBoundingClientRect()
    const pointer = vertical
      ? e.clientY - box.top + bar.scrollTop
      : e.clientX - box.left + bar.scrollLeft
    const centers = slots.map((el) => (vertical
      ? el.offsetTop + el.offsetHeight / 2
      : el.offsetLeft + el.offsetWidth / 2))
    const scales = slots.map((el, i) => (el.dataset.noMagnify !== undefined
      ? 1
      : 1 + MAGNIFY_AMPLITUDE * Math.exp(-(((centers[i] - pointer) / MAGNIFY_SPREAD) ** 2))))
    const extras = slots.map((el, i) => (vertical ? el.offsetHeight : el.offsetWidth) * (scales[i] - 1))

    const before: number[] = []
    let running = 0
    for (const extra of extras) {
      before.push(running)
      running += extra
    }

    // Continuous anchor: how much of each icon's growth sits left of the pointer.
    // An index-based anchor jumps as the pointer crosses a midpoint, which shows up as a flicker.
    let anchor = 0
    slots.forEach((el, i) => {
      const start = vertical ? el.offsetTop : el.offsetLeft
      const span = vertical ? el.offsetHeight : el.offsetWidth
      const portion = Math.min(1, Math.max(0, (pointer - start) / span))
      anchor += extras[i] * portion
    })

    slots.forEach((el, i) => {
      const shift = before[i] + extras[i] / 2 - anchor
      const push = (scales[i] - 1) * unit * 0.55 * (side === 'right' || side === 'bottom' ? -1 : 1)
      el.style.transform = vertical
        ? `translate(${push}px, ${shift}px) scale(${scales[i]})`
        : `translate(${shift}px, ${push}px) scale(${scales[i]})`
    })
  }

  const pick = (t: Tool) => () => { setTool(t); requestRender() }
  const canvasEl = () => document.querySelector('canvas')

  const viewportCenter = () => {
    const el = canvasEl()!
    return { x: camera.x + el.clientWidth / 2 / camera.z, y: camera.y + el.clientHeight / 2 / camera.z }
  }

  const insert = (list: Item[], fit = false) => insertItems(list, fit, canvasEl())

  const step = (factor: number) => {
    const el = canvasEl()!
    setCamera(zoomAt(camera, el.clientWidth / 2, el.clientHeight / 2, clampZoom(camera.z * factor)))
    requestRender()
  }

  const fitAll = () => {
    const all = getItems()
    if (!all.length) { setCamera({ ...camera, z: 1 }); requestRender(); return }
    flyToRect(boxOf(all))
  }

  const button = (title: string, active: boolean, onClick: () => void, icon: ReactNode) => (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={() => { resetScale(); onClick() }}
      style={{ width: unit, height: unit }}
      className={`tap-target grid place-items-center rounded-xl transition-[background-color,box-shadow] duration-150
        ${active
          ? 'bg-pigment-wash text-pigment shadow-[1px_1px_0_rgba(20,19,16,0.10)] ring-1 ring-pigment/25'
          : 'text-ink hover:bg-shade hover:shadow-[1px_1px_0_rgba(20,19,16,0.10)] hover:ring-1 hover:ring-black/[0.07]'}`}
    >
      {icon}
    </button>
  )

  const renderItem = (id: DockItemId): ReactNode => {
    switch (id) {
      case 'undo': return button(`${t('Undo')} — ⌘Z`, false, () => undo(), <Undo2 size={glyph} strokeWidth={1.8} />)
      case 'redo': return button(`${t('Redo')} — ⌘⇧Z`, false, () => redo(), <Redo2 size={glyph} strokeWidth={1.8} />)
      case 'select': return button(`${t('Select')} — V`, tool === 'select', pick('select'), <Select size={glyph} />)
      case 'text': return button(`${t('Text')} — T`, tool === 'text', pick('text'), <TextTool size={glyph} />)
      case 'connector': return button(`${t('Connector')} — L`, tool === 'connector', pick('connector'), <Connector size={glyph} />)
      case 'table': return button(t('Table'), tool === 'table', pick('table'), <TableTool size={glyph} />)
      case 'mindmap': return button(t('Mind map'), tool === 'mindmap', pick('mindmap'), <Mindmap size={glyph} />)
      case 'image': return button(t('Upload image'), false, () => fileRef.current?.click(), <ImageTool size={glyph} />)
      case 'minimap': return button(t('Minimap'), showMinimap, () => update({ showMinimap: !showMinimap }), <Minimap size={glyph} />)
      case 'fit': return button(`${t('Fit to content')} — ⇧1`, false, fitAll, <Fit size={glyph - 1} />)
      case 'comment':
        return button('Yorum — C', tool === 'comment', () => {
          if (tool === 'comment') update({ commentsPanel: !useBoardStore.getState().commentsPanel })
          else setTool('comment')
          requestRender()
        }, <Comment size={glyph} />)

      case 'sticky':
        return (
          <div className="relative">
            {button('Sticky — N', tool === 'sticky', () => (tool === 'sticky' ? stickyPop.toggle() : setTool('sticky')),
              <span className="relative grid place-items-center">
                <Sticky size={glyph} />
                <span className="absolute -bottom-1.5 -right-1.5 h-2 w-2 rounded-[2px] border border-black/10" style={{ background: stickyFill }} />
              </span>)}
            <Popover open={stickyPop.open} onClose={stickyPop.close} anchor={popSide} className="w-[228px]">
              <div className="px-1 pb-2 pt-1 text-xs font-semibold text-ink">{t('Sticky colour')}</div>
              <ColorGrid colors={STICKY_COLORS} value={stickyFill} onPick={(c) => { update({ stickyFill: c }); stickyPop.close() }} />
            </Popover>
          </div>
        )

      case 'shape':
        return (
          <div className="relative">
            {button(`${t('Shape')} — S`, tool === 'shape', () => (tool === 'shape' ? shapePop.toggle() : setTool('shape')), <ShapeGlyph kind={shape.kind} size={glyph} />)}
            <Popover open={shapePop.open} onClose={shapePop.close} anchor={popSide} className="w-[268px]">
              {SHAPE_GROUPS.map((group) => (
                <div key={group.name} className="mb-2 last:mb-0">
                  <div className="px-1 pb-1.5 pt-1 text-xs font-semibold text-ink">{group.name}</div>
                  <div className="grid grid-cols-6 gap-1">
                    {group.kinds.map((k) => (
                      <button
                        key={`${group.name}-${k}`}
                        type="button"
                        title={k}
                        onClick={() => { update({ shape: { ...shape, kind: k } }); setTool('shape'); shapePop.close() }}
                        className={`grid h-9 w-9 place-items-center rounded-lg hover:bg-tint
                          ${shape.kind === k ? 'bg-pigment-wash text-pigment' : 'text-ink'}`}
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
            {button(`${t('Pen')} — P`, tool === 'pen', () => (tool === 'pen' ? penPop.toggle() : setTool('pen')),
              pen.eraser ? <EraserTool size={glyph} />
                : pen.highlighter ? <Highlight size={glyph} />
                : <Nib size={glyph} />)}
            <Popover open={penPop.open} onClose={penPop.close} anchor={popSide} className="w-[248px]">
              <div className="mb-2 flex gap-1">
                <button
                  type="button"
                  onClick={() => update({ pen: { ...pen, highlighter: false, eraser: false } })}
                  className={`min-w-0 flex-1 truncate rounded-lg px-1.5 py-1.5 text-xs font-semibold ${!pen.highlighter && !pen.eraser ? 'bg-pigment-wash text-pigment' : 'hover:bg-tint'}`}
                >{t('Pen')}</button>
                <button
                  type="button"
                  onClick={() => update({ pen: { ...pen, highlighter: true, eraser: false, strokeWidth: Math.max(pen.strokeWidth, 16) } })}
                  className={`min-w-0 flex-1 truncate rounded-lg px-1.5 py-1.5 text-xs font-semibold ${pen.highlighter && !pen.eraser ? 'bg-pigment-wash text-pigment' : 'hover:bg-tint'}`}
                >{t('Highlighter')}</button>
                <button
                  type="button"
                  onClick={() => update({ pen: { ...pen, eraser: true } })}
                  className={`min-w-0 flex-1 truncate rounded-lg px-1.5 py-1.5 text-xs font-semibold ${pen.eraser ? 'bg-pigment-wash text-pigment' : 'hover:bg-tint'}`}
                >{t('Eraser')}</button>
              </div>
              <div className="mb-2 flex items-center gap-2 px-1">
                <Minus size={14} />
                <input
                  type="range" min={1} max={40} value={pen.strokeWidth}
                  onChange={(e) => update({ pen: { ...pen, strokeWidth: +e.target.value } })}
                  className="flex-1 accent-pigment"
                />
                <span className="w-6 text-right text-xs tabular-nums text-ink-soft">{pen.strokeWidth}</span>
              </div>
              <ColorGrid colors={LINE_COLORS} value={pen.stroke} onPick={(c) => update({ pen: { ...pen, stroke: c } })} columns={6} />
            </Popover>
          </div>
        )

      case 'frame':
        return (
          <div className="relative">
            {button(`${t('Frame')} — F`, tool === 'frame', () => (tool === 'frame' ? framePop.toggle() : setTool('frame')), <FrameTool size={glyph} />)}
            <Popover open={framePop.open} onClose={framePop.close} anchor={popSide} className="w-[212px]">
              <button
                type="button"
                onClick={() => { update({ framesPanel: true }); framePop.close() }}
                className="mb-1 w-full rounded-lg px-2.5 py-1.5 text-left text-sm font-semibold text-pigment hover:bg-tint"
              >{t('Open frame panel')}</button>
              <div className="px-1 pb-2 pt-1 text-xs font-semibold text-ink">{t('Frame size')}</div>
              {([
                ['16:9', 1920, 1080],
                ['4:3', 1600, 1200],
                [t('A4 portrait'), 1240, 1754],
                [t('Phone'), 750, 1334],
                [t('Post'), 1080, 1080],
                [t('Post, tall'), 1080, 1350],
                [t('Story'), 1080, 1920],
                [t('Link card'), 1200, 630],
              ] as [string, number, number][]).map(([label, w, h]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => {
                    const c = viewportCenter()
                    const n = getItems().filter((i) => i.type === 'frame').length + 1
                    insert([makeFrame(c.x - w / 2, c.y - h / 2, w, h, `Frame ${n}`)], true)
                    framePop.close()
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-tint"
                >
                  <span className="font-medium text-ink">{label}</span>
                  <span className="text-xs text-muted">{w}×{h}</span>
                </button>
              ))}
            </Popover>
          </div>
        )

      case 'code': return button(t('Code block'), tool === 'code', pick('code'), <CodeTool size={glyph} />)
      case 'templates':
        return (
          <div className="relative">
            {button(t('Templates'), templatePop.open, templatePop.toggle, <Templates size={glyph} />)}
            <Popover open={templatePop.open} onClose={templatePop.close} anchor={popSide} className="w-[268px]">
              <div className="px-1 pb-2 pt-1 text-xs font-semibold text-ink">{t('Templates')}</div>
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { insert(t.build(viewportCenter()), true); templatePop.close() }}
                  className="w-full rounded-lg px-2.5 py-2 text-left hover:bg-tint"
                >
                  <div className="text-sm font-semibold text-ink">{t.name}</div>
                  <div className="text-xs text-muted">{t.description}</div>
                </button>
              ))}
            </Popover>
          </div>
        )

      case 'record':
        return (
          <div className="relative">
            {button(t('Existing work'), recordPop.open, recordPop.toggle, <RecordTool size={glyph} />)}
            <Popover open={recordPop.open} onClose={recordPop.close} anchor={popSide} className="w-[300px]">
              <RecordPicker
                onPick={(rows) => {
                  const c = viewportCenter()
                  insert(recordItemsFor(rows, c.x - RECORD_W / 2, c.y - RECORD_H / 2))
                  recordPop.close()
                }}
              />
            </Popover>
          </div>
        )

      case 'more':
        return (
          <div className="relative">
            {button(t('More'), morePop.open, morePop.toggle, <More size={glyph} />)}
            <Popover open={morePop.open} onClose={morePop.close} anchor={popSide} className="w-[268px]">
              <button
                type="button"
                onClick={() => {
                  const url = prompt(t('Link to embed (YouTube, Vimeo, Loom, Figma or any site)'))
                  if (url?.trim()) { const c = viewportCenter(); insert([makeEmbed(c.x, c.y, url.trim())]) }
                  morePop.close()
                }}
                className="mb-2 w-full rounded-lg px-2.5 py-2 text-left text-sm font-semibold text-pigment hover:bg-tint"
              >{t('Embed a link')}</button>
              <div className="px-1 pb-1.5 text-xs font-semibold text-ink">{t('Emoji')}</div>
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
                    className="grid h-8 w-8 place-items-center rounded-lg text-xl hover:bg-tint"
                  >{g}</button>
                ))}
              </div>
            </Popover>
          </div>
        )

      case 'zoom':
        return (
          <div className={`relative flex items-center gap-0.5 ${vertical ? 'flex-col' : ''}`}>
            {button(t('Zoom out'), false, () => step(1 / 1.2), <Minus size={glyph - 2} strokeWidth={2} />)}
            <button
              type="button"
              onClick={zoomPop.toggle}
              style={vertical ? { width: unit } : { height: unit }}
              className={`rounded-lg px-1 font-semibold tabular-nums text-ink transition-[background-color,box-shadow] duration-150 hover:bg-shade hover:shadow-[1px_1px_0_rgba(20,19,16,0.10)] hover:ring-1 hover:ring-black/[0.07] ${vertical ? 'py-1 text-[11px]' : 'min-w-[50px] text-sm'}`}
            >
              {Math.round(camera.z * 100)}%
            </button>
            {button(t('Zoom in'), false, () => step(1.2), <Plus size={glyph - 2} strokeWidth={2} />)}
            <Popover open={zoomPop.open} onClose={zoomPop.close} anchor={popSide} className="w-[200px]">
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
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-tint"
                >
                  <span>{z * 100}%</span>
                  {z === 1 && <span className="text-xs text-muted">⇧3</span>}
                </button>
              ))}
            </Popover>
          </div>
        )
    }
  }

  const lift = Math.ceil(unit * MAGNIFY_AMPLITUDE) + 12

  const anchorClass = {
    bottom: 'bottom-5 left-1/2 -translate-x-1/2',
    top: 'top-24 left-1/2 -translate-x-1/2',
    left: 'left-5 top-1/2 -translate-y-1/2',
    right: 'right-5 top-1/2 -translate-y-1/2',
  }[side]

  const plateClass = {
    bottom: 'absolute inset-x-0 bottom-0',
    top: 'absolute inset-x-0 top-0',
    left: 'absolute inset-y-0 left-0',
    right: 'absolute inset-y-0 right-0',
  }[side]

  const plateSize = vertical ? { width: unit + 12 } : { height: unit + 12 }
  const pad = magnify ? lift : 6
  const barPad = {
    bottom: { paddingTop: pad }, top: { paddingBottom: pad },
    left: { paddingRight: pad }, right: { paddingLeft: pad },
  }[side]

  const barClass = vertical
    ? `relative flex max-h-[calc(100vh-10rem)] flex-col gap-0.5 overflow-y-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${side === 'left' ? 'items-start pl-1.5' : 'items-end pr-1.5'}`
    : `relative flex max-w-[calc(100vw-1.5rem)] gap-0.5 overflow-x-auto px-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${side === 'bottom' ? 'items-end pb-1.5' : 'items-start pt-1.5'}`


  return (
    <div className={`pointer-events-auto absolute z-40 ${anchorClass}`}>
      <div
        aria-hidden
        style={plateSize}
        className={`${plateClass} rounded-2xl border border-black/5 bg-surface shadow-[3px_3px_0_rgba(20,19,16,0.09)]`}
      />
      <div
        ref={barRef}
        onPointerMove={onMove}
        onPointerLeave={resetScale}
        onContextMenu={(e) => { e.preventDefault(); settingsPop.setOpen(true) }}
        style={barPad}
        className={barClass}
      >
        {items.map((id) => (
          <div
            key={id}
            data-slot
            data-ada={id}
            {...(id === 'zoom' ? { 'data-no-magnify': '' } : {})}
            draggable
            onDragStart={() => setDragId(id)}
            onDragEnd={() => setDragId(null)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragId && dragId !== id) moveDockItem(dragId, id); setDragId(null) }}
            style={{ transition: 'transform 130ms var(--ease)' }}
            className={`shrink-0 ${originClass} ${dragId === id ? 'opacity-40' : ''}
              ${ro && !VIEW_SAFE.has(id) ? 'pointer-events-none opacity-30' : ''}`}
          >
            {renderItem(id)}
          </div>
        ))}

        <div
          className={vertical
            ? 'mt-0.5 flex shrink-0 justify-center self-stretch border-t border-hairline pt-1'
            : 'ml-0.5 flex shrink-0 items-center self-stretch border-l border-hairline pl-1'}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragId) moveDockItem(dragId, null); setDragId(null) }}
        >
          <div className="relative">
            <IconButton title={t('Dock settings (right click)')} active={settingsPop.open} onClick={settingsPop.toggle}>
              <Settings2 size={17} strokeWidth={1.8} />
            </IconButton>
            <Popover open={settingsPop.open} onClose={settingsPop.close} anchor={popSide} className="w-[248px]">
              <div className="mb-1 px-1 text-xs font-semibold text-ink">{t('Position')}</div>
              <div className="mb-2 grid grid-cols-4 gap-1">
                {DOCK_SIDES.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => setDockSide(o.id)}
                    className={`rounded-lg px-1 py-1.5 text-xs font-semibold
                      ${side === o.id ? 'bg-pigment-wash text-pigment' : 'hover:bg-tint'}`}
                  >{t(o.name)}</button>
                ))}
              </div>
              <div className="mb-1 px-1 text-xs font-semibold text-ink">{t('Size')}</div>
              <div className="mb-2 flex gap-1">
                {(['sm', 'md', 'lg'] as DockSize[]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setDockSize(s)}
                    className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold uppercase
                      ${prefs.size === s ? 'bg-pigment-wash text-pigment' : 'hover:bg-tint'}`}
                  >{s}</button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setMagnify(!prefs.magnify)}
                className="mb-2 flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-sm hover:bg-tint"
              >
                <span>{t('Magnifier')}</span>
                <span className="text-xs text-muted">{t(prefs.magnify ? 'On' : 'Off')}</span>
              </button>

              <div className="mb-1 border-t border-shade px-1 pt-2 text-xs font-semibold text-ink">
                {t('Visible tools')}
              </div>
              <div className="max-h-[220px] overflow-y-auto">
                {DEFAULT_ORDER.map((id) => (
                  <label key={id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 text-sm hover:bg-tint">
                    <input
                      type="checkbox"
                      checked={!prefs.hidden.includes(id)}
                      onChange={() => toggleDockItem(id)}
                      className="accent-pigment"
                    />
                    {t(DOCK_LABELS[id])}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={() => resetDock()}
                className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline px-2 py-1.5 text-xs font-semibold hover:bg-tint"
              >
                <RotateCcw size={12} /> {t('Reset to default')}
              </button>
              <p className="mt-2 px-1 text-[11px] leading-snug text-muted">
                {t('Drag tools to reorder them.')}
              </p>
            </Popover>
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          multiple
          hidden
          onChange={(e) => {
            const center = viewportCenter()
            for (const file of e.target.files ?? []) {
              if (isPdf(file)) void addPdf(file, center)
              else void addImage(file, center)
            }
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
