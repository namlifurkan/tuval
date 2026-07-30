import type { Camera } from './camera'

const TILE = 128
let tooth: CanvasPattern | null = null

function pattern(ctx: CanvasRenderingContext2D) {
  if (tooth) return tooth
  const grain = document.createElement('canvas')
  grain.width = grain.height = TILE / 2
  const g = grain.getContext('2d')
  const tile = document.createElement('canvas')
  tile.width = tile.height = TILE
  const t = tile.getContext('2d')
  if (!g || !t) return null

  const img = g.createImageData(TILE / 2, TILE / 2)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random()
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 20
    img.data[i + 3] = n < 0.62 ? 0 : Math.round((n - 0.62) * 34)
  }
  g.putImageData(img, 0, 0)
  t.imageSmoothingEnabled = true
  t.drawImage(grain, 0, 0, TILE, TILE)

  tooth = ctx.createPattern(tile, 'repeat')
  return tooth
}

export function drawPaper(
  ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number,
) {
  ctx.fillStyle = '#F2EFE9'
  ctx.fillRect(0, 0, width, height)
  const p = pattern(ctx)
  if (!p) return
  ctx.save()
  ctx.translate(-((cam.x * cam.z) % TILE), -((cam.y * cam.z) % TILE))
  ctx.fillStyle = p
  ctx.fillRect(-TILE, -TILE, width + TILE * 2, height + TILE * 2)
  ctx.restore()
}
