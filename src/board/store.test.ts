import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fitRect } from './camera'
import { flyToRect, useBoardStore } from './store'

let now = 0
let seq = 0
let pending = new Map<number, FrameRequestCallback>()
let reduced = false

const tick = (ms: number) => {
  now += ms
  const due = [...pending.values()]
  pending.clear()
  for (const cb of due) cb(now)
}

const addCanvas = (w = 1000, h = 800) => {
  const el = document.createElement('canvas')
  Object.defineProperty(el, 'clientWidth', { value: w })
  Object.defineProperty(el, 'clientHeight', { value: h })
  document.body.append(el)
  return el
}

beforeEach(() => {
  now = 0
  seq = 0
  reduced = false
  pending = new Map()
  document.body.innerHTML = ''
  useBoardStore.setState({ camera: { x: 0, y: 0, z: 1 } })
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending.set(++seq, cb)
    return seq
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { pending.delete(id) })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduced && q.includes('reduced-motion') }))
})

afterEach(() => vi.unstubAllGlobals())

const rect = { x: 4000, y: 3000, w: 600, h: 400 }
const cam = () => useBoardStore.getState().camera

describe('flyToRect', () => {
  it('travels to the fit instead of teleporting', () => {
    addCanvas()
    const target = fitRect(rect, 1000, 800)
    flyToRect(rect)
    tick(16)
    expect(cam().x).toBeGreaterThan(0)
    expect(cam().x).toBeLessThan(target.x)
    tick(1000)
    expect(cam()).toEqual(target)
  })

  it('arrives at once when the reader asked for less motion', () => {
    reduced = true
    addCanvas()
    flyToRect(rect)
    expect(cam()).toEqual(fitRect(rect, 1000, 800))
    expect(pending.size).toBe(0)
  })

  it('honours the padding it is given', () => {
    addCanvas()
    reduced = true
    flyToRect(rect, 0)
    expect(cam()).toEqual(fitRect(rect, 1000, 800, 0))
  })

  it('leaves the camera alone when there is no canvas', () => {
    flyToRect(rect)
    expect(cam()).toEqual({ x: 0, y: 0, z: 1 })
    expect(pending.size).toBe(0)
  })
})
