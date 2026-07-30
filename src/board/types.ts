export type Id = string

export type ShapeKind =
  | 'rect' | 'roundRect' | 'ellipse' | 'triangle' | 'diamond' | 'star'
  | 'pentagon' | 'hexagon' | 'octagon' | 'arrowRight' | 'chevron' | 'cloud'
  | 'cross' | 'cylinder' | 'parallelogram' | 'trapezoid' | 'speech' | 'bracket'

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
}

export interface ShapeItem extends BaseItem, TextStyle {
  type: 'shape'
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
}

export type Item =
  | StickyItem | ShapeItem | TextItem | DrawItem | ImageItem | FrameItem | ConnectorItem
  | CommentItem

export type ItemType = Item['type']

export interface Rect { x: number; y: number; w: number; h: number }
export interface Vec { x: number; y: number }

export const STICKY_COLORS = [
  '#FFF9B1', '#F5D128', '#FF9D48', '#F16C7F', '#FFCEE0', '#EA94BB',
  '#D5F692', '#D0E17A', '#93D275', '#67C6C0', '#A6CCF5', '#7B92FF',
  '#B5A6E5', '#F5F6F8', '#D0D0D0', '#1A1A1A',
] as const

export const SHAPE_FILLS = [
  '#FFFFFF', '#FFF9B1', '#F5D128', '#FF9D48', '#F16C7F', '#FFCEE0',
  '#D5F692', '#93D275', '#67C6C0', '#A6CCF5', '#4262FF', '#B5A6E5',
  '#F5F6F8', '#9B9B9B', '#1A1A1A', 'transparent',
] as const

export const LINE_COLORS = [
  '#1A1A1A', '#9B9B9B', '#4262FF', '#67C6C0', '#93D275', '#F5D128',
  '#FF9D48', '#F16C7F', '#EA94BB', '#B5A6E5', '#FFFFFF', 'transparent',
] as const

export const FONT_SIZES = [8, 10, 11, 12, 14, 18, 24, 29, 36, 48, 59, 72, 98, 144, 190, 288]

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontSize: 24,
  fontFamily: 'Open Sans',
  textColor: '#1A1A1A',
  align: 'center',
  valign: 'middle',
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  autoFit: true,
}

export const BRAND = {
  blue: '#4262FF',
  ink: '#050038',
  guide: '#FF3B6B',
  hover: '#4262FF',
}
