import { toBoard, toScreen, zoomAt } from './camera'
import type { Camera } from './camera'
import {
  childrenOf, connectorsFor, createItems, getIndex, getItems, patchItems, removeItems, transact,
} from './doc'
import {
  aabb, anchorPoint, ANCHOR_SIDES, hitTest, nearestAnchor, overlaps, resizeBox, snapAngle, snapMove,
} from './geometry'
import type { Box, Handle } from './geometry'
import {
  cloneItems, freeEndpoint, makeConnector, makeDraw, makeFrame, makeShape, makeSticky, makeText,
  resolveEndpoint, STICKY_SIZE,
} from './items'
import { boxOf, handleScreenRects } from './render'
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
  const tol = screenTolerance / cam().z
  const items = getItems()
  const resolve = (e: Endpoint) => resolveEndpoint(e)
  for (let i = items.length - 1; i >= 0; i--) {
    const item = items[i]
    if (item.locked) continue
    if (hitTest(item, p, tol, resolve)) return item
  }
  return null
}

function selectionBox(): (Box & { single: boolean }) | null {
  const { selection } = store()
  if (!selection.length) return null
  const index = getIndex()
  const items = selection.map((id) => index.get(id)).filter(Boolean) as Item[]
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

export function pointerDown(e: PointerEvent, screen: Vec) {
  const s = store()
  const p = toBoard(s.camera, screen.x, screen.y)
  lastPointer = p
  downAt = performance.now()
  didDrag = false

  if (e.button === 1 || s.tool === 'hand' || session.spaceDown) {
    drag = { kind: 'pan', sx: screen.x, sy: screen.y, cam: { ...s.camera } }
    return
  }
  if (e.button === 2) return

  if (s.editing) s.setEditing(null)

  if (s.tool === 'pen') {
    drag = { kind: 'draw', pts: [[p.x, p.y, e.pressure || 0.5]] }
    return
  }

  if (s.tool === 'sticky' || s.tool === 'shape' || s.tool === 'frame' || s.tool === 'text') {
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

  const handle = pickHandle(screen)
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

  if (!drag) {
    updateHover(p, screen)
    requestRender()
    return
  }
  didDrag = true

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
        .filter((i) => !i.locked && overlaps(aabb(i), m))
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
      const snap = snapMove(movingBox, drag.others, 6 / s.camera.z)
      if (!e.metaKey && !e.ctrlKey) {
        dx += snap.dx; dy += snap.dy
        session.guides = snap.guides
      } else session.guides = []
      patchItems(drag.snaps.map((sn) => [sn.id, { x: sn.x + dx, y: sn.y + dy }]))
      break
    }
    case 'resize': {
      const next = resizeBox(drag.box, drag.handle, p, e.shiftKey || !drag.single, e.altKey)
      const sx = drag.box.w ? next.w / drag.box.w : 1
      const sy = drag.box.h ? next.h / drag.box.h : 1
      patchItems(drag.snaps.map((sn) => {
        if (drag!.kind !== 'resize') return [sn.id, {}]
        if (drag.single) return [sn.id, { x: next.x, y: next.y, w: next.w, h: next.h }]
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
      patchItems(drag.snaps.map((sn) => {
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
  drag = null
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
  } else {
    const w = quick ? 320 : Math.max(r.w, 80)
    item = makeText(quick ? p.x : r.x, quick ? p.y - s.textStyle.fontSize : r.y, w, s.textStyle)
  }
  createItems([item])
  s.setSelection([item.id])
  s.setTool('select')
  if (item.type !== 'frame') s.setEditing({ id: item.id, selectAll: false })
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
  if (hit && hit.type !== 'draw' && hit.type !== 'image') {
    if (hit.type === 'frame') return
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
