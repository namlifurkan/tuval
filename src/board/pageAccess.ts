import { nanoid } from 'nanoid'
import { patchRecord } from './records'
import type { Record as Row } from './records'
import { supabase } from './supabase'

export type PageRole = 'editor' | 'viewer' | 'blocked'

export interface PageMember { userId: string; email: string; role: PageRole }

// A slug rather than the id, so a published address can be read out loud and does not hand the
// internal id of a row to anybody who is sent the link.
const slug = (title: string) =>
  `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'page'}-${nanoid(6)}`

export const publicUrl = (record: Row) =>
  record.public_slug ? `${location.origin}/p/${record.public_slug}` : ''

export async function publish(record: Row) {
  await patchRecord(record.id, {
    published_at: new Date().toISOString(),
    public_slug: record.public_slug || slug(record.title),
  })
}

// The slug is kept rather than cleared: republishing later should give back the same address,
// because the old one is in somebody's message by now.
export const unpublish = (record: Row) =>
  patchRecord(record.id, { published_at: null })

// A link handed to somebody outside the company usually has a reason that ends. Giving it an end
// when it is handed over is the only moment anybody is thinking about it; the database closes it
// afterwards whether or not anyone remembers.
export const DAYS_OPEN = [7, 30, 90] as const

export const openUntil = (record: Row, days: number | null) =>
  patchRecord(record.id, {
    public_until: days ? new Date(Date.now() + days * 86400_000).toISOString() : null,
  })

export const daysLeft = (record: Row) =>
  (record.public_until
    ? Math.max(0, Math.ceil((Date.parse(record.public_until) - Date.now()) / 86400_000))
    : null)

export async function pageMembers(record: string): Promise<PageMember[]> {
  if (!supabase) return []
  const { data } = await supabase
    .from('record_members').select('user_id, email, role').eq('record_id', record)
  return ((data ?? []) as { user_id: string; email: string | null; role: PageRole }[])
    .map((m) => ({ userId: m.user_id, email: m.email ?? '', role: m.role }))
}

export async function setPageMember(record: string, userId: string, email: string, role: PageRole) {
  if (!supabase) return
  await supabase.from('record_members')
    .upsert({ record_id: record, user_id: userId, email, role }, { onConflict: 'record_id, user_id' })
}

export async function removePageMember(record: string, userId: string) {
  if (!supabase) return
  await supabase.from('record_members').delete().eq('record_id', record).eq('user_id', userId)
}

// Reading a published page needs no account, so this asks without one rather than through the
// signed-in client — a link sent to somebody outside the company has to work.
export async function readPublished(slugged: string): Promise<Row | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('records')
    .select('id, kind, title, icon, cover, updated_at')
    .eq('public_slug', slugged)
    .not('published_at', 'is', null)
    .maybeSingle()
  return (data as Row) ?? null
}
