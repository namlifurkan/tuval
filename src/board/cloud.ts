import { getUser, supabase } from './supabase'
import { BUCKET } from './storage'
import type { BoardEntry } from './boards'

export interface CloudBoard extends BoardEntry {
  owned: boolean
  deleted?: number
  project?: string | null
}

// Long enough that nobody is coming back for it, short enough that it is not storage nobody
// asked for.
export const TRASH_DAYS = 30

const table = () => supabase?.from('boards')

export interface Snapshot { items: number; frames: number; thumb: string | null }

// board_snapshots.board_id is both the foreign key and the primary key, so PostgREST reads the
// relationship as one-to-one and embeds an object where a plain foreign key would give an
// array. Reading only the array shape left every cloud board looking empty.
export function pickSnapshot(embedded: unknown): Snapshot | null {
  const row = Array.isArray(embedded) ? embedded[0] : embedded
  if (!row || typeof row !== 'object') return null
  const { items, frames, thumb } = row as Partial<Snapshot>
  return { items: items ?? 0, frames: frames ?? 0, thumb: thumb ?? null }
}

export async function listCloudBoards(): Promise<CloudBoard[]> {
  const user = getUser()
  if (!supabase || !user) return []
  const { data, error } = await supabase
    .from('boards')
    .select('id, name, owner, project_id, updated_at, deleted_at, board_snapshots(items, frames, thumb)')
    .order('updated_at', { ascending: false })
  if (error || !data) return []
  return data.map((row) => {
    const snap = pickSnapshot(row.board_snapshots)
    return {
      room: row.id as string,
      name: (row.name as string) ?? '',
      opened: Date.parse(row.updated_at as string) || 0,
      items: snap?.items ?? 0,
      frames: snap?.frames ?? 0,
      thumb: snap?.thumb ?? '',
      owned: row.owner === user.id,
      project: (row.project_id as string | null) ?? null,
      deleted: row.deleted_at ? Date.parse(row.deleted_at as string) : undefined,
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

// Marked, not removed: everything hangs off this row by a cascade, so deleting it is the one
// action on a board that cannot be undone.
export async function trashBoard(room: string) {
  await table()?.update({ deleted_at: new Date().toISOString() }).eq('id', room)
}

export async function restoreBoard(room: string) {
  await table()?.update({ deleted_at: null }).eq('id', room)
}

export async function emptyExpiredTrash(boards: CloudBoard[]) {
  const cutoff = Date.now() - TRASH_DAYS * 24 * 60 * 60 * 1000
  for (const board of boards) {
    if (board.owned && board.deleted && board.deleted < cutoff) await deleteCloudBoard(board.room)
  }
}

export async function deleteCloudBoard(room: string) {
  if (!supabase || !getUser()) return
  // Rows cascade from the board; objects in the bucket do not, so the folder goes first while
  // the policies still recognise the board.
  const { data } = await supabase.storage.from(BUCKET).list(room, { limit: 1000 })
  const names = (data ?? []).map((o) => `${room}/${o.name}`)
  if (names.length) await supabase.storage.from(BUCKET).remove(names)
  await table()?.delete().eq('id', room)
}

// A duplicated board needs its own copies: the originals may only be read by people who can
// read the board they were added to.
export async function copyImage(from: string, to: string): Promise<boolean> {
  if (!supabase || !getUser()) return false
  const { error } = await supabase.storage.from(BUCKET).copy(from, to)
  return !error
}

// An image can outlive the item that introduced it: a copy shares the same object, and an
// undo brings a deleted item back. So nothing is removed when an item goes. Instead, whatever
// the board no longer refers to is collected later, and only once it is old enough that it
// cannot be an upload whose item has not been saved yet.
const SWEEP_AFTER = 24 * 60 * 60 * 1000

export interface StoredObject { name: string; created_at?: string | null }

export function orphansIn(
  room: string, objects: StoredObject[], referenced: Set<string>, now = Date.now(),
): string[] {
  const old = now - SWEEP_AFTER
  return objects
    .filter((o) => !referenced.has(`${room}/${o.name}`))
    // An object with no timestamp is left alone: unknown age is not the same as old.
    .filter((o) => {
      const at = Date.parse(o.created_at ?? '')
      return Number.isFinite(at) && at < old
    })
    .map((o) => `${room}/${o.name}`)
}

export async function sweepImages(room: string, referenced: Set<string>): Promise<number> {
  if (!supabase || !getUser() || !room) return 0
  const { data, error } = await supabase.storage.from(BUCKET).list(room, { limit: 1000 })
  if (error || !data) return 0

  const orphans = orphansIn(room, data, referenced)
  if (!orphans.length) return 0
  const { error: failed } = await supabase.storage.from(BUCKET).remove(orphans)
  return failed ? 0 : orphans.length
}

export async function pushSnapshot(
  room: string, doc: Uint8Array, items: number, frames: number, thumb?: string,
): Promise<string | null> {
  if (!supabase || !getUser()) return null
  const { error } = await supabase.from('board_snapshots').upsert({
    board_id: room,
    doc: `\\x${[...doc].map((b) => b.toString(16).padStart(2, '0')).join('')}`,
    items,
    frames,
    ...(thumb ? { thumb } : {}),
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
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/webp',
    upsert: false,
  })
  if (error) return null
  // The path, not a url: the bucket is private and every link is signed when it is needed.
  return path
}

export interface Member {
  userId: string
  email: string
  role: 'editor' | 'viewer'
  owner: boolean
}

export interface DomainAccess {
  domain: string | null
  role: 'editor' | 'viewer'
}

export const myDomain = () => (getUser()?.email ?? '').split('@')[1]?.toLowerCase() ?? ''

export async function getDomainAccess(room: string): Promise<DomainAccess> {
  if (!supabase || !getUser()) return { domain: null, role: 'editor' }
  const { data } = await supabase
    .from('boards').select('allowed_domain, domain_role').eq('id', room).maybeSingle()
  return {
    domain: (data?.allowed_domain as string) ?? null,
    role: (data?.domain_role as 'editor' | 'viewer') ?? 'editor',
  }
}

export async function setDomainAccess(room: string, next: DomainAccess) {
  if (!supabase || !getUser()) return 'not signed in'
  const { error } = await supabase
    .from('boards')
    .update({ allowed_domain: next.domain, domain_role: next.role })
    .eq('id', room)
  return error ? error.message : null
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
  const rows = await supabase
    .from('board_members').select('user_id, email, role').eq('board_id', room).neq('role', 'blocked')
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

// Removing has to leave a trace: deleting the row would let the domain rule hand the board
// straight back on the next open.
export async function removeMember(room: string, userId: string) {
  await supabase?.from('board_members')
    .upsert({ board_id: room, user_id: userId, role: 'blocked' }, { onConflict: 'board_id,user_id' })
}

export async function touchMembership(room: string) {
  await supabase?.rpc('touch_membership', { board: room })
}

export async function setMemberRole(room: string, userId: string, role: 'editor' | 'viewer') {
  await supabase?.from('board_members').update({ role }).eq('board_id', room).eq('user_id', userId)
}

export async function myRoles(): Promise<Record<string, string>> {
  const user = getUser()
  if (!supabase || !user) return {}
  const { data } = await supabase
    .from('board_members').select('board_id, role').eq('user_id', user.id)
  return Object.fromEntries((data ?? []).map((r) => [r.board_id as string, r.role as string]))
}

export async function myRole(room: string): Promise<'owner' | 'editor' | 'viewer' | null> {
  const user = getUser()
  if (!supabase || !user) return null
  const board = await supabase
    .from('boards').select('owner, allowed_domain, domain_role').eq('id', room).maybeSingle()
  if (!board.data) return null
  if (board.data.owner === user.id) return 'owner'
  const mine = await supabase
    .from('board_members').select('role').eq('board_id', room).eq('user_id', user.id).maybeSingle()
  const role = mine.data?.role as 'editor' | 'viewer' | 'blocked' | undefined
  if (role) return role === 'blocked' ? null : role
  const domain = board.data.allowed_domain as string | null
  const mail = (user.email ?? '').split('@')[1]?.toLowerCase()
  if (domain && mail === domain) return (board.data.domain_role as 'editor' | 'viewer') ?? 'editor'
  return null
}
