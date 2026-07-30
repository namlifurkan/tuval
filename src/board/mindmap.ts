import { t } from '../i18n'
import { createItems, getIndex, getItems, patchItems } from './doc'
import { makeConnector, makeShape } from './items'
import type { Id, Item, ShapeItem } from './types'
import { DEFAULT_TEXT_STYLE } from './types'

export const NODE_W = 220
export const NODE_H = 68
const H_GAP = 90
const V_GAP = 22

const LEVEL_FILL = ['#3E5C93', '#7FA5BE', '#CBD79A', '#F0E3B0', '#E7B7B4']

export const isNode = (i: Item): i is ShapeItem => i.type === 'shape' && i.mindParent !== undefined

export function childrenOfNode(id: Id): ShapeItem[] {
  return getItems().filter((i): i is ShapeItem => isNode(i) && i.mindParent === id)
}

export function rootOf(id: Id): Id {
  const index = getIndex()
  let current = index.get(id)
  while (current && isNode(current) && current.mindParent) {
    const parent = index.get(current.mindParent)
    if (!parent) break
    current = parent
  }
  return current?.id ?? id
}

function subtreeHeight(id: Id): number {
  const kids = childrenOfNode(id)
  const self = getIndex().get(id)?.h ?? NODE_H
  if (!kids.length) return self
  const total = kids.reduce((sum, k) => sum + subtreeHeight(k.id), 0) + (kids.length - 1) * V_GAP
  return Math.max(self, total)
}

export function layoutMindmap(rootId: Id) {
  const index = getIndex()
  const root = index.get(rootId)
  if (!root) return
  const patches: [Id, Record<string, unknown>][] = []

  const place = (id: Id, x: number, centerY: number, depth: number) => {
    const item = index.get(id)
    if (!item) return
    patches.push([id, {
      x,
      y: centerY - item.h / 2,
      fill: depth === 0 ? LEVEL_FILL[0] : LEVEL_FILL[Math.min(depth, LEVEL_FILL.length - 1)],
      textColor: depth === 0 ? '#FCFBF8' : '#1F1D1A',
    }])
    const kids = childrenOfNode(id)
    if (!kids.length) return
    const heights = kids.map((k) => subtreeHeight(k.id))
    const total = heights.reduce((a, b) => a + b, 0) + (kids.length - 1) * V_GAP
    let cursor = centerY - total / 2
    kids.forEach((kid, i) => {
      place(kid.id, x + item.w + H_GAP, cursor + heights[i] / 2, depth + 1)
      cursor += heights[i] + V_GAP
    })
  }

  place(rootId, root.x, root.y + root.h / 2, 0)
  if (patches.length) patchItems(patches)
}

export function makeMindRoot(x: number, y: number): ShapeItem {
  const node = makeShape(x - NODE_W / 2, y - NODE_H / 2, NODE_W, NODE_H, {
    kind: 'roundRect',
    fill: LEVEL_FILL[0],
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
  }, { ...DEFAULT_TEXT_STYLE, fontSize: 20, bold: true, textColor: '#FCFBF8' })
  node.mindParent = null
  node.text = t('Main idea')
  return node
}

export function addMindNode(parentId: Id, asSibling: boolean): Id | null {
  const index = getIndex()
  const anchor = index.get(parentId)
  if (!anchor || !isNode(anchor)) return null
  const parent = (asSibling ? anchor.mindParent : parentId) ?? null
  if (asSibling && !parent) return addMindNode(parentId, false)
  const target = parent ? index.get(parent) : null
  if (!target) return null

  const node = makeShape(target.x + target.w + H_GAP, target.y, NODE_W, NODE_H, {
    kind: 'roundRect',
    fill: LEVEL_FILL[1],
    stroke: 'transparent',
    strokeWidth: 0,
    strokeStyle: 'solid',
  }, { ...DEFAULT_TEXT_STYLE, fontSize: 18 })
  node.mindParent = parent

  const link = makeConnector(
    { itemId: parent, anchor: 'right', x: 0, y: 0 },
    { itemId: node.id, anchor: 'left', x: 0, y: 0 },
    { shape: 'curved', stroke: '#8A867C', strokeWidth: 2, strokeStyle: 'solid', capStart: 'none', capEnd: 'none' },
  )
  createItems([node, link])
  layoutMindmap(rootOf(node.id))
  return node.id
}
