import { uploadImage } from './cloud'
import { createItems, room } from './doc'
import { makeImage } from './items'
import { requestRender, useBoardStore } from './store'
import { getUser } from './supabase'
import type { Vec } from './types'
import { t } from '../i18n'

const MAX_EDGE = 1600
const KEEP_ORIGINAL_BYTES = 400_000
const PLACED_EDGE = 600

// Signed in, an image goes to object storage and the item keeps a URL. Without a backend it
// stays inline as a data URL, so it is downscaled first: every byte would otherwise replicate
// to every peer and sit in IndexedDB, in each version snapshot and in every realtime message.
export async function encodeImage(file: File) {
  const bitmap = await createImageBitmap(file)
  const longest = Math.max(bitmap.width, bitmap.height)

  if (file.size <= KEEP_ORIGINAL_BYTES && longest <= MAX_EDGE) {
    const src = await new Promise<string>((done) => {
      const reader = new FileReader()
      reader.onload = () => done(reader.result as string)
      reader.readAsDataURL(file)
    })
    const out = { src, width: bitmap.width, height: bitmap.height, blob: file as Blob }
    bitmap.close()
    return out
  }

  const scale = Math.min(1, MAX_EDGE / longest)
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.82))
  return { src: canvas.toDataURL('image/webp', 0.82), width, height, blob }
}

export async function hostImage(src: string, blob: Blob | null) {
  if (!blob || !room || !getUser()) return src
  const ext = blob.type.split('/')[1] || 'webp'
  return uploadImage(room, blob, ext)
}

// The single way an image enters a board. Every caller goes through here: a second path that
// skipped the downscale put whole photographs into the document as base64.
export async function addImage(file: File, at: Vec, centred = true) {
  const { src, width, height, blob } = await encodeImage(file)
  const hosted = await hostImage(src, blob)
  if (!hosted) {
    alert(t('Image could not be uploaded. Try again.'))
    return null
  }
  const scale = Math.min(1, PLACED_EDGE / width)
  const w = width * scale
  const h = height * scale
  const item = makeImage(centred ? at.x - w / 2 : at.x, centred ? at.y - h / 2 : at.y, w, h, hosted)
  item.naturalW = width
  item.naturalH = height
  createItems([item])
  useBoardStore.getState().setSelection([item.id])
  requestRender()
  return item
}
