import { useEffect, useLayoutEffect, useRef } from 'react'
import { toScreen } from '../board/camera'
import { patchItem, removeItems } from '../board/doc'
import { connectorGeometry } from '../board/render'
import { textInsetFor } from '../board/shapes'
import { requestRender, useBoardStore } from '../board/store'
import { fontString, layoutText, LINE_HEIGHT, wrapText } from '../board/text'
import { useItemIndex } from '../board/useBoard'
import type { Item, TextStyle } from '../board/types'

function textBox(item: Item) {
  if (item.type === 'connector') {
    const { a, b } = connectorGeometry(item)
    const w = 240
    return { x: (a.x + b.x) / 2 - w / 2, y: (a.y + b.y) / 2 - item.fontSize, w, h: item.fontSize * 2 }
  }
  if (item.type === 'sticky') {
    const inset = Math.min(item.w, item.h) * 0.1
    return { x: item.x + inset, y: item.y + inset, w: item.w - inset * 2, h: item.h - inset * 2 }
  }
  if (item.type === 'shape') {
    const b = textInsetFor(item.kind, item.w, item.h)
    return { x: item.x + b.x, y: item.y + b.y, w: b.w, h: b.h }
  }
  return { x: item.x, y: item.y, w: item.w, h: item.h }
}

export function TextEditor() {
  const editing = useBoardStore((s) => s.editing)
  const camera = useBoardStore((s) => s.camera)
  const setEditing = useBoardStore((s) => s.setEditing)
  const index = useItemIndex()
  const ref = useRef<HTMLTextAreaElement>(null)
  const item = editing ? index.get(editing.id) : undefined

  useLayoutEffect(() => {
    const el = ref.current
    if (!el || !editing) return
    el.focus({ preventScroll: true })
    if (editing.selectAll) el.select()
    else el.setSelectionRange(el.value.length, el.value.length)
  }, [editing?.id, editing?.selectAll, editing])

  useEffect(() => {
    if (!editing) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setEditing(null)
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [editing, setEditing])

  if (!editing || !item || !('text' in item)) return null

  const style = item as unknown as TextStyle
  const box = textBox(item)
  const p = toScreen(camera, box.x, box.y)
  const layout = layoutText(item.text || ' ', box.w, box.h, style)
  const fontSize = (style.autoFit ? layout.fontSize : style.fontSize) * camera.z
  const contentH = item.type === 'text' ? box.h * camera.z : layout.lines.length * layout.lineHeight * camera.z

  const MIN_AUTOFIT = 8

  const commit = (value: string) => {
    patchItem(item.id, { text: value })
    if (item.type === 'sticky' || item.type === 'shape') {
      const fitted = layoutText(value || ' ', box.w, box.h, style)
      if (fitted.fontSize <= MIN_AUTOFIT) {
        const lines = wrapText(value || ' ', box.w, fontString(style, fitted.fontSize))
        const needed = lines.length * fitted.fontSize * LINE_HEIGHT
        if (needed > box.h + 1) patchItem(item.id, { h: Math.ceil(needed * (item.h / box.h)) })
      }
    }
    if (item.type === 'text') {
      const h = Math.max(
        style.fontSize * LINE_HEIGHT,
        layoutText(value || ' ', box.w, 1e6, { ...style, autoFit: false }).lines.length * style.fontSize * LINE_HEIGHT,
      )
      patchItem(item.id, { h })
    }
    requestRender()
  }

  const finish = () => {
    if (item.type === 'text' && !item.text.trim()) removeItems([item.id])
    setEditing(null)
    requestRender()
  }

  return (
    <div
      className="absolute z-30"
      style={{
        left: p.x,
        top: p.y,
        width: box.w * camera.z,
        height: box.h * camera.z,
        transform: `rotate(${item.rotation}rad)`,
        transformOrigin: `${(item.x + item.w / 2 - box.x) * camera.z}px ${(item.y + item.h / 2 - box.y) * camera.z}px`,
        display: 'flex',
        alignItems: style.valign === 'top' ? 'flex-start' : style.valign === 'bottom' ? 'flex-end' : 'center',
      }}
    >
      <textarea
        ref={ref}
        value={item.text}
        spellCheck={false}
        onChange={(e) => commit(e.target.value)}
        onBlur={finish}
        onPointerDown={(e) => e.stopPropagation()}
        onWheel={(e) => e.stopPropagation()}
        className="w-full resize-none border-0 bg-transparent p-0 outline-none"
        style={{
          height: Math.min(box.h * camera.z, Math.max(contentH, fontSize * LINE_HEIGHT)),
          font: fontString(style, fontSize),
          lineHeight: `${fontSize * LINE_HEIGHT}px`,
          color: style.textColor,
          textAlign: style.align,
          textDecoration: [style.underline && 'underline', style.strike && 'line-through']
            .filter(Boolean).join(' ') || 'none',
          overflow: 'hidden',
          caretColor: style.textColor,
        }}
      />
    </div>
  )
}
