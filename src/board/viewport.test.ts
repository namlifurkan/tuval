import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flushCamera, loadCamera, saveCamera } from './viewport'

beforeEach(() => localStorage.clear())

describe('camera memory', () => {
  it('gives nothing back for an unknown board', () => {
    expect(loadCamera('nope')).toBeNull()
  })

  it('remembers where you were', () => {
    saveCamera('alpha', { x: 137, y: -421, z: 2.5 })
    flushCamera('alpha')
    expect(loadCamera('alpha')).toEqual({ x: 137, y: -421, z: 2.5 })
  })

  it('keeps each board separate', () => {
    saveCamera('alpha', { x: 1, y: 1, z: 1 })
    flushCamera('alpha')
    saveCamera('beta', { x: 2, y: 2, z: 2 })
    flushCamera('beta')
    expect(loadCamera('alpha')).toMatchObject({ x: 1 })
    expect(loadCamera('beta')).toMatchObject({ x: 2 })
  })

  it('refuses nonsense instead of restoring a broken view', () => {
    localStorage.setItem('tuval:camera:alpha', '{"x":0,"y":0,"z":0}')
    expect(loadCamera('alpha')).toBeNull()
    localStorage.setItem('tuval:camera:alpha', '{"x":null,"y":0,"z":1}')
    expect(loadCamera('alpha')).toBeNull()
    localStorage.setItem('tuval:camera:alpha', 'garbage')
    expect(loadCamera('alpha')).toBeNull()
  })

  it('clamps a zoom that would be unusable', () => {
    localStorage.setItem('tuval:camera:alpha', '{"x":0,"y":0,"z":9999}')
    expect(loadCamera('alpha')!.z).toBeLessThan(9999)
  })

  it('does not write on every move', () => {
    vi.useFakeTimers()
    const spy = vi.spyOn(Storage.prototype, 'setItem')
    for (let i = 0; i < 20; i++) saveCamera('alpha', { x: i, y: 0, z: 1 })
    expect(spy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(500)
    expect(spy).toHaveBeenCalledTimes(1)
    spy.mockRestore()
    vi.useRealTimers()
  })
})
