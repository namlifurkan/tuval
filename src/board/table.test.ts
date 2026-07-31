import { describe, expect, it } from 'vitest'
import { addCol, addRow, anchorOf, dropCol, growMerge, isCovered, makeTable, remapMerges, spanRect, splitMerge } from './items'
import type { TableItem } from './types'

const table = (): TableItem => makeTable(0, 0, 3, 3)

describe('merged cells', () => {
  it('covers the cells it swallows and redirects them to the anchor', () => {
    const t = { ...table(), ...growMerge(table(), 0, 0, 'col') } as TableItem
    expect(t.merges).toEqual([[0, 0, 1, 2]])
    expect(isCovered(t, 0, 1)).toBe(true)
    expect(anchorOf(t, 0, 1)).toEqual([0, 0])
    expect(isCovered(t, 0, 2)).toBe(false)
  })

  it('spans the full width of what it covers', () => {
    const t = { ...table(), ...growMerge(table(), 0, 0, 'col') } as TableItem
    expect(spanRect(t, 0, 0).w).toBeCloseTo(spanRect(table(), 0, 0).w * 2)
  })

  it('keeps the text of every cell it takes over', () => {
    const base = table()
    base.cells[0][0] = 'Q1'
    base.cells[0][1] = 'Q2'
    const t = { ...base, ...growMerge(base, 0, 0, 'col') } as TableItem
    expect(t.cells[0][0]).toBe('Q1 Q2')
    expect(t.cells[0][1]).toBe('')
  })

  it('refuses to grow past the edge', () => {
    expect(growMerge(table(), 0, 2, 'col')).toBe(null)
    expect(growMerge(table(), 2, 0, 'row')).toBe(null)
  })

  it('grows from any cell of the block, not just its corner', () => {
    const t = { ...table(), ...growMerge(table(), 0, 0, 'col') } as TableItem
    const wider = growMerge(t, 0, 1, 'col')
    expect(wider?.merges).toEqual([[0, 0, 1, 3]])
  })

  it('splits back into plain cells', () => {
    const t = { ...table(), ...growMerge(table(), 1, 1, 'row') } as TableItem
    const plain = { ...t, ...splitMerge(t, 2, 1) } as TableItem
    expect(plain.merges).toEqual([])
    expect(isCovered(plain, 2, 1)).toBe(false)
  })
})

describe('merges when rows and columns move', () => {
  it('shifts a block that sits after the insertion', () => {
    expect(remapMerges([[1, 0, 1, 2]], 'row', 0, 1)).toEqual([[2, 0, 1, 2]])
  })

  it('stretches a block the insertion lands inside', () => {
    expect(remapMerges([[0, 0, 1, 3]], 'col', 1, 1)).toEqual([[0, 0, 1, 4]])
  })

  it('shrinks a block a removal cuts into', () => {
    expect(remapMerges([[0, 0, 1, 3]], 'col', 1, -1)).toEqual([[0, 0, 1, 2]])
  })

  it('drops a block a removal reduces to a single cell', () => {
    expect(remapMerges([[0, 0, 1, 2]], 'col', 0, -1)).toEqual([])
  })

  it('carries them through the real row and column operations', () => {
    const t = { ...table(), ...growMerge(table(), 0, 0, 'col') } as TableItem
    expect((addRow(t, 0) as TableItem).merges).toEqual([[1, 0, 1, 2]])
    expect((addCol(t, 0) as TableItem).merges).toEqual([[0, 1, 1, 2]])
    expect((dropCol(t, 0) as TableItem).merges).toEqual([])
  })
})
