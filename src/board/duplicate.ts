import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { newRoom, touchBoard } from './boards'
import { claimBoard, copyImage, pullSnapshot, pushSnapshot } from './cloud'
import { makeThumb } from './thumb'
import { storagePath } from './storage'
import { getUser } from './supabase'
import { surfaceColor } from './brand'
import type { Item } from './types'

// Reading a board that is not the one on screen: whatever this browser has, topped up from the
// server. Either may be missing on its own, so both are tried.
async function readDoc(room: string): Promise<Y.Doc> {
  const doc = new Y.Doc()
  const local = new IndexeddbPersistence(`tuval:${room}`, doc)
  await local.whenSynced
  if (getUser()) {
    const update = await pullSnapshot(room)
    if (update) Y.applyUpdate(doc, update, 'cloud')
  }
  await local.destroy()
  return doc
}

// An image lives under the id of the board it was added to, and may only be read by people who
// can read that board. Left alone, a duplicate would show its images to whoever could see the
// original and to nobody else, so the objects are copied across too.
async function rehomeImages(items: Y.Map<Y.Map<unknown>>, from: string, to: string) {
  if (!getUser()) return
  for (const [, item] of items) {
    if (item.get('type') !== 'image') continue
    const path = storagePath(String(item.get('src') ?? ''))
    if (!path || !path.startsWith(`${from}/`)) continue
    const next = `${to}/${path.slice(from.length + 1)}`
    if (await copyImage(path, next)) item.set('src', next)
  }
}

export async function duplicateBoard(room: string, name: string): Promise<string> {
  const source = await readDoc(room)
  const copy = new Y.Doc()
  Y.applyUpdate(copy, Y.encodeStateAsUpdate(source))
  source.destroy()

  const target = newRoom()
  const meta = copy.getMap<unknown>('meta')
  const title = `${name || 'Untitled board'} copy`
  meta.set('name', title)

  // The row comes first: a snapshot has nowhere to hang without it, and the storage policy
  // decides by asking who may write to this board, which needs the board to exist.
  if (getUser()) await claimBoard(target, title)

  await rehomeImages(copy.getMap<Y.Map<unknown>>('items'), room, target)

  const store = new IndexeddbPersistence(`tuval:${target}`, copy)
  await store.whenSynced

  const items = [...copy.getMap<Y.Map<unknown>>('items').values()]
    .map((m) => m.toJSON() as Item)
  const frames = items.filter((i) => i.type === 'frame').length

  touchBoard(target, {
    name: String(meta.get('name') ?? ''),
    opened: Date.now(),
    items: items.length - frames,
    frames,
    thumb: makeThumb(items, surfaceColor(String(meta.get('surface') ?? 'paper'))),
  })

  // Pushed straight away so the copy is on the board list of every device, not only the one
  // that made it.
  if (getUser()) {
    await pushSnapshot(
      target, Y.encodeStateAsUpdate(copy), items.length - frames, frames,
    )
  }

  await store.destroy()
  copy.destroy()
  return target
}
