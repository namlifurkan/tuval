import { supabase } from './supabase'

export const BUCKET = 'board-images'

const SIGNED_FOR = 60 * 60
// Re-sign a little before the hour is up, so a link never expires mid-load.
const REFRESH_AFTER = (SIGNED_FOR - 120) * 1000

const cache = new Map<string, { url: string; at: number }>()

// An item may hold a bare storage path, a public URL from before the bucket was closed, or a
// signed URL from an earlier session. All three name the same object.
export function storagePath(src: string): string | null {
  if (!src || src.startsWith('data:')) return null
  const hosted = new RegExp(`/storage/v1/object/(?:public|sign)/${BUCKET}/([^?]+)`).exec(src)
  if (hosted) return decodeURIComponent(hosted[1])
  if (/^https?:/.test(src)) return null
  return src.replace(/^\/+/, '')
}

export async function signedUrl(path: string): Promise<string | null> {
  const known = cache.get(path)
  if (known && Date.now() - known.at < REFRESH_AFTER) return known.url

  const { data, error } = await supabase?.storage.from(BUCKET)
    .createSignedUrl(path, SIGNED_FOR) ?? { data: null, error: true }
  if (error || !data?.signedUrl) return null

  cache.set(path, { url: data.signedUrl, at: Date.now() })
  return data.signedUrl
}
