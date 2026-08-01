import { describe, expect, it, vi } from 'vitest'
import { ourSlashItems } from './pageMenu'

// The menu itself cannot be driven from a test, and the browser's synthetic keys do not open it
// either. What can be checked is the part that would be wrong: which blocks the items make.
const editor = () => {
  const insertBlocks = vi.fn()
  const held = { insertBlocks, getTextCursorPosition: () => ({ block: { id: 'here' } }) }
  return { held, insertBlocks }
}

describe('ourSlashItems', () => {
  it('offers every block the schema was given', () => {
    const { held } = editor()
    const made = ourSlashItems(held).map((item) => {
      const calls: object[] = []
      const spy = { ...held, insertBlocks: (blocks: object[]) => calls.push(blocks[0]) }
      ourSlashItems(spy).find((i) => i.title === item.title)!.onItemClick()
      return calls[0] as { type: string; props?: { level?: number; isToggleable?: boolean } }
    })

    expect(made.map((b) => b.type)).toEqual([
      'callout', 'equation', 'toc', 'bookmark', 'embed', 'heading', 'heading', 'heading',
    ])
  })

  it('makes a toggle heading rather than a block of its own', () => {
    const { held, insertBlocks } = editor()
    const items = ourSlashItems(held).filter((i) => i.aliases.some((a) => a.startsWith('toggle')))
    expect(items).toHaveLength(3)
    items[1].onItemClick()
    expect(insertBlocks).toHaveBeenCalledWith(
      [{ type: 'heading', props: { level: 2, isToggleable: true } }],
      { id: 'here' },
      'after',
    )
  })

  it('puts every item under one heading in the menu', () => {
    const { held } = editor()
    expect(new Set(ourSlashItems(held).map((i) => i.group)).size).toBe(1)
  })
})
