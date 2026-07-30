import { isDarkSurface } from './brand'
import type { Camera } from './camera'
import { toScreen } from './camera'

export const TEXTURES = [
  { id: 'paper', name: 'Paper' },
  { id: 'linen', name: 'Linen' },
  { id: 'ticks', name: 'Registration' },
  { id: 'dots', name: 'Dots' },
  { id: 'grid', name: 'Grid' },
  { id: 'rules', name: 'Ruled' },
  { id: 'none', name: 'Plain' },
] as const

export type TextureId = (typeof TEXTURES)[number]['id']

const TILE = 128
const cache = new Map<string, CanvasPattern | null>()

function noiseTile(dark: boolean) {
  const grain = document.createElement('canvas')
  grain.width = grain.height = TILE / 2
  const g = grain.getContext('2d')!
  const img = g.createImageData(TILE / 2, TILE / 2)
  const level = dark ? 255 : 20
  const peak = dark ? 26 : 34
  for (let i = 0; i < img.data.length; i += 4) {
    const n = Math.random()
    img.data[i] = img.data[i + 1] = img.data[i + 2] = level
    img.data[i + 3] = n < 0.62 ? 0 : Math.round((n - 0.62) * peak)
  }
  g.putImageData(img, 0, 0)

  const tile = document.createElement('canvas')
  tile.width = tile.height = TILE
  const t = tile.getContext('2d')!
  t.imageSmoothingEnabled = true
  t.drawImage(grain, 0, 0, TILE, TILE)
  return tile
}

function linenTile(dark: boolean) {
  const tile = document.createElement('canvas')
  tile.width = tile.height = 8
  const t = tile.getContext('2d')!
  const line = dark ? 'rgba(252,251,248,0.075)' : 'rgba(20,19,16,0.06)'
  t.strokeStyle = line
  t.lineWidth = 1
  for (let i = 1.5; i < 8; i += 4) {
    t.beginPath()
    t.moveTo(0, i)
    t.lineTo(8, i)
    t.moveTo(i + 2, 0)
    t.lineTo(i + 2, 8)
    t.stroke()
  }
  return tile
}

function pattern(ctx: CanvasRenderingContext2D, texture: TextureId, dark: boolean) {
  const key = `${texture}:${dark}`
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const tile = texture === 'linen' ? linenTile(dark) : noiseTile(dark)
  const made = ctx.createPattern(tile, 'repeat')
  cache.set(key, made)
  return made
}

function drawWeave(
  ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number,
  texture: TextureId, dark: boolean,
) {
  const p = pattern(ctx, texture, dark)
  if (!p) return
  const span = texture === 'linen' ? 8 : TILE
  ctx.save()
  ctx.translate(-((cam.x * cam.z) % span), -((cam.y * cam.z) % span))
  ctx.fillStyle = p
  ctx.fillRect(-span, -span, width + span * 2, height + span * 2)
  ctx.restore()
}

function drawRuled(
  ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number,
  texture: TextureId, dark: boolean,
) {
  let step = 25
  while (step * cam.z < 16) step *= 4
  const start = toScreen(cam, Math.floor(cam.x / step) * step, Math.floor(cam.y / step) * step)
  const gap = step * cam.z
  const alpha = Math.min(1, (gap - 12) / 18)
  if (alpha <= 0) return

  const marks = new Path2D()
  if (texture === 'ticks') {
    const arm = Math.min(3, 1.6 + gap / 40)
    for (let x = start.x; x < width + gap; x += gap) {
      for (let y = start.y; y < height + gap; y += gap) {
        marks.moveTo(x - arm, y)
        marks.lineTo(x + arm, y)
        marks.moveTo(x, y - arm)
        marks.lineTo(x, y + arm)
      }
    }
  } else if (texture === 'dots') {
    const r = Math.min(1.5, 0.7 + gap / 90)
    for (let x = start.x; x < width + gap; x += gap) {
      for (let y = start.y; y < height + gap; y += gap) {
        marks.moveTo(x + r, y)
        marks.arc(x, y, r, 0, Math.PI * 2)
      }
    }
  } else {
    for (let y = start.y; y < height + gap; y += gap) {
      marks.moveTo(0, y)
      marks.lineTo(width, y)
    }
    if (texture === 'grid') {
      for (let x = start.x; x < width + gap; x += gap) {
        marks.moveTo(x, 0)
        marks.lineTo(x, height)
      }
    }
  }

  const weight = texture === 'ticks' ? 0.2 : texture === 'dots' ? 0.26 : 0.13
  ctx.strokeStyle = dark
    ? `rgba(252, 251, 248, ${weight * 1.1 * alpha})`
    : `rgba(20, 19, 16, ${weight * alpha})`
  ctx.fillStyle = ctx.strokeStyle
  ctx.lineWidth = 1
  ctx.lineCap = 'butt'
  if (texture === 'dots') ctx.fill(marks)
  else ctx.stroke(marks)
}

export function drawPaper(
  ctx: CanvasRenderingContext2D, cam: Camera, width: number, height: number,
  surface: string, texture: TextureId,
) {
  ctx.fillStyle = surface
  ctx.fillRect(0, 0, width, height)
  if (texture === 'none') return
  const dark = isDarkSurface(surface)
  if (texture === 'paper' || texture === 'linen') drawWeave(ctx, cam, width, height, texture, dark)
  else drawRuled(ctx, cam, width, height, texture, dark)
}
