import { getUser, supabase } from './supabase'
import type { BoardEntry } from './boards'

export interface CloudBoard extends BoardEntry {
  owned: boolean
}

const table = () => supabase?.from('boards')

export async function listCloudBoards(): Promise<CloudBoard[]> {
  const user = getUser()
  if (!supabase || !user) return []
  const { data, error } = await supabase
    .from('boards')
    .select('id, name, owner, updated_at, board_snapshots(items, frames)')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => {
    const snap = (row.board_snapshots as { items: number; frames: number }[] | null)?.[0]
    return {
      room: row.id as string,
      name: (row.name as string) ?? '',
      opened: Date.parse(row.updated_at as string) || 0,
      items: snap?.items ?? 0,
      frames: snap?.frames ?? 0,
      owned: row.owner === user.id,
    }
  })
}

// Never re-send owner on an existing row: a board shared with you belongs to someone else,
// and an upsert would try to take it over and be refused by the update policy.
export async function claimBoard(room: string, name: string): Promise<string | null> {
  const user = getUser()
  if (!supabase || !user) return null

  const touch = await supabase
    .from('boards')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', room)
    .select('id')
  if (touch.data?.length) return null
  if (touch.error) return touch.error.message

  const created = await supabase
    .from('boards')
    .insert({ id: room, owner: user.id, name })
  return created.error ? created.error.message : null
}

export async function renameCloudBoard(room: string, name: string) {
  if (!supabase || !getUser()) return
  await table()?.update({ name, updated_at: new Date().toISOString() }).eq('id', room)
}

export async function deleteCloudBoard(room: string) {
  if (!supabase || !getUser()) return
  await table()?.delete().eq('id', room)
}

export async function pushSnapshot(
  room: string, doc: Uint8Array, items: number, frames: number,
): Promise<string | null> {
  if (!supabase || !getUser()) return null
  const { error } = await supabase.from('board_snapshots').upsert({
    board_id: room,
    doc: `\\x${[...doc].map((b) => b.toString(16).padStart(2, '0')).join('')}`,
    items,
    frames,
    updated_at: new Date().toISOString(),
  })
  return error ? error.message : null
}

const HEX = /^\\x/

export async function pullSnapshot(room: string): Promise<Uint8Array | null> {
  if (!supabase || !getUser()) return null
  const { data, error } = await supabase
    .from('board_snapshots')
    .select('doc')
    .eq('board_id', room)
    .maybeSingle()
  if (error || !data?.doc) return null
  const raw = data.doc as string
  if (!HEX.test(raw)) return null
  const body = raw.slice(2)
  const out = new Uint8Array(body.length / 2)
  for (let i = 0; i < out.length; i++) out[i] = parseInt(body.slice(i * 2, i * 2 + 2), 16)
  return out
}

export async function uploadImage(room: string, blob: Blob, ext: string): Promise<string | null> {
  if (!supabase || !getUser()) return null
  const path = `${room}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from('board-images').upload(path, blob, {
    contentType: blob.type || 'image/webp',
    upsert: false,
  })
  if (error) return null
  return supabase.storage.from('board-images').getPublicUrl(path).data.publicUrl
}

export interface Member {
  userId: string
  email: string
  role: 'editor' | 'viewer'
  owner: boolean
}

export interface Invite {
  email: string
  role: 'editor' | 'viewer'
}

export async function claimInvites() {
  if (!supabase || !getUser()) return
  await supabase.rpc('claim_invites')
}

export async function listMembers(room: string): Promise<Member[]> {
  const user = getUser()
  if (!supabase || !user) return []
  const board = await supabase.from('boards').select('owner').eq('id', room).maybeSingle()
  const rows = await supabase.from('board_members').select('user_id, email, role').eq('board_id', room)
  const ownerId = board.data?.owner as string | undefined
  const out: Member[] = (rows.data ?? []).map((r) => ({
    userId: r.user_id as string,
    email: (r.email as string) ?? '',
    role: r.role as 'editor' | 'viewer',
    owner: r.user_id === ownerId,
  }))
  if (ownerId && !out.some((m) => m.userId === ownerId)) {
    out.unshift({
      userId: ownerId,
      email: ownerId === user.id ? (user.email ?? '') : '',
      role: 'editor',
      owner: true,
    })
  }
  return out
}

export async function listInvites(room: string): Promise<Invite[]> {
  if (!supabase || !getUser()) return []
  const { data } = await supabase.from('board_invites').select('email, role').eq('board_id', room)
  return (data ?? []).map((r) => ({ email: r.email as string, role: r.role as 'editor' | 'viewer' }))
}

export async function invite(room: string, email: string, role: 'editor' | 'viewer') {
  const user = getUser()
  if (!supabase || !user) return 'not signed in'
  const { error } = await supabase.from('board_invites').upsert({
    board_id: room, email: email.trim().toLowerCase(), role, invited_by: user.id,
  })
  return error ? error.message : null
}

// Supabase only sends auth mail, so the invite rides on a magic link. The invitee gets a real
// email from the configured SMTP and lands on the board signed in as themselves. Sending it
// does not touch the current session.
export async function mailInvite(email: string, boardUrl: string) {
  if (!supabase) return 'not configured'
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim().toLowerCase(),
    options: { emailRedirectTo: boardUrl, shouldCreateUser: true },
  })
  return error ? error.message : null
}

export async function revokeInvite(room: string, email: string) {
  await supabase?.from('board_invites').delete().eq('board_id', room).eq('email', email)
}

export async function removeMember(room: string, userId: string) {
  await supabase?.from('board_members').delete().eq('board_id', room).eq('user_id', userId)
}

export async function setMemberRole(room: string, userId: string, role: 'editor' | 'viewer') {
  await supabase?.from('board_members').update({ role }).eq('board_id', room).eq('user_id', userId)
}

export async function myRole(room: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const user = getUser()
  if (!supabase || !user) return null
  const board = await supabase.from('boards').select('owner').eq('id', room).maybeSingle()
  if (!board.data) return null
  if (board.data.owner === user.id) return 'owner'
  const mine = await supabase
    .from('board_members').select('role').eq('board_id', room).eq('user_id', user.id).maybeSingle()
  return (mine.data?.role as 'editor' | 'viewer') ?? null
}
