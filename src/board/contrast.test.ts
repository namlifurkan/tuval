import { describe, expect, it } from 'vitest'
import { COLOR, GUIDE, isDarkSurface, PIGMENTS, SURFACES } from './brand'
import { STATUS_TONE } from './issues'
import { CHROME } from './render'

const TEXT = 4.5
const LARGE = 3

const channel = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)

function luminance(hex: string) {
  const n = parseInt(hex.slice(1), 16)
  const r = channel(((n >> 16) & 255) / 255)
  const g = channel(((n >> 8) & 255) / 255)
  const b = channel((n & 255) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrast(fg: string, bg: string) {
  const a = luminance(fg)
  const b = luminance(bg)
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
}

const BACKDROPS = {
  paper: COLOR.paper,
  surface: COLOR.surface,
  tint: COLOR.tint,
  shade: COLOR.shade,
  wash: COLOR.wash,
  pigmentWash: COLOR.pigmentWash,
}

const LIGHT_SURFACES = SURFACES.filter((s) => !isDarkSurface(s.color))
const DARK_SURFACES = SURFACES.filter((s) => isDarkSurface(s.color))

describe('contrast helper', () => {
  it('agrees with the WCAG anchors', () => {
    expect(contrast('#FFFFFF', '#000000')).toBeCloseTo(21, 5)
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5)
    expect(contrast(COLOR.ink, COLOR.ink)).toBeCloseTo(1, 5)
  })
})

describe('shell text on shell backgrounds', () => {
  for (const name of ['ink', 'inkSoft', 'muted', 'pigment'] as const) {
    for (const [bg, color] of Object.entries(BACKDROPS)) {
      it(`${name} reads on ${bg}`, () => {
        expect(contrast(COLOR[name], color)).toBeGreaterThanOrEqual(TEXT)
      })
    }
  }

  it('paper reads on the primary button', () => {
    expect(contrast(COLOR.paper, COLOR.pigment)).toBeGreaterThanOrEqual(TEXT)
    expect(contrast(COLOR.paper, COLOR.pigmentHover)).toBeGreaterThanOrEqual(TEXT)
  })
})

describe('canvas chrome on every board surface', () => {
  for (const s of LIGHT_SURFACES) {
    it(`frame titles read on ${s.name}`, () => {
      expect(contrast(CHROME.light.label, s.color)).toBeGreaterThanOrEqual(TEXT)
      expect(contrast(CHROME.light.ink, s.color)).toBeGreaterThanOrEqual(TEXT)
    })

    it(`the guide line reads on ${s.name}`, () => {
      expect(contrast(CHROME.light.guide, s.color)).toBeGreaterThanOrEqual(LARGE)
    })
  }

  for (const s of DARK_SURFACES) {
    it(`frame titles read on ${s.name}`, () => {
      expect(contrast(CHROME.dark.label, s.color)).toBeGreaterThanOrEqual(TEXT)
      expect(contrast(CHROME.dark.ink, s.color)).toBeGreaterThanOrEqual(TEXT)
    })

    it(`the guide line reads on ${s.name}`, () => {
      expect(contrast(CHROME.dark.guide, s.color)).toBeGreaterThanOrEqual(LARGE)
    })
  }
})

describe('canvas items the shell paints', () => {
  it('the embed placeholder title reads on its own wash', () => {
    expect(contrast(COLOR.muted, COLOR.wash)).toBeGreaterThanOrEqual(TEXT)
  })

  it('the record status word reads on both card fills', () => {
    expect(contrast(COLOR.muted, COLOR.surface)).toBeGreaterThanOrEqual(TEXT)
    expect(contrast(COLOR.muted, COLOR.paper)).toBeGreaterThanOrEqual(TEXT)
  })

  it('the comment pin initial reads on an unclaimed pin', () => {
    expect(contrast(COLOR.surface, COLOR.muted)).toBeGreaterThanOrEqual(TEXT)
  })

  it('a default connector stays visible on every light surface', () => {
    for (const s of LIGHT_SURFACES) {
      expect(contrast(COLOR.muted, s.color)).toBeGreaterThanOrEqual(LARGE)
    }
  })
})

describe('what this file deliberately does not measure', () => {
  it('leaves the drawing palette out: graphite is a pigment, not shell text', () => {
    const measured = [
      ...Object.values(COLOR),
      CHROME.light.label,
      CHROME.dark.label,
      CHROME.light.ink,
      CHROME.dark.ink,
    ]
    expect(measured).not.toContain(PIGMENTS.graphite)
  })

  it('leaves status tones out: every one of them is captioned by its own word', () => {
    expect(Object.keys(STATUS_TONE).length).toBeGreaterThan(0)
    for (const tone of Object.values(STATUS_TONE)) expect(tone).toMatch(/^#[0-9A-F]{6}$/i)
  })

  it('leaves identity colours out: the guide is a person, not a shell token', () => {
    expect(Object.values(COLOR)).not.toContain(GUIDE.color)
  })
})
