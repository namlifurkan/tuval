import { artifactSurface } from './artifacts'
import { aabb, union } from './geometry'
import type { Item } from './types'

export const THUMB_W = 384
export const THUMB_H = 240

const tone = (item: Item) =>
  item.type === 'sticky' ? item.fill
    : item.type === 'frame' ? '#EAE6DD'
      : item.type === 'shape' ? (item.fill === 'transparent' ? '#D8D5CD' : item.fill)
        : item.type === 'image' ? '#C6C2B6'
          : item.type === 'code' ? '#4A463E'
            : '#C6C2B6'

// One drawing routine behind both the minimap and the board thumbnails: filled rectangles in
// each item's own tone. A board is recognisable by its colour blocks long before its text.
export function paintThumb(
  ctx: CanvasRenderingContext2D, items: Item[], w: number, h: number, surface: string,
) {
  ctx.fillStyle = surface
  ctx.fillRect(0, 0, w, h)
  if (!items.length) return

  const world = union(items.map(aabb))
  if (!world.w || !world.h) return
  const pad = Math.max(world.w, world.h) * 0.05 + 24
  const scale = Math.min((w - 8) / (world.w + pad * 2), (h - 8) / (world.h + pad * 2))
  const ox = 4 + (w - 8 - world.w * scale) / 2 - world.x * scale
  const oy = 4 + (h - 8 - world.h * scale) / 2 - world.y * scale

  const frames = items.filter((i) => i.type === 'frame')
  const rest = items.filter((i) => i.type !== 'frame' && i.type !== 'connector')

  for (const item of [...frames, ...rest]) {
    const r = aabb(item)
    ctx.fillStyle = tone(item)
    ctx.globalAlpha = item.type === 'frame' ? 1 : 0.95
    ctx.fillRect(
      ox + r.x * scale, oy + r.y * scale,
      Math.max(2, r.w * scale), Math.max(2, r.h * scale),
    )
  }
  ctx.globalAlpha = 1
}

// A board writes its own thumbnail while it is open, so the board list never has to load and
// decode somebody else's document just to draw a preview.
export function makeThumb(items: Item[], surface = artifactSurface()): string {
  const canvas = document.createElement('canvas')
  canvas.width = THUMB_W
  canvas.height = THUMB_H
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''
  paintThumb(ctx, items, THUMB_W, THUMB_H, surface)
  return canvas.toDataURL('image/webp', 0.7)
}
