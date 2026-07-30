import { toBoard, toScreen, zoomAt } from './camera'
import type { Camera } from './camera'
import {
  childrenOf, connectorsFor, createItems, getIndex, getItems, patchItems, removeItems, transact,
} from './doc'
import {
  aabb, anchorPoint, ANCHOR_SIDES, connectorBends, contains, hitTest, nearestAnchor, overlaps,
  resizeBox, snapAngle, snapMove, snapSpacing,
} from './geometry'
import type { Box, Handle } from './geometry'
import {
  cellAt, cloneItems, freeEndpoint, makeComment, makeConnector, makeDraw, makeFrame, makeShape,
  makeSticky, makeTable, makeText, resolveEndpoint, STICKY_SIZE, TABLE_CELL_H, TABLE_CELL_W,
} from './items'
import {
  boxOf, commentPinScreen, connectorGeometry, connectorHandles, handleScreenRects, PIN_R, quickHit,
  QUICK_TYPES,
} from './render'
import { requestRender, session, useBoardStore } from './store'
import type { Tool } from './store'
import type { AnchorSide, Endpoint, Id, Item, Rect, Vec } from './types'

type Snap = { id: Id; x: number; y: number; w: number; h: number; rotation: number; points?: number[] }

type Drag =
  | { kind: 'pan'; sx: number; sy: number; cam: Camera }
  | { kind: 'marquee'; origin: Vec; additive: boolean; base: Id[] }
  | { kind: 'translate'; origin: Vec; snaps: Snap[]; others: Rect[]; moved: boolean; cloned: boolean }
  | { kind: 'resize'; handle: Handle; box: Box; snaps: Snap[]; single: boolean }
  | { kind: 'rotate'; center: Vec; start: number; snaps: Snap[] }
  | { kind: 'create'; tool: Tool; origin: Vec; id: Id | null }
  | { kind: 'draw'; pts: number[][] }
  | { kind: 'connect'; from: Endpoint; to: Vec; targetId: Id | null; targetSide: AnchorSide | null }
  | { kind: 'endpoint'; id: Id; which: 'from' | 'to' }
  | { kind: 'bend'; id: Id; index: number }
  | { kind: 'erase' }

let drag: Drag | null = null
let lastPointer: Vec = { x: 0, y: 0 }
let downAt = 0
let didDrag = false

const store = () => useBoardStore.getState()
const cam = () => store().camera

export const getPointer = () => lastPointer

export function expandGroups(ids: Id[]): Id[] {
  const index = getIndex()
  const groups = new Set(ids.map((id) => index.get(id)?.groupId).filter(Boolean) as Id[])
  if (!groups.size) return ids
  const out = new Set(ids)
  for (const item of getItems()) if (item.groupId && groups.has(item.groupId)) out.add(item.id)
  return [...out]
}

export function groupSelection() {
  const s = store()
  const ids = expandGroups(s.selection)
  if (ids.length < 2) return
  const gid = `g_${ids[0]}`
  patchItems(ids.map((id) => [id, { groupId: gid }] as [Id, Record<string, unknown>]))
  s.setSelection(ids)
}

export function ungroupSelection() {
  const s = store()
  const ids = expandGroups(s.selection)
  patchItems(ids.map((id) => [id, { groupId: null }] as [Id, Record<string, unknown>]))
}

function pickAt(p: Vec, screenTolerance = 6): Item | null {
  const c = cam()
  const tol = screenTolerance / c.z
  const screen = toScreen(c, p.x, p.y)
  const items = getItems()
  const resolve = (e: Endpoint) => resolveEndpoint(e)
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.type === 'comment') {
      const pin = commentPinScreen(c, item)
      if (Math.hypot(pin.x - screen.x, pin.y - screen.y) <= PIN_R + 2) return item
      continue
    }
    if (hitTest(item, p, tol, resolve)) return item
  }
  return null
}

export function quickCreate(id: Id, side: 'top' | 'right' | 'bottom' | 'left') {
  const s = store()
  const item = getIndex().get(id)
  if (!item) return
  const gap = 40
  const dx = side === 'right' ? item.w + gap : side === 'left' ? -(item.w + gap) : 0
  const dy = side === 'bottom' ? item.h + gap : side === 'top' ? -(item.h + gap) : 0
  const [copy] = cloneItems([item], dx, dy)
  if ('text' in copy) copy.text = ''
  createItems([copy])
  s.setSelection([copy.id])
  if ('text' in copy) s.setEditing({ id: copy.id, selectAll: false })
  reparentToFrames([copy.id])
}

export function quickCreateFromSelection(side: 'top' | 'right' | 'bottom' | 'left' = 'right') {
  const s = store()
  if (s.selection.length !== 1) return
  const item = getIndex().get(s.selection[0])
  if (item && QUICK_TYPES.has(item.type)) quickCreate(item.id, side)
}

function eraseAt(p: Vec) {
  const tol = 8 / cam().z
  const resolve = (e: Endpoint) => resolveEndpoint(e)
  const victims = getItems()
    .filter((i) => i.type === 'draw' && !i.locked && hitTest(i, p, tol, resolve))
    .map((i) => i.id)
  if (victims.length) removeItems(victims)
}

function selectionBox(): (Box & { single: boolean }) | null {
  const { selection } = store()
  if (!selection.length) return null
  const index = getIndex()
  const items = (selection.map((id) => index.get(id)).filter(Boolean) as Item[])
    .filter((i) => i.type !== 'comment')
  if (!items.length) return null
  if (items.length === 1) {
    const it = items[0]
    if (it.type === 'connector') return null
    return { x: it.x, y: it.y, w: it.w, h: it.h, rotation: it.rotation, single: true }
  }
  return { ...boxOf(items), rotation: 0, single: false }
}

function pickHandle(screen: Vec): { handle: Handle; rotate: boolean } | null {
  const box = selectionBox()
  if (!box) return null
  const rects = handleScreenRects(cam(), box)
  for (const r of rects) {
    const d = Math.hypot(screen.x - r.x, screen.y - r.y)
    if (d <= 8) return { handle: r.handle, rotate: false }
  }
  for (const r of rects) {
    if (r.handle.length !== 2) continue
    const d = Math.hypot(screen.x - r.x, screen.y - r.y)
    if (d <= 24) return { handle: r.handle, rotate: true }
  }
  return null
}

function anchorAt(p: Vec, item: Item | null): AnchorSide | null {
  if (!item || item.type === 'connector' || item.type === 'frame') return null
  const tol = 11 / cam().z
  for (const side of ANCHOR_SIDES) {
    const a = anchorPoint(item, side)
    if (Math.hypot(a.x - p.x, a.y - p.y) <= tol) return side
  }
  return null
}

function snapshotOf(ids: Id[]): Snap[] {
  const index = getIndex()
  const out: Snap[] = []
  const seen = new Set<Id>()
  const push = (id: Id) => {
    if (seen.has(id)) return
    const it = index.get(id)
    if (!it) return
    seen.add(id)
    out.push({ id, x: it.x, y: it.y, w: it.w, h: it.h, rotation: it.rotation })
    if (it.type === 'frame') childrenOf(id).forEach((c) => push(c.id))
  }
  ids.forEach(push)
  return out
}

function moveEndpointsFor(snaps: Snap[], dx: number, dy: number): [Id, Record<string, unknown>][] {
  const ids = new Set(snaps.map((s) => s.id))
  const out: [Id, Record<string, unknown>][] = []
  for (const c of connectorsFor(ids)) {
    if (c.type !== 'connector') continue
    const both = ids.has(c.from.itemId ?? '') && ids.has(c.to.itemId ?? '')
    if (!both) continue
    void dx; void dy
  }
  return out
}

let lastFlush = 0

function stage(entries: [Id, Record<string, unknown>][]) {
  for (const [id, patch] of entries) {
    const cur = session.preview.get(id)
    session.preview.set(id, cur ? { ...cur, ...patch } : { ...patch })
  }
  const now = performance.now()
  if (now - lastFlush > 80) {
    lastFlush = now
    patchItems([...session.preview.entries()])
  }
}

export function flushPreview() {
  if (!session.preview.size) return
  patchItems([...session.preview.entries()])
  session.preview.clear()
}

export function cancelDrag() {
  if (store().dragging) store().update({ dragging: false })
  session.preview.clear()
  session.badge = null
  session.spacing = []
  session.dropFrame = null
  drag = null
  session.marquee = null
  session.guides = []
  session.draft = null
  session.connectorDraft = null
  requestRender()
}

export function pointerDown(e: PointerEvent, screen: Vec) {
  const s = store()
  const p = toBoard(s.camera, screen.x, screen.y)
  lastPointer = p
  downAt = performance.now()
  didDrag = false
  drag = null

  if (e.button === 1 || s.tool === 'hand' || session.spaceDown) {
    drag = { kind: 'pan', sx: screen.x, sy: screen.y, cam: { ...s.camera } }
    return
  }
  if (e.button === 2) return

  if (s.editing) s.setEditing(null)
  if (s.openComment) {
    const under = pickAt(p)
    if (under?.id !== s.openComment) s.update({ openComment: null })
  }

  if (s.tool === 'pen') {
    if (s.pen.eraser) {
      drag = { kind: 'erase' }
      eraseAt(p)
      return
    }
    drag = { kind: 'draw', pts: [[p.x, p.y, e.pressure || 0.5]] }
    return
  }

  if (s.tool === 'comment') {
    const existing = pickAt(p)
    if (existing?.type === 'comment') {
      s.setSelection([existing.id])
      s.update({ openComment: existing.id })
      s.setTool('select')
      return
    }
    const c = makeComment(p.x, p.y, '')
    createItems([c])
    s.setSelection([c.id])
    s.update({ openComment: c.id })
    s.setTool('select')
    return
  }

  if (s.tool === 'sticky' || s.tool === 'shape' || s.tool === 'frame' || s.tool === 'text' || s.tool === 'table') {
    drag = { kind: 'create', tool: s.tool, origin: p, id: null }
    return
  }

  if (s.tool === 'connector') {
    const target = pickAt(p)
    const from: Endpoint = target
      ? { itemId: target.id, anchor: anchorAt(p, target) ?? nearestAnchor(target, p), x: p.x, y: p.y }
      : freeEndpoint(p)
    drag = { kind: 'connect', from, to: p, targetId: null, targetSide: null }
    return
  }

  if (s.selection.length === 1) {
    const only = getIndex().get(s.selection[0])
    if (only?.type === 'connector' && !only.locked) {
      const { a, b } = connectorGeometry(only)
      const sa = toScreen(s.camera, a.x, a.y)
      const sb = toScreen(s.camera, b.x, b.y)
      if (Math.hypot(sa.x - screen.x, sa.y - screen.y) <= 9) {
        drag = { kind: 'endpoint', id: only.id, which: 'from' }
        return
      }
      if (Math.hypot(sb.x - screen.x, sb.y - screen.y) <= 9) {
        drag = { kind: 'endpoint', id: only.id, which: 'to' }
        return
      }
      const handles = connectorHandles(only)
      for (let i = 0; i < handles.bends.length; i++) {
        const sp = toScreen(s.camera, handles.bends[i].x, handles.bends[i].y)
        if (Math.hypot(sp.x - screen.x, sp.y - screen.y) <= 9) {
          drag = { kind: 'bend', id: only.id, index: i }
          return
        }
      }
      for (const ghost of handles.ghosts) {
        const sp = toScreen(s.camera, ghost.at.x, ghost.at.y)
        if (Math.hypot(sp.x - screen.x, sp.y - screen.y) <= 9) {
          const next = [...handles.bends]
          next.splice(ghost.index, 0, { x: p.x, y: p.y })
          patchItems([[only.id, { bends: next, bend: null }]])
          drag = { kind: 'bend', id: only.id, index: ghost.index }
          return
        }
      }
    }
    if (only && QUICK_TYPES.has(only.type) && !only.locked) {
      const side = quickHit(s.camera, only, screen)
      if (side) { quickCreate(only.id, side); drag = null; return }
    }
  }

  const handle = s.selection.some((id) => getIndex().get(id)?.locked) ? null : pickHandle(screen)
  if (handle) {
    const box = selectionBox()!
    const snaps = snapshotOf(s.selection)
    if (handle.rotate) {
      const c = { x: box.x + box.w / 2, y: box.y + box.h / 2 }
      drag = { kind: 'rotate', center: c, start: Math.atan2(p.y - c.y, p.x - c.x), snaps }
    } else {
      drag = { kind: 'resize', handle: handle.handle, box, snaps, single: box.single }
    }
    return
  }

  const hovered = pickAt(p)
  if (hovered && (e.metaKey || e.ctrlKey) && 'text' in hovered && firstUrl(hovered.text)) {
    openLinkOf(hovered.id)
    drag = null
    return
  }
  if (hovered?.type === 'comment') {
    s.setSelection([hovered.id])
    s.update({ openComment: hovered.id })
    drag = {
      kind: 'translate', origin: p,
      snaps: snapshotOf([hovered.id]), others: [], moved: false, cloned: false,
    }
    return
  }
  const side = anchorAt(p, hovered)
  if (hovered && side && s.selection.length <= 1) {
    drag = {
      kind: 'connect',
      from: { itemId: hovered.id, anchor: side, x: p.x, y: p.y },
      to: p, targetId: null, targetSide: null,
    }
    return
  }

  if (!hovered) {
    if (!e.shiftKey) s.setSelection([])
    drag = { kind: 'marquee', origin: p, additive: e.shiftKey, base: e.shiftKey ? s.selection : [] }
    return
  }

  let selection = s.selection
  const group = expandGroups([hovered.id])
  if (e.shiftKey) {
    selection = selection.includes(hovered.id)
      ? selection.filter((id) => !group.includes(id))
      : [...new Set([...selection, ...group])]
    s.setSelection(selection)
    if (!selection.includes(hovered.id)) { drag = null; return }
  } else if (!selection.includes(hovered.id)) {
    selection = group
    s.setSelection(selection)
  }

  const index = getIndex()
  if (selection.some((id) => index.get(id)?.locked)) { drag = null; return }

  const snaps = snapshotOf(selection)
  const movingIds = new Set(snaps.map((x) => x.id))
  const others = getItems()
    .filter((i) => !movingIds.has(i.id) && i.type !== 'connector')
    .map(aabb)
  drag = { kind: 'translate', origin: p, snaps, others, moved: false, cloned: e.altKey }
}

export function pointerMove(e: PointerEvent, screen: Vec) {
  const s = store()
  const p = toBoard(s.camera, screen.x, screen.y)
  lastPointer = p

  if (drag && e.buttons === 0) {
    cancelDrag()
    updateHover(p, screen)
    requestRender()
    return
  }
  if (!drag) {
    updateHover(p, screen)
    requestRender()
    return
  }
  didDrag = true
  if (!s.dragging && drag.kind !== 'pan') s.update({ dragging: true })

  switch (drag.kind) {
    case 'pan': {
      const dz = drag.cam.z
      s.setCamera({
        z: dz,
        x: drag.cam.x - (screen.x - drag.sx) / dz,
        y: drag.cam.y - (screen.y - drag.sy) / dz,
      })
      session.cursor = 'grabbing'
      break
    }
    case 'marquee': {
      const m = {
        x: Math.min(drag.origin.x, p.x), y: Math.min(drag.origin.y, p.y),
        w: Math.abs(p.x - drag.origin.x), h: Math.abs(p.y - drag.origin.y),
      }
      session.marquee = m
      const hits = getItems()
        .filter((i) => !i.locked && (i.type === 'frame' ? contains(m, aabb(i)) : overlaps(aabb(i), m)))
        .map((i) => i.id)
      s.setSelection(expandGroups(drag.additive ? [...new Set([...drag.base, ...hits])] : hits))
      break
    }
    case 'translate': {
      if (drag.cloned && !drag.moved) {
        const index = getIndex()
        const originals = drag.snaps.map((sn) => index.get(sn.id)!).filter(Boolean)
        const copies = cloneItems(originals, 0, 0)
        createItems(copies)
        s.setSelection(copies.map((c) => c.id))
        drag.snaps = copies.map((c) => ({ id: c.id, x: c.x, y: c.y, w: c.w, h: c.h, rotation: c.rotation }))
      }
      drag.moved = true
      let dx = p.x - drag.origin.x
      let dy = p.y - drag.origin.y
      if (e.shiftKey) {
        if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0
      }
      const movingBox = boxFromSnaps(drag.snaps, dx, dy)
      if (!e.metaKey && !e.ctrlKey) {
        const tol = 6 / s.camera.z
        const spacing = snapSpacing(movingBox, drag.others, tol)
        session.spacing = []
        if (spacing.x) { dx += spacing.x.delta; session.spacing.push(...spacing.x.marks) }
        if (spacing.y) { dy += spacing.y.delta; session.spacing.push(...spacing.y.marks) }
        const snap = snapMove(boxFromSnaps(drag.snaps, dx, dy), drag.others, tol)
        if (!spacing.x) dx += snap.dx
        if (!spacing.y) dy += snap.dy
        session.guides = [
          ...(spacing.x ? [] : snap.guides.filter((g) => g[0].x === g[1].x)),
          ...(spacing.y ? [] : snap.guides.filter((g) => g[0].y === g[1].y)),
        ]
      } else { session.guides = []; session.spacing = [] }

      const moved = boxFromSnaps(drag.snaps, dx, dy)
      const c = { x: moved.x + moved.w / 2, y: moved.y + moved.h / 2 }
      const movingIds = new Set(drag.snaps.map((sn) => sn.id))
      const frame = [...getItems()].reverse().find(
        (f) => f.type === 'frame' && !movingIds.has(f.id) &&
          c.x >= f.x && c.x <= f.x + f.w && c.y >= f.y && c.y <= f.y + f.h,
      )
      session.dropFrame = frame?.id ?? null
      stage(drag.snaps.map((sn) => [sn.id, { x: sn.x + dx, y: sn.y + dy }]))
      break
    }
    case 'resize': {
      const only = drag.single ? getIndex().get(s.selection[0]) : null
      const keepsAspect = only?.type === 'image' || only?.type === 'draw'
      const ratio = keepsAspect ? !e.shiftKey : e.shiftKey || !drag.single
      const next = resizeBox(drag.box, drag.handle, p, ratio, e.altKey)
      session.badge = `${Math.round(next.w)} × ${Math.round(next.h)}`
      const sx = drag.box.w ? next.w / drag.box.w : 1
      const sy = drag.box.h ? next.h / drag.box.h : 1
      stage(drag.snaps.map((sn) => {
        if (drag!.kind !== 'resize') return [sn.id, {}]
        if (drag.single) return [sn.id, { x: next.x, y: next.y, w: next.w, h: next.h, autoWidth: false }]
        return [sn.id, {
          x: next.x + (sn.x - drag.box.x) * sx,
          y: next.y + (sn.y - drag.box.y) * sy,
          w: sn.w * sx,
          h: sn.h * sy,
        }]
      }))
      break
    }
    case 'rotate': {
      const a = Math.atan2(p.y - drag.center.y, p.x - drag.center.x)
      let delta = a - drag.start
      session.badge = `${Math.round(((drag.snaps[0].rotation + delta) * 180 / Math.PI) % 360)}°`
      stage(drag.snaps.map((sn) => {
        const c = drag!.kind === 'rotate' ? drag.center : { x: 0, y: 0 }
        const rot = e.shiftKey ? snapAngle(sn.rotation + delta) : sn.rotation + delta
        const applied = e.shiftKey ? rot - sn.rotation : delta
        const px = sn.x + sn.w / 2 - c.x, py = sn.y + sn.h / 2 - c.y
        const cos = Math.cos(applied), sin = Math.sin(applied)
        return [sn.id, {
          rotation: rot,
          x: c.x + px * cos - py * sin - sn.w / 2,
          y: c.y + px * sin + py * cos - sn.h / 2,
        }]
      }))
      break
    }
    case 'create': {
      const r = rectBetween(drag.origin, p)
      session.marquee = r.w > 4 || r.h > 4 ? r : null
      break
    }
    case 'draw': {
      drag.pts.push([p.x, p.y, e.pressure || 0.5])
      session.draft = drag.pts
      break
    }
    case 'connect': {
      const target = pickAt(p, 2)
      drag.to = p
      drag.targetId = target && target.id !== drag.from.itemId ? target.id : null
      drag.targetSide = target ? anchorAt(p, target) : null
      session.connectorDraft = {
        from: resolveEndpoint(drag.from, p),
        to: drag.targetId ? anchorPoint(getIndex().get(drag.targetId)!, drag.targetSide ?? nearestAnchor(getIndex().get(drag.targetId)!, resolveEndpoint(drag.from, p))) : p,
        target: drag.targetId,
      }
      s.setHover(drag.targetId)
      break
    }
    case 'bend': {
      const { id, index } = drag
      const target = getIndex().get(id)
      if (target?.type === 'connector') {
        const next = connectorBends(target).map((v, i) => (i === index ? { x: p.x, y: p.y } : v))
        patchItems([[id, { bends: next, bend: null }]])
      }
      break
    }
    case 'erase': {
      eraseAt(p)
      break
    }
    case 'endpoint': {
      const target = pickAt(p, 2)
      const key = drag.which
      const ep: Endpoint = target
        ? { itemId: target.id, anchor: anchorAt(p, target), x: p.x, y: p.y }
        : freeEndpoint(p)
      patchItems([[drag.id, { [key]: ep }]])
      break
    }
  }
  requestRender()
}

export function pointerUp(_e: PointerEvent, screen: Vec) {
  const s = store()
  const p = toBoard(s.camera, screen.x, screen.y)
  const quick = performance.now() - downAt < 250 && !didDrag
  flushPreview()

  if (drag?.kind === 'create') {
    const r = rectBetween(drag.origin, p)
    finishCreate(drag.tool, r, quick, p)
  } else if (drag?.kind === 'draw') {
    finishDraw(drag.pts)
  } else if (drag?.kind === 'connect') {
    finishConnect(drag, p)
  } else if (drag?.kind === 'translate' && drag.moved) {
    reparentToFrames(drag.snaps.map((x) => x.id))
  }

  session.marquee = null
  session.guides = []
  session.draft = null
  session.connectorDraft = null
  session.badge = null
  session.spacing = []
  session.dropFrame = null
  drag = null
  if (s.dragging) s.update({ dragging: false })
  requestRender()
}

function boxFromSnaps(snaps: Snap[], dx: number, dy: number): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const s of snaps) {
    x0 = Math.min(x0, s.x + dx); y0 = Math.min(y0, s.y + dy)
    x1 = Math.max(x1, s.x + s.w + dx); y1 = Math.max(y1, s.y + s.h + dy)
  }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
}

function rectBetween(a: Vec, b: Vec): Rect {
  return {
    x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y),
  }
}

function finishCreate(tool: Tool, r: Rect, quick: boolean, p: Vec) {
  const s = store()
  let item: Item
  if (tool === 'sticky') {
    const size = quick ? STICKY_SIZE : Math.max(r.w, r.h, 60)
    item = makeSticky(quick ? p.x - size / 2 : r.x, quick ? p.y - size / 2 : r.y, s.stickyFill, '', {
      ...s.textStyle, align: 'center', valign: 'middle', autoFit: true, fontSize: 36,
    })
    item.w = size; item.h = size
  } else if (tool === 'shape') {
    const w = quick ? 200 : Math.max(r.w, 8)
    const h = quick ? 200 : Math.max(r.h, 8)
    item = makeShape(quick ? p.x - w / 2 : r.x, quick ? p.y - h / 2 : r.y, w, h, s.shape, s.textStyle)
  } else if (tool === 'frame') {
    const w = quick ? 1600 : Math.max(r.w, 100)
    const h = quick ? 900 : Math.max(r.h, 100)
    const count = getItems().filter((i) => i.type === 'frame').length + 1
    item = makeFrame(quick ? p.x - w / 2 : r.x, quick ? p.y - h / 2 : r.y, w, h, `Frame ${count}`)
  } else if (tool === 'table') {
    const cols = quick ? 3 : Math.max(1, Math.round(r.w / TABLE_CELL_W))
    const rows = quick ? 3 : Math.max(1, Math.round(r.h / TABLE_CELL_H))
    const t = makeTable(0, 0, rows, cols, s.textStyle)
    t.x = quick ? p.x - t.w / 2 : r.x
    t.y = quick ? p.y - t.h / 2 : r.y
    item = t
  } else {
    const w = quick ? 320 : Math.max(r.w, 80)
    item = makeText(quick ? p.x : r.x, quick ? p.y - s.textStyle.fontSize : r.y, w, s.textStyle)
  }
  createItems([item])
  s.setSelection([item.id])
  s.setTool('select')
  if (item.type === 'table') s.setEditing({ id: item.id, selectAll: false, cell: [0, 0] })
  else if (item.type !== 'frame') s.setEditing({ id: item.id, selectAll: false })
  reparentToFrames([item.id])
}

function finishDraw(pts: number[][]) {
  const s = store()
  if (pts.length < 2) return
  const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1])
  const pad = s.pen.strokeWidth
  const x = Math.min(...xs) - pad, y = Math.min(...ys) - pad
  const w = Math.max(...xs) - Math.min(...xs) + pad * 2
  const h = Math.max(...ys) - Math.min(...ys) + pad * 2
  const flat: number[] = []
  for (const [px, py, pr] of pts) flat.push((px - x) / w, (py - y) / h, pr)
  createItems([makeDraw(flat, x, y, w, h, s.pen)])
}

function finishConnect(d: Extract<Drag, { kind: 'connect' }>, p: Vec) {
  const s = store()
  const target = d.targetId ? getIndex().get(d.targetId) : null
  const to: Endpoint = target
    ? { itemId: target.id, anchor: d.targetSide ?? nearestAnchor(target, resolveEndpoint(d.from, p)), x: p.x, y: p.y }
    : freeEndpoint(p)
  const from = { ...d.from }
  if (Math.hypot(p.x - resolveEndpoint(from, p).x, p.y - resolveEndpoint(from, p).y) < 8 && !target) return
  const c = makeConnector(from, to, s.connector)
  createItems([c])
  s.setSelection([c.id])
  if (s.tool === 'connector') s.setTool('select')
}

export function reparentToFrames(ids: Id[]) {
  const index = getIndex()
  const frames = getItems().filter((i) => i.type === 'frame')
  const patches: [Id, Record<string, unknown>][] = []
  for (const id of ids) {
    const item = index.get(id)
    if (!item || item.type === 'frame') continue
    const c = { x: item.x + item.w / 2, y: item.y + item.h / 2 }
    const frame = [...frames].reverse().find(
      (f) => c.x >= f.x && c.x <= f.x + f.w && c.y >= f.y && c.y <= f.y + f.h,
    )
    const next = frame?.id ?? null
    if ((item.parentId ?? null) !== next) patches.push([id, { parentId: next }])
  }
  if (patches.length) patchItems(patches)
}

function updateHover(p: Vec, screen: Vec) {
  const s = store()
  const handle = pickHandle(screen)
  const hit = pickAt(p)
  s.setHover(hit?.id ?? null)

  if (session.spaceDown || s.tool === 'hand') session.cursor = 'grab'
  else if (handle) {
    session.cursor = handle.rotate
      ? 'crosshair'
      : { n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize' }[handle.handle]
  } else if (s.tool === 'pen' || s.tool === 'connector' || s.tool === 'shape' || s.tool === 'frame') {
    session.cursor = 'crosshair'
  } else if (s.tool === 'sticky' || s.tool === 'text') session.cursor = 'copy'
  else if (hit && anchorAt(p, hit)) session.cursor = 'crosshair'
  else session.cursor = hit ? 'move' : 'default'
}

export function wheel(e: WheelEvent, screen: Vec) {
  const s = store()
  if (e.ctrlKey || e.metaKey) {
    const factor = Math.exp(-e.deltaY * 0.01)
    s.setCamera(zoomAt(s.camera, screen.x, screen.y, s.camera.z * factor))
  } else {
    const dx = e.shiftKey ? e.deltaY : e.deltaX
    const dy = e.shiftKey ? 0 : e.deltaY
    s.setCamera((c) => ({ ...c, x: c.x + dx / c.z, y: c.y + dy / c.z }))
  }
  requestRender()
}

export function doubleClick(screen: Vec) {
  const s = store()
  const p = toBoard(s.camera, screen.x, screen.y)
  const hit = pickAt(p)
  if (hit?.type === 'table') {
    const cell = cellAt(hit, p)
    s.setSelection([hit.id])
    s.setEditing({ id: hit.id, selectAll: true, cell: cell ?? [0, 0] })
    return
  }
  if (hit && hit.type !== 'draw' && hit.type !== 'image') {
    if (hit.type === 'frame') {
      s.setSelection([hit.id])
      s.update({ renamingFrame: hit.id })
      return
    }
    s.setSelection([hit.id])
    s.setEditing({ id: hit.id, selectAll: true })
    return
  }
  if (!hit) {
    const item = makeText(p.x - 160, p.y - s.textStyle.fontSize, 320, s.textStyle)
    createItems([item])
    s.setSelection([item.id])
    s.setEditing({ id: item.id, selectAll: false })
  }
}

export type AlignMode = 'left' | 'centerX' | 'right' | 'top' | 'centerY' | 'bottom'

export function alignSelection(mode: AlignMode) {
  const index = getIndex()
  const items = store().selection.map((id) => index.get(id)!).filter(Boolean)
  if (items.length < 2) return
  const box = boxOf(items)
  const patches = items.map((i) => {
    const b = aabb(i)
    const dx =
      mode === 'left' ? box.x - b.x :
      mode === 'centerX' ? box.x + box.w / 2 - (b.x + b.w / 2) :
      mode === 'right' ? box.x + box.w - (b.x + b.w) : 0
    const dy =
      mode === 'top' ? box.y - b.y :
      mode === 'centerY' ? box.y + box.h / 2 - (b.y + b.h / 2) :
      mode === 'bottom' ? box.y + box.h - (b.y + b.h) : 0
    return [i.id, { x: i.x + dx, y: i.y + dy }] as [Id, Record<string, unknown>]
  })
  patchItems(patches)
}

export function distributeSelection(axis: 'h' | 'v') {
  const index = getIndex()
  const items = store().selection.map((id) => index.get(id)!).filter(Boolean)
  if (items.length < 3) return
  const key = axis === 'h' ? 'x' : 'y'
  const span = axis === 'h' ? 'w' : 'h'
  const sorted = [...items].sort((a, b) => aabb(a)[key] - aabb(b)[key])
  const first = aabb(sorted[0]), last = aabb(sorted[sorted.length - 1])
  const totalGap =
    (last[key] + last[span] - first[key]) - sorted.reduce((sum, i) => sum + aabb(i)[span], 0)
  const gap = totalGap / (sorted.length - 1)
  let cursor = first[key] + first[span] + gap
  const patches: [Id, Record<string, unknown>][] = []
  for (let i = 1; i < sorted.length - 1; i++) {
    const item = sorted[i]
    const b = aabb(item)
    patches.push([item.id, { [key]: item[key] + (cursor - b[key]) }])
    cursor += b[span] + gap
  }
  patchItems(patches)
}

export function arrangeInGrid(gap = 40) {
  const index = getIndex()
  const items = store().selection.map((id) => index.get(id)!).filter(Boolean)
    .filter((i) => i.type !== 'connector' && i.type !== 'comment')
  if (items.length < 2) return
  const box = boxOf(items)
  const cols = Math.ceil(Math.sqrt(items.length))
  const cellW = Math.max(...items.map((i) => i.w)) + gap
  const cellH = Math.max(...items.map((i) => i.h)) + gap
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x)
  patchItems(sorted.map((item, i) => [item.id, {
    x: box.x + (i % cols) * cellW,
    y: box.y + Math.floor(i / cols) * cellH,
  }] as [Id, Record<string, unknown>]))
}

const STYLE_KEYS = [
  'fill', 'stroke', 'strokeWidth', 'strokeStyle', 'textColor', 'fontSize', 'fontFamily',
  'bold', 'italic', 'underline', 'strike', 'align', 'valign', 'opacity', 'capStart', 'capEnd',
] as const

let styleClipboard: Record<string, unknown> | null = null

export function copyStyle() {
  const item = getIndex().get(store().selection[0])
  if (!item) return
  const out: Record<string, unknown> = {}
  for (const k of STYLE_KEYS) {
    if (k in item) out[k] = (item as unknown as Record<string, unknown>)[k]
  }
  styleClipboard = out
}

export function pasteStyle() {
  if (!styleClipboard) return
  const index = getIndex()
  patchItems(store().selection.flatMap((id) => {
    const item = index.get(id)
    if (!item) return []
    const patch: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(styleClipboard!)) if (k in item) patch[k] = v
    return [[id, patch] as [Id, Record<string, unknown>]]
  }))
}

export const hasStyleClipboard = () => styleClipboard !== null

export function selectInsideFrame(frameId: Id) {
  const frame = getIndex().get(frameId)
  if (!frame) return
  const inside = getItems()
    .filter((i) => i.id !== frameId && !i.locked && contains(frame, aabb(i)))
    .map((i) => i.id)
  if (inside.length) store().setSelection(inside)
}

export function fitStickyToText() {
  const index = getIndex()
  const patches: [Id, Record<string, unknown>][] = []
  for (const id of store().selection) {
    const item = index.get(id)
    if (!item || item.type !== 'sticky') continue
    const inset = 0.1
    let size = 100
    for (const candidate of [100, 140, 180, 228, 280, 340, 420, 480, 560]) {
      const box = candidate * (1 - inset * 2)
      const fitted = layoutText(item.text || ' ', box, box, item)
      if (fitted.fontSize >= Math.min(item.fontSize, 18)) { size = candidate; break }
      size = candidate
    }
    patches.push([id, { w: size, h: size }])
  }
  if (patches.length) patchItems(patches)
}

export function openLinkOf(id: Id) {
  const item = getIndex().get(id)
  if (!item || !('text' in item)) return
  const url = firstUrl(item.text)
  if (url) window.open(url, '_blank', 'noopener,noreferrer')
}

export function contextMenuAt(screen: Vec) {
  const s = store()
  const p = toBoard(s.camera, screen.x, screen.y)
  const hit = pickAt(p)
  if (hit && !s.selection.includes(hit.id)) s.setSelection(expandGroups([hit.id]))
  if (!hit) s.setSelection([])
}

export function deleteSelection() {
  const s = store()
  if (!s.selection.length) return
  const ids = new Set(s.selection)
  for (const id of s.selection) childrenOf(id).forEach((c) => ids.delete(c.id))
  removeItems([...ids])
  s.setSelection([])
}

export function duplicateSelection(dx = 20, dy = 20) {
  const s = store()
  const index = getIndex()
  const items = s.selection.map((id) => index.get(id)).filter(Boolean) as Item[]
  if (!items.length) return
  const copies = cloneItems(items, dx, dy)
  createItems(copies)
  s.setSelection(copies.map((c) => c.id))
}

export function nudge(dx: number, dy: number) {
  const s = store()
  const index = getIndex()
  transact(() => {
    patchItems(s.selection.flatMap((id) => {
      const it = index.get(id)
      return it ? ([[id, { x: it.x + dx, y: it.y + dy }]] as [Id, Record<string, unknown>][]) : []
    }))
  })
}

export function reorder(dir: 'front' | 'back' | 'forward' | 'backward') {
  const s = store()
  const items = getItems()
  const index = getIndex()
  const maxZ = Math.max(0, ...items.map((i) => i.z))
  const minZ = Math.min(0, ...items.map((i) => i.z))
  const patches: [Id, Record<string, unknown>][] = s.selection.flatMap((id, i) => {
    const it = index.get(id)
    if (!it) return []
    const z =
      dir === 'front' ? maxZ + 1 + i :
      dir === 'back' ? minZ - 1 - i :
      dir === 'forward' ? it.z + 1.5 : it.z - 1.5
    return [[id, { z }] as [Id, Record<string, unknown>]]
  })
  patchItems(patches)
}

export const anchorScreen = (item: Item, side: AnchorSide, c: Camera) =>
  toScreen(c, anchorPoint(item, side).x, anchorPoint(item, side).y)

void moveEndpointsFor
