import { describe, expect, it } from 'vitest'
import { connectorBounds, curveControls, onFrameTitle, resizeBox, snapMove } from './geometry'
import type { Item } from './types'

const box = (x: number, y: number, w: number, h: number) => ({ x, y, w, h, rotation: 0 })

const wire = (from: string | null, to: string | null, anchor: string | null = 'right') => ({
  id: 'c', type: 'connector', x: 0, y: 0, w: 0, h: 0, rotation: 0, z: 0,
  parentId: null, groupId: null, locked: false, opacity: 1,
  from: { itemId: from, anchor, x: 0, y: 0 },
  to: { itemId: to, anchor: 'left', x: 300, y: 200 },
  shape: 'curved', stroke: '#000', strokeWidth: 2, strokeStyle: 'solid',
  capStart: 'none', capEnd: 'arrow', text: '', bend: null, bends: [],
} as unknown as Item & { type: 'connector' })

describe('resizeBox', () => {
  it('drags the south-east corner without moving the origin', () => {
    const next = resizeBox(box(0, 0, 100, 50), 'se', { x: 200, y: 120 }, false, false)
    expect(next).toMatchObject({ x: 0, y: 0, w: 200, h: 120 })
  })

  it('moves the origin when the north-west corner is dragged', () => {
    const next = resizeBox(box(0, 0, 100, 50), 'nw', { x: -40, y: -10 }, false, false)
    expect(next).toMatchObject({ x: -40, y: -10, w: 140, h: 60 })
  })

  it('keeps the ratio when asked', () => {
    const next = resizeBox(box(0, 0, 100, 50), 'se', { x: 300, y: 60 }, true, false)
    expect(next.w / next.h).toBeCloseTo(2, 5)
  })

  it('grows both ways from the centre with alt', () => {
    const next = resizeBox(box(0, 0, 100, 100), 'se', { x: 150, y: 150 }, false, true)
    expect(next.x).toBeLessThan(0)
    expect(next.y).toBeLessThan(0)
  })
})

describe('curveControls', () => {
  it('leaves the anchor along its own normal', () => {
    const [c1] = curveControls(wire('a', 'b', 'right'), { x: 0, y: 0 }, { x: 300, y: 0 })
    expect(c1.y).toBe(0)
    expect(c1.x).toBeGreaterThan(0)
  })

  it('survives an anchor this build does not know', () => {
    const odd = wire('a', 'b', 'e')
    expect(() => curveControls(odd, { x: 0, y: 0 }, { x: 100, y: 100 })).not.toThrow()
    const [c1] = curveControls(odd, { x: 0, y: 0 }, { x: 100, y: 100 })
    expect(Number.isFinite(c1.x) && Number.isFinite(c1.y)).toBe(true)
  })
})

describe('connectorBounds', () => {
  it('covers both ends', () => {
    const r = connectorBounds(wire('a', 'b'), { a: { x: 10, y: 10 }, b: { x: 200, y: 90 } })
    expect(r.x).toBeLessThanOrEqual(10)
    expect(r.y).toBeLessThanOrEqual(10)
    expect(r.x + r.w).toBeGreaterThanOrEqual(200)
    expect(r.y + r.h).toBeGreaterThanOrEqual(90)
  })
})

describe('onFrameTitle', () => {
  const frame = {
    id: 'f', type: 'frame', x: 0, y: 0, w: 400, h: 200, rotation: 0, z: 0,
    parentId: null, groupId: null, locked: false, opacity: 1, title: 'Discovery', fill: '#fff',
  } as unknown as Item

  it('accepts the strip above the frame', () => {
    expect(onFrameTitle(frame, { x: 20, y: -10 })).toBe(true)
  })

  it('rejects inside the frame and far above it', () => {
    expect(onFrameTitle(frame, { x: 20, y: 40 })).toBe(false)
    expect(onFrameTitle(frame, { x: 20, y: -60 })).toBe(false)
  })

  it('rejects anything that is not a frame', () => {
    expect(onFrameTitle({ ...frame, type: 'sticky' } as Item, { x: 20, y: -10 })).toBe(false)
  })
})

describe('snapMove', () => {
  it('pulls a near edge into line', () => {
    const snap = snapMove(box(103, 0, 100, 100), [{ x: 100, y: 300, w: 100, h: 100 }], 8)
    expect(snap.dx).toBeCloseTo(-3, 5)
  })

  it('leaves a distant edge alone', () => {
    const snap = snapMove(box(400, 0, 100, 100), [{ x: 100, y: 300, w: 100, h: 100 }], 8)
    expect(snap.dx).toBe(0)
  })
})
