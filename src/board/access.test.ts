import { afterEach, describe, expect, it } from 'vitest'
import { readOnly, setRole } from './access'
import { createItems, getItems, removeItems } from './doc'
import { makeSticky } from './items'

afterEach(() => {
  setRole(null)
  removeItems(getItems().map((i) => i.id))
})

describe('viewer access', () => {
  it('only the viewer role is read-only', () => {
    for (const role of ['owner', 'editor', null] as const) {
      setRole(role)
      expect(readOnly()).toBe(false)
    }
    setRole('viewer')
    expect(readOnly()).toBe(true)
  })

  it('drops writes from a viewer', () => {
    setRole('viewer')
    createItems([makeSticky(0, 0, '#F0E3B0')])
    expect(getItems()).toHaveLength(0)
  })

  it('lets an editor write', () => {
    setRole('editor')
    createItems([makeSticky(0, 0, '#F0E3B0')])
    expect(getItems()).toHaveLength(1)
  })

  it('drops deletes from a viewer', () => {
    setRole('editor')
    createItems([makeSticky(0, 0, '#F0E3B0')])
    setRole('viewer')
    removeItems(getItems().map((i) => i.id))
    expect(getItems()).toHaveLength(1)
  })
})
