import { useEffect, useRef } from 'react'
import { surfaceColor } from '../board/brand'
import { makeThumb } from '../board/thumb'
import { refreshThumb } from '../board/sync'
import { readTexture } from '../board/paperPrefs'
import { touchBoard } from '../board/boards'
import { flushCamera, saveCamera } from '../board/viewport'
import { toBoard } from '../board/camera'
import { awareness, createItems, getIndex, getItems, getMeta, room, subscribeDoc, subscribeMeta, redo, undo } from '../board/doc'
import {
  cancelDrag, contextMenuAt, copyStyle, deleteSelection, doubleClick, duplicateSelection, getPointer,
  groupSelection, mindmapBranch, nudge, pasteStyle, pointerDown, pointerMove, pointerUp,
  quickCreateFromSelection, reorder, reparentToFrames, ungroupSelection, wheel,
} from '../board/interaction'
import { t } from '../i18n'
import { readClip, rehomePastedImages, writeClip } from '../board/clipboard'
import { addImage } from '../board/images'
import { addPdf, isPdf, MAX_PAGES } from '../board/pdf'
import { cloneItems, makeEmbed, makeSticky, makeText, withPreview } from '../board/items'
import { me, subscribeMe } from '../board/me'
import { boxOf, render } from '../board/render'
import { consumeDirty, flyToRect, requestRender, session, useBoardStore } from '../board/store'
import type { Tool } from '../board/store'
import { useItems } from '../board/useBoard'
import type { Item, Vec } from '../board/types'

const TOOL_KEYS: Record<string, Tool> = {
  v: 'select', h: 'hand', n: 'sticky', t: 'text', s: 'shape',
  l: 'connector', p: 'pen', f: 'frame', c: 'comment',
}


// `embedded` is the landing hero: the canvas shares the page with a scroll, so it must not
// swallow the wheel or the vertical touch gesture. Items still drag, draw and type.
export function Canvas({ embedded = false }: { embedded?: boolean } = {}) {
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
      const was = size
      const cam = useBoardStore.getState().camera
      // Hold the world point under the viewport centre, so a window resize never moves
      // the user's place. Refitting to content here would throw away their zoom.
      const centre = was.w && was.h
        ? { x: cam.x + was.w / 2 / cam.z, y: cam.y + was.h / 2 / cam.z }
        : null

      size = { w: wrap.clientWidth, h: wrap.clientHeight }
      // Writing canvas.width clears the bitmap even when the value is unchanged, and the next
      // paint is a frame away — that gap is the flash. Only touch it on a real size change.
      const bw = Math.floor(size.w * dpr)
      const bh = Math.floor(size.h * dpr)
      const resized = canvas.width !== bw || canvas.height !== bh
      if (resized) {
        canvas.width = bw
        canvas.height = bh
        canvas.style.width = `${size.w}px`
        canvas.style.height = `${size.h}px`
      }

      if (centre && (was.w !== size.w || was.h !== size.h)) {
        useBoardStore.getState().setCamera({
          ...cam,
          x: centre.x - size.w / 2 / cam.z,
          y: centre.y - size.h / 2 / cam.z,
        })
      }
      requestRender()
      if (resized) draw()
    }

    const draw = () => {
      const s = useBoardStore.getState()
      render({
        ctx,
        dpr: window.devicePixelRatio || 1,
        cam: s.camera,
        width: size.w,
        height: size.h,
        items: session.preview.size ? itemsRef.current.map(withPreview) : itemsRef.current,
        selection: new Set(s.selection),
        hover: s.hover,
        editing: s.editing?.id ?? null,
        editingCell: s.editing?.cell ?? null,
        session,
        surface: surfaceColor(getMeta().surface as string),
        texture: readTexture(),
        showAnchors: s.tool === 'select' || s.tool === 'connector',
      })
      canvas.style.cursor = session.cursor
    }

    const ro = new ResizeObserver(resize)
    ro.observe(wrap)
    resize()

    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!consumeDirty()) return
      draw()
    }
    raf = requestAnimationFrame(loop)

    let lastCam = useBoardStore.getState().camera
    const unsub = useBoardStore.subscribe(() => {
      const cam = useBoardStore.getState().camera
      if (cam !== lastCam) { lastCam = cam; saveCamera(room, cam) }
      requestRender()
    })
    const persist = () => flushCamera(room)
    window.addEventListener('pagehide', persist)
    const unsubMeta = subscribeMeta(requestRender)

    let drawnAt = -Infinity
    let pushedOnce = false
    const record = () => {
      const all = getItems()
      // The first time the document has content, ask the cloud save for a fresh picture even
      // if nothing was edited. Otherwise a board nobody touches stays blank in the list.
      if (!pushedOnce && all.length) { pushedOnce = true; refreshThumb() }
      // The thumbnail costs a canvas and an encode, so it is refreshed at most every 8s.
      const now = performance.now()
      const fresh = all.length && now - drawnAt > 8000
      if (fresh) drawnAt = now
      touchBoard(room, {
        name: (getMeta().name as string) ?? '',
        opened: Date.now(),
        items: all.filter((i) => i.type !== 'frame').length,
        frames: all.filter((i) => i.type === 'frame').length,
        ...(fresh ? { thumb: makeThumb(all) } : {}),
      })
    }
    record()
    const unsubRecord = subscribeDoc(record)
    const unsubRecordMeta = subscribeMeta(record)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      unsub()
      unsubMeta()
      unsubRecord()
      unsubRecordMeta()
      window.removeEventListener('pagehide', persist)
      flushCamera(room)
    }
  }, [])

  useEffect(() => {
    const canvas = ref.current!
    const rel = (e: { clientX: number; clientY: number }): Vec => {
      const r = canvas.getBoundingClientRect()
      return { x: e.clientX - r.left, y: e.clientY - r.top }
    }
    const down = (e: PointerEvent) => {
      pointerDown(e, rel(e))
      try { canvas.setPointerCapture(e.pointerId) } catch { /* synthetic or stale pointer */ }
    }
    const move = (e: PointerEvent) => {
      const p = rel(e)
      pointerMove(e, p)
      const b = toBoard(useBoardStore.getState().camera, p.x, p.y)
      awareness.setLocalStateField('cursor', { x: b.x, y: b.y })
    }
    const up = (e: PointerEvent) => {
      pointerUp(e, rel(e))
      try {
        if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
      } catch { /* ignore */ }
    }
    const dbl = (e: MouseEvent) => doubleClick(rel(e))
    const onWheel = (e: WheelEvent) => { e.preventDefault(); wheel(e, rel(e)) }
    const menu = (e: MouseEvent) => {
      e.preventDefault()
      const p = rel(e)
      contextMenuAt(p)
      useBoardStore.getState().update({ menu: { x: p.x, y: p.y } })
    }

    const abandon = () => cancelDrag()
    window.addEventListener('blur', abandon)
    canvas.addEventListener('lostpointercapture', abandon)
    canvas.addEventListener('pointerdown', down)
    canvas.addEventListener('pointermove', move)
    canvas.addEventListener('pointerup', up)
    canvas.addEventListener('pointercancel', up)
    canvas.addEventListener('pointerleave', (e) => { if (e.buttons === 0) up(e) })
    canvas.addEventListener('dblclick', dbl)
    if (!embedded) canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('contextmenu', menu)
    return () => {
      window.removeEventListener('blur', abandon)
      canvas.removeEventListener('lostpointercapture', abandon)
      canvas.removeEventListener('pointerdown', down)
      canvas.removeEventListener('pointermove', move)
      canvas.removeEventListener('pointerup', up)
      canvas.removeEventListener('pointercancel', up)
      canvas.removeEventListener('dblclick', dbl)
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('contextmenu', menu)
    }
  }, [embedded])

  useEffect(() => {
    const publish = () => awareness.setLocalStateField('user', { ...me })
    publish()
    return subscribeMe(publish)
  }, [])

  useEffect(() => {
    const onChange = () => {
      const states = [...awareness.getStates().entries()]
      session.remote = states
        .filter(([id]) => id !== awareness.clientID)
        .map(([id, s]) => {
          const st = s as {
            user?: { name: string; color: string }
            cursor?: Vec
            selection?: string[]
            chat?: { text: string; at: number }
          }
          return {
            id,
            name: st.user?.name ?? 'Guest',
            color: st.user?.color ?? '#69665E',
            cursor: st.cursor ?? null,
            selection: st.selection ?? [],
            chat: st.chat ?? null,
          }
        })
      requestRender()
    }
    awareness.on('change', onChange)
    return () => awareness.off('change', onChange)
  }, [])

  useEffect(() => useBoardStore.subscribe((s) => awareness.setLocalStateField('selection', s.selection)), [])

  useEffect(() => {
    let last = 0
    return useBoardStore.subscribe((s) => {
      const now = performance.now()
      if (now - last < 100) return
      last = now
      awareness.setLocalStateField('camera', s.camera)
    })
  }, [])

  useEffect(() => {
    const apply = () => {
      const { following, setCamera } = useBoardStore.getState()
      if (following === null) return
      const state = awareness.getStates().get(following) as { camera?: { x: number; y: number; z: number } } | undefined
      if (!state?.camera) return
      setCamera(state.camera)
      requestRender()
    }
    awareness.on('change', apply)
    return () => awareness.off('change', apply)
  }, [])

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
        e.shiftKey ? redo() : undo()
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
      if (mod && e.altKey && e.code === 'KeyC') { e.preventDefault(); copyStyle(); return }
      if (mod && e.altKey && e.code === 'KeyV') { e.preventDefault(); pasteStyle(); return }
      if (mod && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        s.update({ searchOpen: !s.searchOpen })
        return
      }
      if (mod && (e.key === 'c' || e.key === 'x')) {
        const index = getIndex()
        writeClip(s.selection.map((id) => index.get(id)).filter(Boolean) as Item[])
        if (e.key === 'x') deleteSelection()
        return
      }
      if (mod && e.key === 'v') {
        const clip = readClip()
        if (!clip) return
        const p = getPointer()
        const b = boxOf(clip.items)
        void rehomePastedImages(clip.items, clip.room).then((items) => {
          const copies = cloneItems(items, p.x - b.x - b.w / 2, p.y - b.y - b.h / 2)
          createItems(copies)
          reparentToFrames(copies.map((c) => c.id))
          s.setSelection(copies.map((c) => c.id))
          requestRender()
        })
        return
      }
      if (mod && e.key.toLowerCase() === 'g') {
        e.preventDefault()
        e.shiftKey ? ungroupSelection() : groupSelection()
        return
      }
      if (mod && e.code === 'BracketRight') { e.preventDefault(); reorder(e.shiftKey ? 'front' : 'forward'); return }
      if (mod && e.code === 'BracketLeft') { e.preventDefault(); reorder(e.shiftKey ? 'back' : 'backward'); return }

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
      if (e.key === 'Enter' && !e.shiftKey && mindmapBranch(true)) { e.preventDefault(); return }
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
      if (e.shiftKey && !mod && ['Digit1', 'Digit2', 'Digit3'].includes(e.code)) {
        const all = getItems()
        if (e.code === 'Digit1' && all.length) flyToRect(boxOf(all))
        if (e.code === 'Digit2' && s.selection.length) {
          const index = getIndex()
          const sel = s.selection.map((id) => index.get(id)!).filter(Boolean)
          flyToRect(boxOf(sel))
        }
        if (e.code === 'Digit3') s.setCamera((c) => ({ ...c, z: 1 }))
        return
      }
      if (!mod && e.key === '/') {
        e.preventDefault()
        s.update({ chatOpen: true })
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
      const text = e.clipboardData?.getData('text/plain')?.trim()
      if (text && !readClip()) {
        e.preventDefault()
        const looksLikeUrl = /^(https?:\/\/|www\.)\S+$/i.test(text)
        const item = looksLikeUrl ? makeEmbed(p.x, p.y, text) : makeSticky(p.x - 114, p.y - 114, s.stickyFill, text)
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
      if (isPdf(file)) void addPdf(file, p).then(({ skipped }) => {
        if (skipped) alert(t('Only the first {n} pages were placed; {skipped} more are in the file.', { n: MAX_PAGES, skipped }))
      })
      else if (file.type.startsWith('image/')) readImage(file, p)
      // A Miro export and a written brief are both whole boards rather than something to put at
      // a point. Dropping one used to do nothing at all, or leave two thousand characters of
      // JSON in a text box; it opens the import panel now, which counts what is in there first.
      else if (/\.(json|md|markdown)$/i.test(file.name)) void file.text().then((seed) =>
        useBoardStore.getState().update({ briefOpen: true, briefSeed: seed }))
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
      <canvas ref={ref} className={`block h-full w-full ${embedded ? 'touch-pan-y' : 'touch-none'}`} />
    </div>
  )
}

const readImage = (file: File, p: Vec) => { void addImage(file, p) }
