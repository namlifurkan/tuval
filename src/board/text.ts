import type { TextStyle } from './types'

const measureCtx = document.createElement('canvas').getContext('2d')!
const cache = new Map<string, string[]>()

export const LINE_HEIGHT = 1.28

export function fontString(style: Pick<TextStyle, 'bold' | 'italic' | 'fontFamily'>, size: number) {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${size}px "${style.fontFamily}", "Instrument Sans", system-ui, sans-serif`
}

export function measureWidth(text: string, font: string) {
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

export function wrapText(text: string, maxWidth: number, font: string): string[] {
  const key = `${font}|${maxWidth.toFixed(1)}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  measureCtx.font = font
  const out: string[] = []
  for (const para of text.split('\n')) {
    if (!para) { out.push(''); continue }
    let line = ''
    for (const word of para.split(' ')) {
      const next = line ? `${line} ${word}` : word
      if (measureCtx.measureText(next).width <= maxWidth || !line) {
        if (measureCtx.measureText(next).width > maxWidth && !line) {
          let chunk = ''
          for (const ch of word) {
            if (measureCtx.measureText(chunk + ch).width > maxWidth && chunk) {
              out.push(chunk); chunk = ch
            } else chunk += ch
          }
          line = chunk
        } else line = next
      } else {
        out.push(line); line = word
      }
    }
    out.push(line)
  }
  if (cache.size > 4000) cache.clear()
  cache.set(key, out)
  return out
}

export interface LayoutText { lines: string[]; fontSize: number; lineHeight: number }

export function layoutText(
  text: string, boxW: number, boxH: number, style: TextStyle, minSize = 8,
): LayoutText {
  if (!style.autoFit) {
    const lines = wrapText(text, boxW, fontString(style, style.fontSize))
    return { lines, fontSize: style.fontSize, lineHeight: style.fontSize * LINE_HEIGHT }
  }
  let lo = minSize, hi = Math.max(minSize, Math.min(style.fontSize, boxH))
  let best: LayoutText = { lines: wrapText(text, boxW, fontString(style, lo)), fontSize: lo, lineHeight: lo * LINE_HEIGHT }
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const lines = wrapText(text, boxW, fontString(style, mid))
    if (lines.length * mid * LINE_HEIGHT <= boxH) {
      best = { lines, fontSize: mid, lineHeight: mid * LINE_HEIGHT }
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

export function textHeight(text: string, boxW: number, style: TextStyle) {
  const lines = wrapText(text || ' ', boxW, fontString(style, style.fontSize))
  return lines.length * style.fontSize * LINE_HEIGHT
}
