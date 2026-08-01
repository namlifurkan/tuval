import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// The door for everything outside. Both halves of it are workspace administration, so both are
// asked for by whoever may write the workspace and by nobody else.

export const apiBase = () =>
  `${(import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''}/functions/v1/api`

export interface Key {
  id: string
  name: string
  hint: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

export interface Hook {
  id: string
  url: string
  secret: string
  kinds: string[]
  active: boolean
  last_fired_at: string | null
  last_status: number | null
}

const KEY_COLUMNS = 'id, name, hint, created_at, last_used_at, revoked_at'
const HOOK_COLUMNS = 'id, url, secret, kinds, active, last_fired_at, last_status'

export async function listKeys(): Promise<Key[]> {
  if (!supabase || !getUser()) return []
  const { data } = await supabase
    .from('api_keys').select(KEY_COLUMNS).order('created_at', { ascending: false })
  return (data ?? []) as Key[]
}

const hex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('')

// The token is made here and hashed here. What reaches the database is the hash, so the row is
// not a working key — which means this is also the only moment the token can ever be shown.
export async function makeKey(name: string): Promise<string | null> {
  const ws = getWorkspace()
  if (!supabase || !ws) return null

  const token = `tuv_${hex(crypto.getRandomValues(new Uint8Array(24)))}`
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))

  const { error } = await supabase.from('api_keys').insert({
    workspace_id: ws.id,
    name: name.trim(),
    hint: `${token.slice(0, 10)}…`,
    token_sha: hex(new Uint8Array(digest)),
    created_by: getUser()?.id ?? null,
  })
  return error ? null : token
}

// Revoked rather than deleted, so a key that turns up in somebody's logs later can still be
// recognised as one of ours and as one we had already stopped trusting.
export async function revokeKey(id: string) {
  if (!supabase) return
  await supabase.from('api_keys').update({ revoked_at: new Date().toISOString() }).eq('id', id)
}

export async function forgetKey(id: string) {
  if (!supabase) return
  await supabase.from('api_keys').delete().eq('id', id)
}

export async function listHooks(): Promise<Hook[]> {
  if (!supabase || !getUser()) return []
  // Asked before reading, so the page shows how the last call actually went rather than only
  // that one was made.
  await supabase.rpc('refresh_webhooks')
  const { data } = await supabase
    .from('webhooks').select(HOOK_COLUMNS).order('created_at', { ascending: false })
  return (data ?? []) as Hook[]
}

export async function addHook(url: string): Promise<string | null> {
  const ws = getWorkspace()
  if (!supabase || !ws) return null
  const { error } = await supabase.from('webhooks').insert({ workspace_id: ws.id, url: url.trim() })
  return error?.message ?? null
}

export async function setHook(id: string, changes: Partial<Hook>) {
  if (!supabase) return
  await supabase.from('webhooks').update(changes).eq('id', id)
}

export async function removeHook(id: string) {
  if (!supabase) return
  await supabase.from('webhooks').delete().eq('id', id)
}
