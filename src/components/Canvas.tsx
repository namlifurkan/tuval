import { useEffect, useRef } from 'react'
import { fitRect, toBoard } from '../board/camera'
import { awareness, createItems, getIndex, getItems, undoManager } from '../board/doc'
import {
  contextMenuAt, deleteSelection, doubleClick, duplicateSelection, getPointer, groupSelection,
  nudge, pointerDown, pointerMove, pointerUp, quickCreateFromSelection, reorder, ungroupSelection,
  wheel,
} from '../board/interaction'
import { cloneItems, makeImage, makeSticky, makeText } from '../board/items'
import { me } from '../board/me'
import { boxOf, render } from '../board/render'
import { consumeDirty, requestRender, session, useBoardStore } from '../board/store'
import type { Tool } from '../board/store'
import { useItems } from '../board/useBoard'
import type { Item, Vec } from '../board/types'

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select', h: 'hand', n: 'sticky', t: 'text', s: 'shape',
  l: 'connector', p: 'pen', f: 'frame', c: 'comment',
}

let clipboard: Item[] = []

export function Canvas() {
  const ref = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const items = useItems()
  const itemsRef = useRef(items)
  itemsRef.current = items

  useEffect(() => { requestRender() }, [items])

  useEffect(() => {
    const canvas = ref.current!
    const wrap = wrapRef.current!
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let size = { w: 0, h: 0 }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1
      size = { w: wrap.clientWidth, h: wrap.clientHeight }
      canvas.width = Math.floor(size.w * dpr)
      canvas.height = Math.floor(size.h * dpr)
      canvas.style.width = `${size.w}px`
      canvas.style.height = `${size.h}px`
      requestRender()
    }
    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!consumeDirty()) return
      const s = useBoardStore.getState()
      render({
        ctx,
        dpr: window.devicePixelRatio || 1,
        cam: s.camera,
        width: size.w,
        height: size.h,
        items: itemsRef.current,
        selection: new Set(s.selection),
        hover: s.hover,
        editing: s.editing?.id ?? null,
        session,
        showGrid: s.showGrid,
        showAnchors: s.tool === 'select' || s.tool === 'connector',
      })
      canvas.style.cursor = session.cursor
    }
    raf = requestAnimationFrame(loop)

    const unsub = useBoardStore.subscribe(requestRender)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); unsub() }
  }, [])

  useEffect(() => {
    const canvas = ref.current!
    const rel = (e: { clientX: number; clientY: number }): Vec => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      canvas.setPointerCapture(e.pointerId)
      pointerDown(e, rel(e))
    }
    const move = (e: PointerEvent) => {
      const p = rel(e)
      pointerMove(e, p)
      const b = toBoard(useBoardStore.getState().camera, p.x, p.y)
      awareness.setLocalStateField('cursor', { x: b.x, y: b.y })
    }
    const up = (e: PointerEvent) => {
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      pointerUp(e, rel(e))
    }
    const dbl = (e: MouseEvent) => doubleClick(rel(e))
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheel(e, rel(e)) }
    const menu = (e: MouseEvent) => {
      e.preventDefault()
      const p = rel(e)
      contextMenuAt(p)
      useBoardStore.getState().update({ menu: { x: p.x, y: p.y } })
    }

    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('dblclick', dbl)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', menu)
    return () => {
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('dblclick', dbl)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', menu)
    }
  }, [])

  useEffect(() => {
    awareness.setLocalStateField('user', me)
    const onChange = () => {
      const states = [...awareness.getStates().entries()]
      session.remote = states
        .filter(([id]) => id !== awareness.clientID)
        .map(([id, s]) => {
          const st = s as { user?: { name: string; color: string }; cursor?: Vec; selection?: string[] }
          return {
            id,
            name: st.user?.name ?? 'Guest',
            color: st.user?.color ?? '#999',
            cursor: st.cursor ?? null,
            selection: st.selection ?? [],
          }
        })
      requestRender()
    }
    awareness.on('change', onChange)
    return () => awareness.off('change', onChange)
  }, [])

  useEffect(() => useBoardStore.subscribe((s) => awareness.setLocalStateField('selection', s.selection)), [])

  useEffect(() => {
    const isField = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)

    const keyDown = (e: KeyboardEvent) => {
      const s = useBoardStore.getState()
      if (isField(e.target)) return
      const mod = e.metaKey || e.ctrlKey

      if (e.code === 'Space' && !session.spaceDown) {
        session.spaceDown = true
        session.cursor = 'grab'
        requestRender()
        e.preventDefault()
        return
      }
      if (mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        e.shiftKey ? undoManager.redo() : undoManager.undo()
        return
      }
      if (mod && e.key.toLowerCase() === 'a') {
        e.preventDefault()
        s.setSelection(getItems().filter((i) => !i.locked).map((i) => i.id))
        return
      }
      if (mod && e.key.toLowerCase() === 'd') {
        e.preventDefault()
        duplicateSelection()
        return
      }
      if (mod && (e.key === 'c' || e.key === 'x')) {
        const index = getIndex()
        clipboard = s.selection.map((id) => index.get(id)).filter(Boolean) as Item[]
        if (e.key === 'x') deleteSelection()
        return
      }
      if (mod && e.key === 'v') {
        if (!clipboard.length) return
        const p = getPointer()
        const b = boxOf(clipboard)
        const copies = cloneItems(clipboard, p.x - b.x - b.w / 2, p.y - b.y - b.h / 2)
        createItems(copies)
        s.setSelection(copies.map((c) => c.id))
        return
      }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        e.shiftKey ? ungroupSelection() : groupSelection()
        return
      }
      if (mod && e.key === ']') { e.preventDefault(); reorder(e.shiftKey ? 'front' : 'forward'); return }
      if (mod && e.key === '[') { e.preventDefault(); reorder(e.shiftKey ? 'back' : 'backward'); return }

      if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); deleteSelection(); return }
      if (e.key === 'Escape') {
        if (s.openComment) { s.update({ openComment: null }); return }
        s.setSelection([]); s.setTool('select'); return
      }
      if (e.key === 'Tab') {
        e.preventDefault()
        quickCreateFromSelection(e.shiftKey ? 'left' : 'right')
        return
      }
      if (e.key === 'Enter' && s.selection.length === 1) {
        const item = getIndex().get(s.selection[0])
        if (item && 'text' in item) { e.preventDefault(); s.setEditing({ id: item.id, selectAll: true }) }
        return
      }
      if (e.key.startsWith('Arrow')) {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        nudge(
          e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0,
          e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0,
        )
        return
      }
      if (e.shiftKey && ['1', '2', '3'].includes(e.key)) {
        const el = ref.current!
        const all = getItems()
        if (e.key === '1' && all.length) s.setCamera(fitRect(boxOf(all), el.clientWidth, el.clientHeight))
        if (e.key === '2' && s.selection.length) {
          const index = getIndex()
          const sel = s.selection.map((id) => index.get(id)!).filter(Boolean)
          s.setCamera(fitRect(boxOf(sel), el.clientWidth, el.clientHeight))
        }
        if (e.key === '3') s.setCamera((c) => ({ ...c, z: 1 }))
        return
      }
      if (!mod && TOOL_KEYS[e.key.toLowerCase()]) s.setTool(TOOL_KEYS[e.key.toLowerCase()])
    }

    const keyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        session.spaceDown = false
        session.cursor = 'default'
        requestRender()
      }
    }

    const paste = (e: ClipboardEvent) => {
      if (isField(e.target)) return
      const s = useBoardStore.getState()
      const p = getPointer()
      const file = [...(e.clipboardData?.files ?? [])][0]
      if (file?.type.startsWith('image/')) {
        e.preventDefault()
        readImage(file, p)
        return
      }
      const text = e.clipboardData?.getData('text/plain')
      if (text && !clipboard.length) {
        e.preventDefault()
        const item = makeSticky(p.x - 114, p.y - 114, s.stickyFill, text)
        createItems([item])
        s.setSelection([item.id])
      }
    }

    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('paste', paste)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('paste', paste)
    }
  }, [])

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const r = ref.current!.getBoundingClientRect()
    const p = toBoard(useBoardStore.getState().camera, e.clientX - r.left, e.clientY - r.top)
    for (const file of e.dataTransfer.files) {
      if (file.type.startsWith('image/')) readImage(file, p)
      else if (file.type.startsWith('text/')) file.text().then((t) => {
        const item = makeText(p.x, p.y, 400, useBoardStore.getState().textStyle)
        item.text = t.slice(0, 2000)
        createItems([item])
      })
    }
  }

  return (
    <div
      ref={wrapRef}
      className="absolute inset-0"
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
    >
      <canvas ref={ref} className="block h-full w-full touch-none" />
    </div>
  )
}

function readImage(file: File, p: Vec) {
  const reader = new FileReader()
  reader.onload = () => {
    const src = reader.result as string
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, 600 / img.width)
      const w = img.width * scale, h = img.height * scale
      const item = makeImage(p.x - w / 2, p.y - h / 2, w, h, src)
      item.naturalW = img.width
      item.naturalH = img.height
      createItems([item])
      useBoardStore.getState().setSelection([item.id])
      requestRender()
    }
    img.src = src
  }
  reader.readAsDataURL(file)
}
