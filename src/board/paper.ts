import { isDarkSurface } from './brand'
import type { Camera } from './camera'

const TILE = 128
const cache = new Map<boolean, CanvasPattern | null>()

function pattern(ctx: CanvasRenderingContext2D, dark: boolean) {
  const hit = cache.get(dark)
  if (hit !== undefined) return hit
  const grain = document.createElement('canvas')
  grain.width = grain.height = TILE / 2
  const g = grain.getContext('2d')
  const tile = document.createElement('canvas')
  tile.width = tile.height = TILE
  const t = tile.getContext('2d')
  if (!g || !t) return null

  const level = dark ? 255 : 20
  const peak = dark ? 26 : 34
  const img = g.createImageData(TILE / 2, TILE / 2)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random()
    img.data[i] = img.data[i + 1] = img.data[i + 2] = level
    img.data[i + 3] = n < 0.62 ? 0 : Math.round((n - 0.62) * peak)
  }
  g.putImageData(img, 0, 0)
  t.imageSmoothingEnabled = true
  t.drawImage(grain, 0, 0, TILE, TILE)

  const made = ctx.createPattern(tile, 'repeat')
  cache.set(dark, made)
  return made
}

export function drawPaper(
  ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number, surface: string,
) {
  ctx.fillStyle = surface
  ctx.fillRect(0, 0, width, height)
  const p = pattern(ctx, isDarkSurface(surface))
  if (!p) return
  ctx.save()
  ctx.translate(-((cam.x * cam.z) % TILE), -((cam.y * cam.z) % TILE))
  ctx.fillStyle = p
  ctx.fillRect(-TILE, -TILE, width + TILE * 2, height + TILE * 2)
  ctx.restore()
}
