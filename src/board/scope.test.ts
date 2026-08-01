import { describe, expect, it } from 'vitest'
import { inScope } from './scope'
import type { Record as Row } from './records'

const page = (id: string, parent: string | null, project: string | null = null): Row =>
  ({ id, parent_id: parent, project_id: project, kind: 'doc', title: id } as Row)

describe('what a project contains', () => {
  const tree = [
    page('top', null, 'rebuild'),
    page('under', 'top'),
    page('deeper', 'under'),
    page('elsewhere', null, 'launch'),
    page('loose', null),
    // Put somewhere deliberately, inside a page that belongs to another project.
    page('borrowed', 'top', 'launch'),
  ]
  const find = (id: string) => tree.find((r) => r.id === id)!

  it('takes a page that says so itself', () => {
    expect(inScope(find('top'), tree, 'rebuild')).toBe(true)
  })

  it('takes everything under it, however deep, without writing anything down', () => {
    expect(inScope(find('under'), tree, 'rebuild')).toBe(true)
    expect(inScope(find('deeper'), tree, 'rebuild')).toBe(true)
  })

  it('leaves what belongs somewhere else, and what belongs nowhere', () => {
    expect(inScope(find('elsewhere'), tree, 'rebuild')).toBe(false)
    expect(inScope(find('loose'), tree, 'rebuild')).toBe(false)
  })

  it('lets a child keep a project it was deliberately given', () => {
    expect(inScope(find('borrowed'), tree, 'launch')).toBe(true)
    expect(inScope(find('borrowed'), tree, 'rebuild')).toBe(false)
  })

  it('says yes to everything when no project is asked about', () => {
    expect(tree.every((r) => inScope(r, tree, ''))).toBe(true)
  })

  it('does not hang on a page that is somehow its own ancestor', () => {
    const bent = [page('a', 'b'), page('b', 'a')]
    expect(inScope(bent[0], bent, 'rebuild')).toBe(false)
  })
})
