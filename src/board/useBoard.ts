import { useSyncExternalStore } from 'react'
import { getIndex, getItems, subscribeDoc } from './doc'
import { useBoardStore } from './store'
import type { Item } from './types'

export const useItems = (): Item[] => useSyncExternalStore(subscribeDoc, getItems)
export const useItemIndex = () => useSyncExternalStore(subscribeDoc, getIndex)

export function useSelectedItems(): Item[] {
  const items = useItems()
  const selection = useBoardStore((s) => s.selection)
  const set = new Set(selection)
  return items.filter((i) => set.has(i.id))
}
