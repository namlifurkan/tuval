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
}

export interface StickyItem extends BaseItem, TextStyle {
  type: 'sticky'
  fill: string
  text: string
  shape: 'square' | 'rect'
  label?: string
  labelSize?: number
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

export interface FrameItem extends BaseItem {
  type: 'frame'
  title: string
  fill: string
  order?: number
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
  bend: Vec | null
  bends: Vec[]
}

export type Item =
  | StickyItem | ShapeItem | TextItem | DrawItem | ImageItem | FrameItem | ConnectorItem
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

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 24,
  fontFamily: 'Instrument Sans',
  textColor: '#1F1D1A',
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
  guide: '#C8452D',
  pigment: '#C8452D',
}
