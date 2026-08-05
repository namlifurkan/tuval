import { FONT } from './brand'

export type Id = string

export type ShapeKind =
  | 'rect' | 'roundRect' | 'ellipse' | 'triangle' | 'diamond' | 'star'
  | 'pentagon' | 'hexagon' | 'octagon' | 'arrowRight' | 'chevron' | 'cloud'
  | 'cross' | 'cylinder' | 'parallelogram' | 'trapezoid' | 'speech' | 'bracket'
  | 'stadium' | 'document' | 'manualInput' | 'display' | 'delay'
  | 'folder' | 'note' | 'actor' | 'component' | 'node3d'
  | 'browser' | 'phone' | 'avatar' | 'field'

export type Align = 'left' | 'center' | 'right'
export type VAlign = 'top' | 'middle' | 'bottom'
export type StrokeStyle = 'solid' | 'dashed' | 'dotted'
export type Cap = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond'
export type ConnectorShape = 'straight' | 'elbow' | 'curved'
export type AnchorSide = 'top' | 'right' | 'bottom' | 'left'

export interface TextStyle {
  fontSize: number
  fontFamily: string
  textColor: string
  align: Align
  valign: VAlign
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  autoFit: boolean
}

export interface BaseItem {
  id: Id
  x: number
  y: number
  w: number
  h: number
  rotation: number
  z: number
  parentId: Id | null
  groupId: Id | null
  locked: boolean
  opacity: number
  // What drew this, when a person did not. Set on everything a brief becomes, so a brief sent to
  // the same board a second time can take back its own work and leave what somebody added by
  // hand — the canvas half of the signature a record carries in `updated_via`.
  via?: string
}

export interface StickyItem extends BaseItem, TextStyle {
  type: 'sticky'
  fill: string
  text: string
  shape: 'square' | 'rect'
  label?: string
  labelSize?: number
}

// A record placed on a canvas. It carries no content of its own: the record is a row, and this
// is where it happens to be. The snapshot is a copy of what the row said the last time anyone
// looked, kept so the board still reads with the network unplugged; it is never the truth.
export interface RecordItem extends BaseItem, TextStyle {
  type: 'record'
  recordId: string
  kind: string
  fill: string
  missing?: boolean
  snapshot: { title: string; status: string | null }
}

export interface ShapeItem extends BaseItem, TextStyle {
  type: 'shape'
  mindParent?: Id | null
  kind: ShapeKind
  fill: string
  stroke: string
  strokeWidth: number
  strokeStyle: StrokeStyle
  text: string
}

export interface TextItem extends BaseItem, TextStyle {
  type: 'text'
  text: string
  fill: string
  autoWidth: boolean
}

export interface DrawItem extends BaseItem {
  type: 'draw'
  points: number[]
  stroke: string
  strokeWidth: number
  highlighter: boolean
}

export interface ImageItem extends BaseItem {
  type: 'image'
  src: string
  naturalW: number
  naturalH: number
}

export interface Assignee { id: string; name: string; color: string }

export interface FrameItem extends BaseItem {
  type: 'frame'
  title: string
  fill: string
  order?: number
  assignees?: Assignee[]
}

export interface CommentReply {
  id: string
  author: string
  color: string
  text: string
  at: number
}

export interface CommentItem extends BaseItem {
  type: 'comment'
  replies: CommentReply[]
  resolved: boolean
}

export interface EmbedItem extends BaseItem {
  type: 'embed'
  url: string
  title: string
}

export interface TableItem extends BaseItem, TextStyle {
  type: 'table'
  rows: number
  cols: number
  widths: number[]
  heights: number[]
  cells: string[][]
  // [row, col, rowSpan, colSpan] per merged block; absent on tables made before merging existed
  merges?: number[][]
  headerRow: boolean
  fill: string
  headerFill: string
  stroke: string
  strokeWidth: number
}

export interface CodeItem extends BaseItem {
  type: 'code'
  text: string
  lang: string
  fontSize: number
  theme: 'light' | 'dark'
  showLines: boolean
}

export interface Endpoint {
  itemId: Id | null
  anchor: AnchorSide | null
  x: number
  y: number
}

export interface ConnectorItem extends BaseItem, TextStyle {
  type: 'connector'
  from: Endpoint
  to: Endpoint
  shape: ConnectorShape
  stroke: string
  strokeWidth: number
  strokeStyle: StrokeStyle
  capStart: Cap
  capEnd: Cap
  text: string
  // Where the main label sits along the line, 0 at the start and 1 at the end
  labelT?: number
  // Further labels, so a branch can be marked at both ends as well as in the middle
  labels?: { t: number; text: string }[]
  bend: Vec | null
  bends: Vec[]
}

export type Item =
  | StickyItem | ShapeItem | TextItem | DrawItem | ImageItem | FrameItem | ConnectorItem
  | RecordItem
  | CommentItem | TableItem | EmbedItem | CodeItem

export type ItemType = Item['type']

export interface Rect { x: number; y: number; w: number; h: number }
export interface Vec { x: number; y: number }

export const STICKY_COLORS = [
  '#F0E3B0', '#E8C55A', '#DE9A4E', '#C8664A', '#E7B7B4', '#B9718A',
  '#CBD79A', '#8FA96B', '#5E9A8A', '#7FA5BE', '#3E5C93', '#8A7FB0',
  '#EFEDE6', '#C6C2B6', '#8A867C', '#1F1D1A',
] as const

export const SHAPE_FILLS = [
  '#FFFFFF', '#F0E3B0', '#E8C55A', '#DE9A4E', '#C8664A', '#E7B7B4',
  '#CBD79A', '#8FA96B', '#5E9A8A', '#7FA5BE', '#3E5C93', '#8A7FB0',
  '#EFEDE6', '#C6C2B6', '#1F1D1A', 'transparent',
] as const

export const LINE_COLORS = [
  '#1F1D1A', '#8A867C', '#3E5C93', '#5E9A8A', '#8FA96B', '#E8C55A',
  '#DE9A4E', '#C8452D', '#B9718A', '#8A7FB0', '#FFFFFF', 'transparent',
] as const

export const FONT_SIZES = [8, 10, 11, 12, 14, 18, 24, 29, 36, 48, 59, 72, 98, 144, 190, 288]

export const INK = {
  light: '#1F1D1A',
  dark: '#FFFFFF',
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 24,
  fontFamily: FONT.family,
  textColor: INK.light,
  align: 'center',
  valign: 'middle',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  autoFit: true,
}

export const BRAND = {
  selection: '#141310',
  ink: '#141310',
  guide: '#B43E28',
  pigment: '#B43E28',
}
