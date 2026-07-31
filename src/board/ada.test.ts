import { beforeEach, describe, expect, it } from 'vitest'
import { TIPS } from './ada'

const pick = (f: { items: number; connectors: number; frames: number; signedIn: boolean }) =>
  TIPS.find((t) => t.when(f))?.id ?? null

beforeEach(() => localStorage.clear())

describe('guide rules', () => {
  it('starts with the empty board', () => {
    expect(pick({ items: 0, connectors: 0, frames: 0, signedIn: false })).toBe('first')
  })

  it('asks for a connector once two items exist', () => {
    expect(pick({ items: 2, connectors: 0, frames: 0, signedIn: false })).toBe('connect')
  })

  it('stays quiet when the board is already connected', () => {
    expect(pick({ items: 3, connectors: 2, frames: 0, signedIn: false })).toBe(null)
  })

  it('suggests a frame on a crowded board', () => {
    expect(pick({ items: 6, connectors: 1, frames: 0, signedIn: false })).toBe('frame')
  })

  it('offers handoff once a frame exists', () => {
    expect(pick({ items: 6, connectors: 1, frames: 1, signedIn: false })).toBe('handoff')
  })

  it('every tip has a distinct id and an anchor', () => {
    expect(new Set(TIPS.map((t) => t.id)).size).toBe(TIPS.length)
    expect(TIPS.every((t) => !!(t.anchor && t.title && t.body))).toBe(true)
  })
})
