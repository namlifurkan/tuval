import { supabase } from './supabase'
import { getWorkspace } from './workspace'
import { t } from '../i18n'

export const ATTACHMENTS = 'attachments'

// The bucket refuses anything larger; asking here as well means the person is told why rather
// than watching an upload fail.
export const MAX_BYTES = 25 * 1024 * 1024

// What is stored on the row: the path to find it by and the name it arrived with, because a
// path made of a random id tells a reader nothing.
export interface Attachment { path: string; name: string; size: number }

export function attachmentsOf(value: unknown): Attachment[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is Attachment =>
    !!v && typeof v === 'object' && typeof (v as Attachment).path === 'string')
}

export async function uploadAttachment(record: string, file: File): Promise<Attachment> {
  const ws = getWorkspace()
  if (!supabase || !ws) throw new Error('Not signed in')
  if (file.size > MAX_BYTES) throw new Error('too big')

  // The extension is kept so that a browser opening the link knows what it has.
  const dot = file.name.lastIndexOf('.')
  const suffix = dot > 0 ? file.name.slice(dot).toLowerCase() : ''
  const path = `${ws.id}/${record}/${crypto.randomUUID()}${suffix}`

  const { error } = await supabase.storage.from(ATTACHMENTS)
    .upload(path, file, { contentType: file.type || 'application/octet-stream', upsert: false })
  if (error) {
    // The plan limit arrives as a database exception. What it means is one thing, said once.
    if (/storage limit/i.test(error.message)) {
      throw new Error(t('This workspace has no room for more files. Remove some, or move to the paid plan.'))
    }
    throw error
  }
  return { path, name: file.name, size: file.size }
}

// The bucket is private, so what is stored is the path and what is opened is a link that
// expires. Kept until it nearly does, because a table redrawn on every keystroke should not ask
// for a new one each time.
const links = new Map<string, { url: string; until: number }>()
const LIFE = 3600

export async function attachmentUrl(path: string): Promise<string> {
  if (!path || !supabase) return ''
  const held = links.get(path)
  if (held && held.until > Date.now()) return held.url

  const { data } = await supabase.storage.from(ATTACHMENTS).createSignedUrl(path, LIFE)
  const url = data?.signedUrl ?? ''
  if (url) links.set(path, { url, until: Date.now() + (LIFE - 120) * 1000 })
  return url
}

export async function removeAttachment(path: string) {
  if (!path || !supabase) return
  links.delete(path)
  await supabase.storage.from(ATTACHMENTS).remove([path])
}

export const readableSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`
