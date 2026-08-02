import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { animateCamera, ease } from './camera'
import type { Camera } from './camera'

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

beforeEach(() => {
  now = 0
  seq = 0
  reduced = false
  pending = new Map()
  vi.stubGlobal('performance', { now: () => now })
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    pending.set(++seq, cb)
    return seq
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => { pending.delete(id) })
  vi.stubGlobal('matchMedia', (q: string) => ({ matches: reduced && q.includes('reduced-motion') }))
})

afterEach(() => vi.unstubAllGlobals())

const at = (x: number): Camera => ({ x, y: 0, z: 1 })

describe('ease', () => {
  it('starts at rest and lands exactly on the target', () => {
    expect(ease(0)).toBe(0)
    expect(ease(1)).toBe(1)
    expect(ease(-0.2)).toBe(0)
    expect(ease(4)).toBe(1)
  })

  it('is the cubic-bezier(.16, 1, .3, 1) the stylesheet uses', () => {
    expect(ease(0.1)).toBeCloseTo(0.4944, 3)
    expect(ease(0.25)).toBeCloseTo(0.8256, 3)
    expect(ease(0.5)).toBeCloseTo(0.9718, 3)
    expect(ease(0.9)).toBeCloseTo(0.9999, 3)
  })

  it('never goes backwards', () => {
    let prev = -1
    for (let i = 0; i <= 100; i++) {
      const k = ease(i / 100)
      expect(k).toBeGreaterThanOrEqual(prev)
      prev = k
    }
  })
})

describe('animateCamera', () => {
  it('flies instead of jumping', () => {
    const apply = vi.fn()
    animateCamera(at(0), at(1000), apply)
    tick(16)
    const first = apply.mock.lastCall![0] as Camera
    expect(first.x).toBeGreaterThan(0)
    expect(first.x).toBeLessThan(1000)
    tick(1000)
    expect(apply.mock.lastCall![0]).toEqual(at(1000))
  })

  it('jumps to the target when the reader asked for less motion', () => {
    reduced = true
    const apply = vi.fn()
    animateCamera(at(0), at(1000), apply)
    expect(apply).toHaveBeenCalledExactlyOnceWith(at(1000))
    expect(pending.size).toBe(0)
  })

  it('lets the last target win and still arrives there', () => {
    const apply = vi.fn()
    animateCamera(at(0), at(1000), apply)
    tick(100)
    animateCamera(apply.mock.lastCall![0] as Camera, at(-400), apply)
    expect(pending.size).toBe(1)
    tick(1000)
    expect(apply.mock.lastCall![0]).toEqual(at(-400))
    expect(pending.size).toBe(0)
  })
})
