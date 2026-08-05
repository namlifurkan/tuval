import { getUser, supabase } from './supabase'
import { getWorkspace, loadWorkspace } from './workspace'
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

export function mergeBoardLists(local: BoardEntry[], cloud: CloudBoard[]): BoardEntry[] {
  const all = new Map<string, BoardEntry>()
  for (const board of local) all.set(board.room, board)
  // Cloud carries shared boards this browser has never opened. It also has the authoritative
  // name for a board renamed by somebody else.
  for (const board of cloud) {
    if (board.deleted) continue
    // Keeping this browser's own idea of when it last opened the board, and taking the cloud's
    // idea of when the board changed: a board is new to you because somebody wrote it, not
    // because you looked at it.
    const held = all.get(board.room)
    all.set(board.room, { ...board, opened: Math.max(board.opened, held?.opened ?? 0) })
  }
  return [...all.values()]
}

// board_snapshots.board_id is both the foreign key and the primary key, so PostgREST reads the
// relationship as one-to-one and embeds an object where a plain foreign key would give an
// array. Reading only the array shape left every cloud board looking empty.
export function pickSnapshot(embedded: unknown): Snapshot | null {
  const row = Array.isArray(embedded) ? embedded[0] : embedded
  if (!row || typeof row !== 'object') return null
  const { items, frames, thumb } = row as Partial<Snapshot>
  return { items: items ?? 0, frames: frames ?? 0, thumb: thumb ?? null }
}

const BOARD_COLUMNS =
  'id, name, owner, project_id, updated_at, deleted_at, board_snapshots(items, frames, thumb)'

// A board that reaches you through an invitation lives in the workspace of whoever sent it. The
// invitation makes you a member of that one board and of nothing around it, so asking only for
// the boards in your own workspace leaves it out: it opens from the link and appears nowhere,
// which reads as the link being the only copy of it. Asked for both ways and merged, because a
// board can be in your workspace and have you listed on it as well.
export function dedupeBoards<T extends { id: unknown; updated_at?: unknown }>(rows: T[]): T[] {
  const held = new Map<string, T>()
  for (const row of rows) held.set(String(row.id), row)
  return [...held.values()].sort((a, b) =>
    Date.parse(String(b.updated_at ?? '')) - Date.parse(String(a.updated_at ?? '')) || 0)
}

export async function listCloudBoards(): Promise<CloudBoard[]> {
  const user = getUser()
  if (!supabase || !user) return []
  const workspace = getWorkspace() ?? await loadWorkspace()
  if (!workspace) return []

  // An invitation becomes a membership when it is claimed, and that happens as the workspace
  // loads — which a tab that already has one does not do again. The dashboard is where somebody
  // goes to look for what was shared with them, so it is the place that should ask rather than
  // the place that tells them to reload.
  await supabase.rpc('claim_invites')

  const { data: joined } = await supabase.from('board_members')
    .select('board_id').eq('user_id', user.id)
  const invited = (joined ?? []).map((row) => row.board_id as string)

  const [ours, theirs] = await Promise.all([
    supabase.from('boards').select(BOARD_COLUMNS).eq('workspace_id', workspace.id),
    invited.length
      ? supabase.from('boards').select(BOARD_COLUMNS).in('id', invited)
      : Promise.resolve({ data: [], error: null }),
  ])
  if (ours.error) throw ours.error

  const data = dedupeBoards([...(ours.data ?? []), ...(theirs.data ?? [])])
  return data.map((row) => {
    const snap = pickSnapshot(row.board_snapshots)
    return {
      room: row.id as string,
      name: (row.name as string) ?? '',
      opened: Date.parse(row.updated_at as string) || 0,
      changed: Date.parse(row.updated_at as string) || 0,
      items: snap?.items ?? 0,
      frames: snap?.frames ?? 0,
      thumb: snap?.thumb ?? '',
      owned: row.owner === user.id,
      project: (row.project_id as string | null) ?? null,
      deleted: row.deleted_at ? Date.parse(row.deleted_at as string) : undefined,
    }
  })
}

export async function listCloudBoardIds(rooms: string[]): Promise<Set<string>> {
  const wanted = [...new Set(rooms)]
  if (!wanted.length) return new Set()
  const user = getUser()
  if (!supabase || !user) return new Set()
  if (!getWorkspace() && !await loadWorkspace()) return new Set(wanted)

  const found = new Set<string>()
  for (let at = 0; at < wanted.length; at += 200) {
    const { data, error } = await supabase.from('boards').select('id').in('id', wanted.slice(at, at + 200))
    if (error) return new Set(wanted)
    for (const row of data ?? []) found.add(row.id as string)
  }
  return found
}

// The row is there and it is not ours to write. Not a failure to retry — an answer, and the
// caller has to act on it rather than keep asking.
export const NOT_MINE = 'not-mine'

// Never re-send owner on an existing row: a board shared with you belongs to someone else,
// and an upsert would try to take it over and be refused by the update policy.
export async function claimBoard(room: string, name: string): Promise<string | null> {
  const user = getUser()
  if (!supabase || !user) return null
  const workspace = getWorkspace() ?? await loadWorkspace()
  if (!workspace) return 'No workspace'

  const touch = () => supabase!
    .from('boards')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', room)
    .select('id')

  const first = await touch()
  if (first.data?.length) return null
  if (first.error) return first.error.message

  const created = await supabase
    .from('boards')
    .insert({ id: room, owner: user.id, name, workspace_id: workspace.id })
  if (!created.error) return null
  // Two writers can both find no row and both insert it; the loser is told the key is taken,
  // which is the same news as the row being there. Whether it is ours to write is a separate
  // question, and touching it again is what answers that.
  if (created.error.code !== '23505') return created.error.message
  const second = await touch()
  if (second.data?.length) return null
  return second.error?.message ?? NOT_MINE
}

// A brief an agent left for whoever opens the board first. Reading it does not take it: the
// brief is turned into items before it is cleared, so a failure to draw leaves the words where
// they were rather than losing them.
//
// The mode comes with it because it belongs to this brief rather than to the board: the same
// board can be added to one month and redrawn the next.
export interface PendingBrief {
  brief: string
  mode: 'append' | 'replace'
}

export async function readPendingBrief(room: string): Promise<PendingBrief | null> {
  if (!supabase || !getUser()) return null
  const { data } = await supabase
    .from('boards').select('pending_brief, pending_mode').eq('id', room).maybeSingle()
  const brief = (data?.pending_brief as string | null) || null
  if (!brief) return null
  return { brief, mode: data?.pending_mode === 'replace' ? 'replace' : 'append' }
}

// Cleared with the text that was read as the condition, so two tabs opening at once draw it
// once: the second matches no row and knows not to draw.
export async function clearPendingBrief(room: string, brief: string): Promise<boolean> {
  if (!supabase || !getUser()) return false
  const { data } = await supabase
    .from('boards').update({ pending_brief: null, pending_mode: null })
    .eq('id', room).eq('pending_brief', brief).select('id')
  return !!data?.length
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
  room: string, doc: Uint8Array, items: number, frames: number, thumb?: string, reading?: string,
): Promise<string | null> {
  if (!supabase || !getUser()) return null
  const snapshot = await snapshotBase64(doc)
  const { error } = await supabase.rpc('save_board_snapshot', {
    room,
    snapshot,
    item_count: items,
    frame_count: frames,
    thumbnail: thumb || null,
    reading: reading || null,
  })
  return error ? error.message : null
}

const BASE64_CHUNK = 48 * 1024 // divisible by three, so only the final chunk is padded

export async function snapshotBase64(doc: Uint8Array): Promise<string> {
  const chunks: string[] = []
  for (let at = 0; at < doc.length; at += BASE64_CHUNK) {
    const bytes = doc.subarray(at, at + BASE64_CHUNK)
    chunks.push(btoa(String.fromCharCode(...bytes)))
    // A large board yields between bounded chunks so typing and pointer input are not starved by
    // serialization. Each allocation is at most 48 KiB rather than one array and string per byte.
    if (at + BASE64_CHUNK < doc.length) {
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0))
    }
  }
  return chunks.join('')
}

const HEX = /^[0-9a-fA-F]*$/
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/

const nibble = (code: number) => (code <= 57 ? code - 48 : (code & 0xdf) - 55)

// PostgREST returns bytea as a hex literal, but which encoding it uses is a server setting, so
// base64 is read too. Anything else throws: a snapshot read as empty would be overwritten by
// whatever this tab happens to hold, which is the whole board.
export function decodeSnapshot(raw: string): Uint8Array {
  if (raw.startsWith('\\x')) {
    const body = raw.slice(2)
    if (body.length % 2 || !HEX.test(body)) throw new Error('Snapshot is not readable hex')
    const out = new Uint8Array(body.length / 2)
    // Arithmetic on character codes, not a slice and a parseInt per byte: a five megabyte board
    // is five million throwaway strings that way, and the tab stops until they are collected.
    for (let i = 0; i < out.length; i++) {
      out[i] = (nibble(body.charCodeAt(i * 2)) << 4) | nibble(body.charCodeAt(i * 2 + 1))
    }
    return out
  }
  // atob is forgiving about both padding and stray characters, so a plain sentence decodes to
  // rubbish rather than failing. The row is checked before it is trusted.
  const body = raw.replace(/\s+/g, '')
  if (body.length % 4 || !BASE64.test(body)) throw new Error('Snapshot is in an unknown encoding')
  return Uint8Array.from(atob(body), (c) => c.charCodeAt(0))
}

export async function pullSnapshot(room: string): Promise<Uint8Array | null> {
  if (!supabase || !getUser()) return null
  const { data, error } = await supabase
    .from('board_snapshots')
    .select('doc')
    .eq('board_id', room)
    .maybeSingle()
  if (error) throw error
  return data?.doc ? decodeSnapshot(data.doc as string) : null
}

// The board's record is the log, not the row: one row per update, numbered per board with no
// gaps, so a reader catches up by asking for everything past the number it already has. The row
// is a compaction of it, which is why losing a race to write the row is no longer losing work.

export const LOG_MAX = 1_048_576

export interface LoggedUpdate { seq: number; at: number; update: Uint8Array }

export async function appendUpdate(room: string, update: Uint8Array): Promise<number | null> {
  if (!supabase || !getUser()) return null
  const { data, error } = await supabase.rpc('append_board_update', {
    room,
    payload: await snapshotBase64(update),
  })
  if (error) throw new Error(error.message)
  return data == null ? null : Number(data)
}

export async function pullUpdates(room: string, after: number): Promise<LoggedUpdate[]> {
  if (!supabase || !getUser()) return []
  const { data, error } = await supabase
    .from('board_updates')
    .select('seq, update, created_at')
    .eq('board_id', room)
    .gt('seq', after)
    .order('seq')
  if (error) throw new Error(error.message)
  return (data ?? []).map((row) => ({
    seq: Number(row.seq),
    at: Date.parse(row.created_at as string),
    update: decodeSnapshot(row.update as string),
  }))
}

export async function compactUpdates(room: string, through: number): Promise<number> {
  if (!supabase || !getUser() || through <= 0) return 0
  const { data, error } = await supabase.rpc('compact_board_updates', { room, through_seq: through })
  if (error) throw new Error(error.message)
  return Number(data ?? 0)
}

// When the row last changed, which is all a tab needs to notice that another one has written
// under it. Cheap enough to ask before every save; the document itself is not.
export async function snapshotStamp(room: string): Promise<string | null> {
  if (!supabase || !getUser()) return null
  const { data, error } = await supabase
    .from('board_snapshots')
    .select('updated_at')
    .eq('board_id', room)
    .maybeSingle()
  if (error) throw error
  return (data?.updated_at as string) ?? null
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

export interface Invite {
  email: string
  role: 'editor' | 'viewer'
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

export async function revokeInvite(room: string, email: string) {
  await supabase?.from('board_invites').delete().eq('board_id', room).eq('email', email)
}

// Removing has to leave a trace: deleting the row would let an invitation, or the workspace's
// domain rule, hand the board straight back on the next open.
export async function removeMember(room: string, userId: string) {
  await supabase?.from('board_members')
    .upsert({ board_id: room, user_id: userId, role: 'blocked' }, { onConflict: 'board_id,user_id' })
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
    .from('boards').select('owner, workspace_id').eq('id', room).maybeSingle()
  if (!board.data) return null
  if (board.data.owner === user.id) return 'owner'
  const mine = await supabase
    .from('board_members').select('role').eq('board_id', room).eq('user_id', user.id).maybeSingle()
  const role = mine.data?.role as 'editor' | 'viewer' | 'blocked' | undefined
  if (role) return role === 'blocked' ? null : role

  // The workspace is the other way onto a board, and a guest of one may read it and nothing
  // more. Saying so here is what keeps the canvas from accepting edits the database will refuse.
  const workspace = board.data.workspace_id as string | null
  if (!workspace) return null
  const seat = await supabase.from('workspace_members')
    .select('role').eq('workspace_id', workspace).eq('user_id', user.id).maybeSingle()
  if (seat.data?.role === 'guest') return 'viewer'
  return null
}
