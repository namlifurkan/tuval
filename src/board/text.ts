import type { TextStyle } from './types'

const measureCtx = document.createElement('canvas').getContext('2d')!
const cache = new Map<string, LayoutLine[]>()

export const LINE_HEIGHT = 1.28
export const URL_RE = /\b(?:https?:\/\/|www\.)[^\s<>()]+[^\s<>().,;:!?]/gi

export interface LayoutLine {
  text: string
  marker: string | null
  indent: number
}

export interface LayoutText {
  lines: LayoutLine[]
  fontSize: number
  lineHeight: number
}

export function fontString(style: Pick<TextStyle, 'bold' | 'italic' | 'fontFamily'>, size: number) {
  return `${style.italic ? 'italic ' : ''}${style.bold ? 700 : 400} ${size}px "${style.fontFamily}", "Instrument Sans", system-ui, sans-serif`
}

export function measureWidth(text: string, font: string) {
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

function parseMarker(paragraph: string): { marker: string | null; body: string } {
  const bullet = paragraph.match(/^(\s*)[-*•]\s+(.*)$/)
  if (bullet) return { marker: '•', body: bullet[2] }
  const numbered = paragraph.match(/^(\s*)(\d+)[.)]\s+(.*)$/)
  if (numbered) return { marker: `${numbered[2]}.`, body: numbered[3] }
  return { marker: null, body: paragraph }
}

function wrapBody(body: string, maxWidth: number): string[] {
  const out: string[] = []
  let line = ''
  for (const word of body.split(' ')) {
    const next = line ? `${line} ${word}` : word
    if (measureCtx.measureText(next).width <= maxWidth) { line = next; continue }
    if (!line) {
      let chunk = ''
      for (const ch of word) {
        if (measureCtx.measureText(chunk + ch).width > maxWidth && chunk) { out.push(chunk); chunk = ch }
        else chunk += ch
      }
      line = chunk
      continue
    }
    out.push(line)
    line = word
  }
  out.push(line)
  return out
}

export function layoutLines(text: string, maxWidth: number, font: string, fontSize: number): LayoutLine[] {
  const key = `${font}|${maxWidth.toFixed(1)}|${text}`
  const hit = cache.get(key)
  if (hit) return hit
  measureCtx.font = font
  const out: LayoutLine[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph) { out.push({ text: '', marker: null, indent: 0 }); continue }
    const { marker, body } = parseMarker(paragraph)
    const indent = marker ? Math.max(fontSize * 0.95, measureCtx.measureText(`${marker} `).width) : 0
    const wrapped = wrapBody(body, Math.max(8, maxWidth - indent))
    wrapped.forEach((line, i) => out.push({ text: line, marker: i === 0 ? marker : null, indent }))
  }
  if (cache.size > 4000) cache.clear()
  cache.set(key, out)
  return out
}

export function wrapText(text: string, maxWidth: number, font: string): string[] {
  return layoutLines(text, maxWidth, font, 16).map((l) => l.text)
}

export function layoutText(
  text: string, boxW: number, boxH: number, style: TextStyle, minSize = 8,
): LayoutText {
  if (!style.autoFit) {
    const lines = layoutLines(text, boxW, fontString(style, style.fontSize), style.fontSize)
    return { lines, fontSize: style.fontSize, lineHeight: style.fontSize * LINE_HEIGHT }
  }
  let lo = minSize, hi = Math.max(minSize, Math.min(style.fontSize, boxH))
  let best: LayoutText = {
    lines: layoutLines(text, boxW, fontString(style, lo), lo),
    fontSize: lo,
    lineHeight: lo * LINE_HEIGHT,
  }
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2)
    const lines = layoutLines(text, boxW, fontString(style, mid), mid)
    if (lines.length * mid * LINE_HEIGHT <= boxH) {
      best = { lines, fontSize: mid, lineHeight: mid * LINE_HEIGHT }
      lo = mid + 1
    } else hi = mid - 1
  }
  return best
}

export function textHeight(text: string, boxW: number, style: TextStyle) {
  const lines = layoutLines(text || ' ', boxW, fontString(style, style.fontSize), style.fontSize)
  return lines.length * style.fontSize * LINE_HEIGHT
}

export function firstUrl(text: string): string | null {
  const match = text.match(URL_RE)
  if (!match) return null
  return match[0].startsWith('www.') ? `https://${match[0]}` : match[0]
}
