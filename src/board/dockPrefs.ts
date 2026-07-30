export type DockItemId =
  | 'undo' | 'redo' | 'select' | 'sticky' | 'text' | 'shape' | 'connector' | 'pen'
  | 'table' | 'mindmap' | 'frame' | 'comment' | 'code' | 'templates' | 'image' | 'more'
  | 'minimap' | 'fit' | 'zoom'

export const DOCK_LABELS: Record<DockItemId, string> = {
  undo: 'Undo', redo: 'Redo', select: 'Select', sticky: 'Sticky', text: 'Text',
  shape: 'Shape', connector: 'Connector', pen: 'Pen', table: 'Table', mindmap: 'Mind map',
  frame: 'Frame', comment: 'Comment', code: 'Code block', templates: 'Templates', image: 'Image',
  more: 'More',
  minimap: 'Minimap', fit: 'Fit to content', zoom: 'Zoom',
}

export const DEFAULT_ORDER: DockItemId[] = [
  'undo', 'redo', 'select', 'sticky', 'text', 'shape', 'connector', 'pen',
  'table', 'mindmap', 'frame', 'comment', 'code', 'templates', 'image', 'more',
  'minimap', 'fit', 'zoom',
]

export type DockSize = 'sm' | 'md' | 'lg'
export type DockSide = 'bottom' | 'left' | 'right' | 'top'

export const DOCK_SIDES: { id: DockSide; name: string }[] = [
  { id: 'bottom', name: 'Bottom' }, { id: 'top', name: 'Top' },
  { id: 'left', name: 'Left' }, { id: 'right', name: 'Right' },
]

export interface DockPrefs {
  order: DockItemId[]
  hidden: DockItemId[]
  size: DockSize
  magnify: boolean
  side: DockSide
}

export const SIZE_PX: Record<DockSize, number> = { sm: 32, md: 38, lg: 46 }

const KEY = 'tuval:dock'

const DEFAULTS: DockPrefs = { order: DEFAULT_ORDER, hidden: [], size: 'md', magnify: true, side: 'bottom' }

function load(): DockPrefs {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<DockPrefs>
    const order = (parsed.order ?? DEFAULT_ORDER).filter((id) => DEFAULT_ORDER.includes(id))
    for (const id of DEFAULT_ORDER) if (!order.includes(id)) order.push(id)
    return {
      order,
      hidden: (parsed.hidden ?? []).filter((id) => DEFAULT_ORDER.includes(id)),
      size: parsed.size ?? 'md',
      magnify: parsed.magnify ?? true,
      side: parsed.side ?? 'bottom',
    }
  } catch {
    return { ...DEFAULTS }
  }
}

let prefs = load()
let visible: DockItemId[] = prefs.order.filter((id) => !prefs.hidden.includes(id))
const listeners = new Set<() => void>()

export const getDockPrefs = (): DockPrefs => prefs

export function subscribeDock(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function commit(next: DockPrefs) {
  prefs = next
  visible = next.order.filter((id) => !next.hidden.includes(id))
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
  listeners.forEach((l) => l())
}

export function setDockSize(size: DockSize) {
  commit({ ...prefs, size })
}

export function setMagnify(magnify: boolean) {
  commit({ ...prefs, magnify })
}

export function setDockSide(side: DockSide) {
  commit({ ...prefs, side })
}

export function toggleDockItem(id: DockItemId) {
  const hidden = prefs.hidden.includes(id)
    ? prefs.hidden.filter((x) => x !== id)
    : [...prefs.hidden, id]
  commit({ ...prefs, hidden })
}

export function moveDockItem(id: DockItemId, before: DockItemId | null) {
  const order = prefs.order.filter((x) => x !== id)
  const at = before ? order.indexOf(before) : order.length
  order.splice(at < 0 ? order.length : at, 0, id)
  commit({ ...prefs, order })
}

export function resetDock() {
  commit({ ...DEFAULTS, order: [...DEFAULT_ORDER] })
}

export const visibleDockItems = (): DockItemId[] => visible
