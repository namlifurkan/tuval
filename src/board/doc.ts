import * as Y from 'yjs'
import { IndexeddbPersistence } from 'y-indexeddb'
import { WebsocketProvider } from 'y-websocket'
import { Awareness } from 'y-protocols/awareness'
import { nanoid } from 'nanoid'
import { connectorBounds, makeResolver } from './geometry'
import type { Id, Item } from './types'

export const room = location.hash.replace(/^#/, '') || 'demo-board'
export const ydoc = new Y.Doc()
export const yitems = ydoc.getMap<Y.Map<unknown>>('items')
export const ymeta = ydoc.getMap<unknown>('meta')
export const undoManager = new Y.UndoManager([yitems, ymeta], { captureTimeout: 350 })
export const persistence = new IndexeddbPersistence(`miroclone:${room}`, ydoc)

const collabUrl = import.meta.env.VITE_COLLAB_URL as string | undefined
export const provider = collabUrl ? new WebsocketProvider(collabUrl, room, ydoc) : null
export const awareness: Awareness = provider?.awareness ?? new Awareness(ydoc)

let snapshot: Item[] = []
let index = new Map<Id, Item>()
let version = 0
const listeners = new Set<() => void>()

function rebuild() {
  const next: Item[] = []
  const map = new Map<Id, Item>()
  yitems.forEach((m) => {
    const item = m.toJSON() as Item
    next.push(item)
    map.set(item.id, item)
  })
  const resolve = makeResolver(map)
  for (const item of next) {
    if (item.type !== 'connector') continue
    Object.assign(item, connectorBounds(item, resolve))
  }
  next.sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : 1))
  snapshot = next
  index = map
  version++
  listeners.forEach((l) => l())
}

yitems.observeDeep(rebuild)
persistence.on('synced', rebuild)
rebuild()

export const subscribeDoc = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}
export const getItems = () => snapshot
export const getIndex = () => index
export const getItem = (id: Id) => index.get(id)
export const getVersion = () => version

export const newId = () => nanoid(10)

export function nextZ() {
  let max = 0
  for (const it of snapshot) max = Math.max(max, it.z)
  return max + 1
}

export function minZ() {
  let min = 0
  for (const it of snapshot) min = Math.min(min, it.z)
  return min - 1
}

export function createItems(items: Item[]) {
  ydoc.transact(() => {
    for (const item of items) yitems.set(item.id, new Y.Map(Object.entries(item)))
  })
}

export function patchItem(id: Id, changes: Record<string, unknown>) {
  patchItems([[id, changes]])
}

export function patchItems(entries: [Id, Record<string, unknown>][]) {
  ydoc.transact(() => {
    for (const [id, changes] of entries) {
      const m = yitems.get(id)
      if (!m) continue
      for (const [k, v] of Object.entries(changes)) m.set(k, v)
    }
  })
}

export function removeItems(ids: Id[]) {
  const set = new Set(ids)
  ydoc.transact(() => {
    for (const id of ids) yitems.delete(id)
    yitems.forEach((m, key) => {
      const item = m.toJSON() as Item
      if (item.type === 'connector') {
        if (set.has(item.from.itemId ?? '') || set.has(item.to.itemId ?? '')) yitems.delete(key)
      }
      if (item.parentId && set.has(item.parentId)) m.set('parentId', null)
    })
  })
}

export function childrenOf(id: Id): Item[] {
  return snapshot.filter((i) => i.parentId === id)
}

export function connectorsFor(ids: Set<Id>): Item[] {
  return snapshot.filter(
    (i) => i.type === 'connector' && (ids.has(i.from.itemId ?? '') || ids.has(i.to.itemId ?? '')),
  )
}

export function transact(fn: () => void) {
  ydoc.transact(fn)
}
