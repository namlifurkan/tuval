import { describe, expect, it } from 'vitest'
import { labelColor, labelFontSize, labelHeight, labelInk, STATUS_LABELS } from './labels'

describe('status labels', () => {
  it('scales with the sticky when no size is pinned', () => {
    expect(labelFontSize(228, 228)).toBeCloseTo(228 * 0.115 * 0.58, 5)
    expect(labelFontSize(400, 900)).toBeCloseTo(400 * 0.115 * 0.58, 5)
  })

  it('never goes below a readable floor', () => {
    expect(labelFontSize(40, 40)).toBeCloseTo(16 * 0.58, 5)
  })

  it('honours a pinned size', () => {
    expect(labelFontSize(228, 228, 32)).toBe(32)
    expect(labelHeight(228, 228, 32)).toBeCloseTo(32 / 0.58, 5)
  })

  it('gives every preset a colour', () => {
    for (const l of STATUS_LABELS) expect(labelColor(l.id)).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('picks readable ink for dark and light chips', () => {
    expect(labelInk('#1F1D1A')).toBe('#FCFBF8')
    expect(labelInk('#F0E3B0')).toBe('#141310')
  })
})
