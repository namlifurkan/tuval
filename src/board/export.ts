import { boxOf, render } from './render'
import type { Session } from './store'
import type { Item } from './types'

const BLANK: Session = {
  preview: new Map(),
  badge: null,
  spacing: [],
  dropFrame: null,
  marquee: null,
  guides: [],
  draft: null,
  connectorDraft: null,
  anchorsFor: null,
  remote: [],
  spaceDown: false,
  cursor: 'default',
}

export function renderToCanvas(items: Item[], scale = 2, padding = 40): HTMLCanvasElement | null {
  if (!items.length) return null
  const box = boxOf(items)
  const w = Math.ceil((box.w + padding * 2) * scale)
  const h = Math.ceil((box.h + padding * 2) * scale)
  if (w < 1 || h < 1 || w * h > 64e6) return null

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  render({
    ctx,
    dpr: scale,
    cam: { x: box.x - padding, y: box.y - padding, z: 1 },
    width: w / scale,
    height: h / scale,
    items,
    selection: new Set(),
    hover: null,
    editing: null,
    editingCell: null,
    session: BLANK,
    showGrid: false,
    showAnchors: false,
  })
  return canvas
}

export function exportPng(items: Item[], name = 'board', scale = 2) {
  const canvas = renderToCanvas(items, scale)
  if (!canvas) return
  canvas.toBlob((blob) => {
    if (!blob) return
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${name}.png`
    a.click()
    URL.revokeObjectURL(url)
  }, 'image/png')
}

export async function copyPngToClipboard(items: Item[], scale = 2) {
  const canvas = renderToCanvas(items, scale)
  if (!canvas || !navigator.clipboard?.write) return false
  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
  if (!blob) return false
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
  return true
}
