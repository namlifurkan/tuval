import { t } from '../i18n'
import * as Y from 'yjs'
import { getItems, newId, ydoc, yitems } from './doc'
import { me } from './me'
import type { Item } from './types'

export interface Version {
  id: string
  at: number
  by: string
  label: string
  count: number
}

interface StoredVersion extends Version {
  items: string
}

const yversions = ydoc.getMap<StoredVersion>('versions')
const MAX_VERSIONS = 20
const AUTO_INTERVAL = 10 * 60 * 1000

const listeners = new Set<() => void>()
let cache: Version[] = []

function rebuild() {
  const list: Version[] = []
  yversions.forEach((v) => list.push({ id: v.id, at: v.at, by: v.by, label: v.label, count: v.count }))
  list.sort((a, b) => b.at - a.at)
  cache = list
  listeners.forEach((l) => l())
}

yversions.observe(rebuild)
rebuild()

export function subscribeHistory(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export const getVersions = (): Version[] => cache

export function saveVersion(label: string): Version | null {
  const items = getItems()
  if (!items.length) return null
  const version: StoredVersion = {
    id: newId(),
    at: Date.now(),
    by: me.name,
    label: label.trim() || t('Saved version'),
    count: items.length,
    items: JSON.stringify(items),
  }
  ydoc.transact(() => {
    yversions.set(version.id, version)
    const extra = [...yversions.values()].sort((a, b) => a.at - b.at)
    while (extra.length > MAX_VERSIONS) {
      const oldest = extra.shift()
      if (oldest) yversions.delete(oldest.id)
    }
  })
  return version
}

export function deleteVersion(id: string) {
  yversions.delete(id)
}

export function restoreVersion(id: string): boolean {
  const stored = yversions.get(id)
  if (!stored) return false
  let items: Item[]
  try {
    items = JSON.parse(stored.items) as Item[]
  } catch {
    return false
  }
  ydoc.transact(() => {
    for (const key of [...yitems.keys()]) yitems.delete(key)
    for (const item of items) yitems.set(item.id, new Y.Map(Object.entries(item)))
  })
  return true
}

let lastAuto = Date.now()
let dirtySinceAuto = false

yitems.observeDeep(() => { dirtySinceAuto = true })

export function maybeAutoSave() {
  if (!dirtySinceAuto) return
  if (Date.now() - lastAuto < AUTO_INTERVAL) return
  lastAuto = Date.now()
  dirtySinceAuto = false
  saveVersion('Otomatik')
}

if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot!.invalidate())
}
