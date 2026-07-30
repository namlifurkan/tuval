import { PIGMENTS } from './brand'

// Source language is English; t() resolves the display text.
export const STATUS_LABELS: { id: string; color: string }[] = [
  { id: 'Idea', color: PIGMENTS.naples },
  { id: 'Question', color: PIGMENTS.lavender },
  { id: 'Doing', color: PIGMENTS.cerulean },
  { id: 'Blocked', color: PIGMENTS.terracotta },
  { id: 'Decision', color: PIGMENTS.verdigris },
  { id: 'Done', color: PIGMENTS.olive },
]

export const labelColor = (id: string) =>
  STATUS_LABELS.find((l) => l.id === id)?.color ?? PIGMENTS.stone

export function labelInk(color: string) {
  const n = parseInt(color.slice(1), 16)
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255)
  return lum < 150 ? '#FCFBF8' : '#141310'
}

export const LABEL_SIZES = [10, 12, 14, 18, 24, 32]

// Auto keeps the chip proportional to the sticky; an explicit size pins the type.
export const labelFontSize = (w: number, h: number, size?: number) =>
  size ?? Math.max(16, Math.min(w, h) * 0.115) * 0.58

export const labelHeight = (w: number, h: number, size?: number) =>
  labelFontSize(w, h, size) / 0.58
