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

export async function claimBoard(room: string, name: string) {
  const user = getUser()
  if (!supabase || !user) return
  await table()?.upsert(
    { id: room, owner: user.id, name, updated_at: new Date().toISOString() },
    { onConflict: 'id', ignoreDuplicates: false },
  )
}

export async function renameCloudBoard(room: string, name: string) {
  if (!supabase || !getUser()) return
  await table()?.update({ name, updated_at: new Date().toISOString() }).eq('id', room)
}

export async function deleteCloudBoard(room: string) {
  if (!supabase || !getUser()) return
  await table()?.delete().eq('id', room)
}

export async function pushSnapshot(room: string, doc: Uint8Array, items: number, frames: number) {
  if (!supabase || !getUser()) return
  await supabase.from('board_snapshots').upsert({
    board_id: room,
    doc: `\\x${[...doc].map((b) => b.toString(16).padStart(2, '0')).join('')}`,
    items,
    frames,
    updated_at: new Date().toISOString(),
  })
  await table()?.update({ updated_at: new Date().toISOString() }).eq('id', room)
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
