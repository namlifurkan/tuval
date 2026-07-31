import { getUser, supabase } from './supabase'

export const AVATARS = 'avatars'
const MAX_EDGE = 256

export const profileName = () => {
  const meta = getUser()?.user_metadata as Record<string, string> | undefined
  return meta?.display_name?.trim() || ''
}

export const avatarUrl = () => {
  const meta = getUser()?.user_metadata as Record<string, string> | undefined
  return meta?.avatar_url || ''
}

export async function setProfile(patch: { display_name?: string; avatar_url?: string }) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.updateUser({ data: patch })
  if (error) throw error
}

// A face on a chip is never larger than a chip, so it is squared and cut down before it is
// uploaded rather than a phone photograph being served to everyone on the board.
export async function uploadAvatar(file: File): Promise<string> {
  const user = getUser()
  if (!supabase || !user) throw new Error('Not signed in')

  const bitmap = await createImageBitmap(file)
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = MAX_EDGE
  canvas.height = MAX_EDGE
  canvas.getContext('2d')?.drawImage(
    bitmap,
    (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side,
    0, 0, MAX_EDGE, MAX_EDGE,
  )
  bitmap.close()

  const blob = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/webp', 0.85))
  if (!blob) throw new Error('Could not read that image')

  const path = `${user.id}/${crypto.randomUUID()}.webp`
  const { error } = await supabase.storage.from(AVATARS)
    .upload(path, blob, { contentType: 'image/webp', upsert: false })
  if (error) throw error

  return supabase.storage.from(AVATARS).getPublicUrl(path).data.publicUrl
}
