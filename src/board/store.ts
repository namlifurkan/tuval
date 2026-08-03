import { create } from 'zustand'
import { isDarkSurface, surfaceColor } from './brand'
import { getMeta, room, subscribeMeta } from './doc'
import { loadCamera } from './viewport'
import { animateCamera, fitRect } from './camera'
import type { Camera } from './camera'
import type { Cap, ConnectorShape, Id, Rect, ShapeKind, StrokeStyle, TextStyle, Vec } from './types'
import { DEFAULT_TEXT_STYLE, INK } from './types'

const boardInk = () =>
  isDarkSurface(surfaceColor(String(getMeta().surface ?? 'paper'))) ? INK.dark : INK.light

export type Tool =
  | 'select' | 'hand' | 'sticky' | 'text' | 'shape' | 'connector' | 'pen' | 'frame' | 'comment'
  | 'table' | 'mindmap' | 'code'

export interface EditingState { id: Id; selectAll: boolean; cell?: [number, number] }

interface BoardState {
  camera: Camera
  tool: Tool
  stickyFill: string
  shape: { kind: ShapeKind; fill: string; stroke: string; strokeWidth: number; strokeStyle: StrokeStyle }
  pen: { stroke: string; strokeWidth: number; highlighter: boolean; eraser: boolean }
  connector: {
    shape: ConnectorShape; stroke: string; strokeWidth: number
    strokeStyle: StrokeStyle; capStart: Cap; capEnd: Cap
  }
  textStyle: TextStyle
  selection: Id[]
  editing: EditingState | null
  hover: Id | null
  showMinimap: boolean
  previousTool: Tool
  menu: { x: number; y: number } | null
  openComment: Id | null
  presenting: number | null
  searchOpen: boolean
  briefOpen: boolean
  boardsPanel: boolean
  framesPanel: boolean
  commentsPanel: boolean
  renamingFrame: Id | null
  activeEmbed: Id | null
  following: number | null
  chatOpen: boolean
  historyPanel: boolean
  dragging: boolean

  setCamera: (c: Camera | ((c: Camera) => Camera)) => void
  setTool: (t: Tool, remember?: boolean) => void
  restoreTool: () => void
  setSelection: (ids: Id[]) => void
  toggleSelection: (id: Id) => void
  setEditing: (e: EditingState | null) => void
  setHover: (id: Id | null) => void
  patchStyle: (p: Partial<TextStyle>) => void
  update: (p: Partial<BoardState>) => void
}

export const useBoardStore = create<BoardState>((set, get) => ({
  camera: loadCamera(room) ?? { x: -600, y: -400, z: 1 },
  tool: 'select',
  stickyFill: '#F0E3B0',
  shape: { kind: 'rect', fill: '#FCFBF8', stroke: '#1F1D1A', strokeWidth: 2, strokeStyle: 'solid' },
  pen: { stroke: boardInk(), strokeWidth: 4, highlighter: false, eraser: false },
  connector: {
    shape: 'curved', stroke: boardInk(), strokeWidth: 2,
    strokeStyle: 'solid', capStart: 'none', capEnd: 'arrow',
  },
  textStyle: { ...DEFAULT_TEXT_STYLE },
  selection: [],
  editing: null,
  hover: null,
  showMinimap: true,
  previousTool: 'select',
  menu: null,
  openComment: null,
  presenting: null,
  searchOpen: false,
  briefOpen: false,
  boardsPanel: false,
  framesPanel: false,
  commentsPanel: false,
  renamingFrame: null,
  activeEmbed: null,
  following: null,
  chatOpen: false,
  historyPanel: false,
  dragging: false,

  setCamera: (c) => set((s) => ({ camera: typeof c === 'function' ? c(s.camera) : c })),
  setTool: (tool, remember) =>
    set((s) => ({ tool, previousTool: remember ? s.tool : s.previousTool, editing: null })),
  restoreTool: () => set((s) => ({ tool: s.previousTool })),
  setSelection: (selection) => set({ selection }),
  toggleSelection: (id) =>
    set((s) => ({
      selection: s.selection.includes(id) ? s.selection.filter((i) => i !== id) : [...s.selection, id],
    })),
  setEditing: (editing) => set({ editing }),
  setHover: (hover) => (get().hover === hover ? undefined : set({ hover })),
  patchStyle: (p) => set((s) => ({ textStyle: { ...s.textStyle, ...p } })),
  update: (p) => set(p as BoardState),
}))

subscribeMeta(() => {
  const ink = boardInk()
  const stale = ink === INK.dark ? INK.light : INK.dark
  const s = useBoardStore.getState()
  if (s.pen.stroke === stale) s.update({ pen: { ...s.pen, stroke: ink } })
  if (s.connector.stroke === stale) s.update({ connector: { ...s.connector, stroke: ink } })
})

export interface RemoteUser {
  id: number
  name: string
  color: string
  cursor: Vec | null
  selection: Id[]
  chat: { text: string; at: number } | null
}

export interface Session {
  preview: Map<Id, Record<string, unknown>>
  badge: string | null
  spacing: { x: number; y: number; w: number; h: number }[]
  dropFrame: Id | null
  marquee: { x: number; y: number; w: number; h: number } | null
  guides: [Vec, Vec][]
  draft: { pts: number[][]; stroke: string; strokeWidth: number; highlighter: boolean } | null
  connectorDraft: { from: Vec; to: Vec; target: Id | null } | null
  anchorsFor: Id | null
  remote: RemoteUser[]
  spaceDown: boolean
  cursor: string
}

export const session: Session = {
  preview: new Map(),
  badge: null,
  spacing: [],
  dropFrame: null,
  marquee: null,
  guides: [],
  draft: null,
  connectorDraft: null,
  anchorsFor: null,
  remote: [],
  spaceDown: false,
  cursor: 'default',
}

let dirty = true
export const requestRender = () => { dirty = true }
export const consumeDirty = () => {
  const d = dirty
  dirty = false
  return d
}

// Every arrival on the canvas — a search hit, a frame, a comment, a freshly dropped template —
// goes through here, so they all travel the same way instead of teleporting.
export function flyToRect(rect: Rect, padding?: number) {
  const el = document.querySelector('canvas')
  if (!el) return
  const { camera, setCamera } = useBoardStore.getState()
  animateCamera(camera, fitRect(rect, el.clientWidth, el.clientHeight, padding), (c) => {
    setCamera(c)
    requestRender()
  })
}

if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot!.invalidate())
}
