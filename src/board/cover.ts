import { supabase } from './supabase'
import { getWorkspace } from './workspace'

export const COVERS = 'covers'

// Wide enough to stay sharp on a large screen, small enough that opening a page is not waiting
// for a phone photograph. A cover is decoration, not the document.
const MAX_WIDTH = 1600
const RATIO = 1600 / 420

export async function uploadCover(record: string, file: File): Promise<string> {
  const ws = getWorkspace()
  if (!supabase || !ws) throw new Error('Not signed in')

  const bitmap = await createImageBitmap(file)
  // Cropped to the band it is shown in rather than squashed into it, taking the middle, which
  // is where the picture is.
  const width = Math.min(bitmap.width, MAX_WIDTH)
  const height = Math.round(width / RATIO)
  const cut = Math.min(bitmap.height, bitmap.width / RATIO)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  canvas.getContext('2d')?.drawImage(
    bitmap,
    0, (bitmap.height - cut) / 2, bitmap.width, cut,
    0, 0, width, height,
  )
  bitmap.close()

  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.82))
  if (!blob) throw new Error('Could not read that image')

  const path = `${ws.id}/${record}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(COVERS)
    .upload(path, blob, { contentType: 'image/webp', upsert: false })
  if (error) throw error
  return path
}

// The bucket is private, so what is stored is the path and what is rendered is a link that
// expires. Kept until it nearly does, because a page redrawn on every keystroke should not ask
// for a new one each time.
const links = new Map<string, { url: string; until: number }>()
const LIFE = 3600

export async function coverUrl(path: string): Promise<string> {
  if (!path || !supabase) return ''
  const held = links.get(path)
  if (held && held.until > Date.now()) return held.url

  const { data } = await supabase.storage.from(COVERS).createSignedUrl(path, LIFE)
  const url = data?.signedUrl ?? ''
  if (url) links.set(path, { url, until: Date.now() + (LIFE - 120) * 1000 })
  return url
}

export async function removeCover(path: string) {
  if (!path || !supabase) return
  links.delete(path)
  await supabase.storage.from(COVERS).remove([path])
}
