import { create } from 'zustand'
import type { Camera } from './camera'
import type { Cap, ConnectorShape, Id, ShapeKind, StrokeStyle, TextStyle, Vec } from './types'
import { DEFAULT_TEXT_STYLE } from './types'

export type Tool =
  | 'select' | 'hand' | 'sticky' | 'text' | 'shape' | 'connector' | 'pen' | 'frame' | 'comment'

export interface EditingState { id: Id; selectAll: boolean }

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
  showGrid: boolean
  boardName: string
  previousTool: Tool
  menu: { x: number; y: number } | null
  openComment: Id | null
  presenting: number | null
  searchOpen: boolean
  framesPanel: boolean
  renamingFrame: Id | null
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
  camera: { x: -600, y: -400, z: 1 },
  tool: 'select',
  stickyFill: '#FFF9B1',
  shape: { kind: 'rect', fill: '#FFFFFF', stroke: '#1A1A1A', strokeWidth: 2, strokeStyle: 'solid' },
  pen: { stroke: '#1A1A1A', strokeWidth: 4, highlighter: false, eraser: false },
  connector: {
    shape: 'curved', stroke: '#1A1A1A', strokeWidth: 2,
    strokeStyle: 'solid', capStart: 'none', capEnd: 'arrow',
  },
  textStyle: { ...DEFAULT_TEXT_STYLE },
  selection: [],
  editing: null,
  hover: null,
  showMinimap: true,
  showGrid: true,
  boardName: 'Untitled board',
  previousTool: 'select',
  menu: null,
  openComment: null,
  presenting: null,
  searchOpen: false,
  framesPanel: false,
  renamingFrame: null,
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

export interface RemoteUser {
  id: number
  name: string
  color: string
  cursor: Vec | null
  selection: Id[]
}

export interface Session {
  preview: Map<Id, Record<string, unknown>>
  badge: string | null
  spacing: { x: number; y: number; w: number; h: number }[]
  dropFrame: Id | null
  marquee: { x: number; y: number; w: number; h: number } | null
  guides: [Vec, Vec][]
  draft: unknown | null
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

if (import.meta.hot) {
  import.meta.hot.accept(() => import.meta.hot!.invalidate())
}
