import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { asDay, expand, guessType } from './notion'

describe('guessType', () => {
  it('reads the whole column, not the first cell', () => {
    expect(guessType(['1', '2', 'Ayse'])).toBe('text')
    expect(guessType(['1', '2', '3'])).toBe('number')
  })

  it('knows the two date shapes a Notion export writes', () => {
    expect(guessType(['2026-08-14', '2026-09-01'])).toBe('date')
    expect(guessType(['August 14, 2026', 'September 1, 2026'])).toBe('date')
    expect(guessType(['August 14, 2026', 'soon'])).toBe('text')
  })

  it('takes a few values repeated as a set of tags', () => {
    expect(guessType(['Todo', 'Done', 'Todo', 'Done', 'Todo', 'Done'])).toBe('select')
    // Six values, six of them different: those are names, not tags.
    expect(guessType(['a', 'b', 'c', 'd', 'e', 'f'])).toBe('text')
  })

  it('takes yes and no for an answer', () => {
    expect(guessType(['Yes', 'No', 'Yes'])).toBe('checkbox')
  })

  it('is text when there is nothing to go on', () => {
    expect(guessType([])).toBe('text')
    expect(guessType(['', '  '])).toBe('text')
  })
})

describe('asDay', () => {
  it('keeps a day that already is one', () => {
    expect(asDay('2026-08-14')).toBe('2026-08-14')
    expect(asDay('2026-08-14T09:30:00.000Z')).toBe('2026-08-14')
  })

  it('turns a written date into one, without the clock moving it', () => {
    expect(asDay('August 14, 2026')).toBe('2026-08-14')
    expect(asDay('January 1, 2026')).toBe('2026-01-01')
  })

  it('is empty rather than wrong', () => {
    expect(asDay('soon')).toBe('')
    expect(asDay('')).toBe('')
  })
})

describe('expand', () => {
  const zipped = (files: { [path: string]: string }) =>
    new File([zipSync(Object.fromEntries(
      Object.entries(files).map(([path, text]) => [path, strToU8(text)]),
    )) as unknown as BlobPart], 'Export-1a2b.zip')

  it('unpacks a zip and leaves out what is not a page or a database', async () => {
    const held = await expand([zipped({
      'Export-1a2b/Notes 1a2b.md': '# Notes',
      'Export-1a2b/Notes 1a2b/Child 3c4d.md': '# Child',
      'Export-1a2b/Plan 5e6f.csv': 'Name\nOne',
      'Export-1a2b/Plan 5e6f_all.csv': 'Name\nOne',
      'Export-1a2b/cover.png': 'not really a png',
    })])
    expect(held.map((e) => e.path)).toEqual([
      'Export-1a2b/Notes 1a2b.md',
      'Export-1a2b/Plan 5e6f.csv',
      'Export-1a2b/Notes 1a2b/Child 3c4d.md',
    ])
  })

  it('puts every parent before its children', async () => {
    const held = await expand([zipped({
      'a/b/c/deep.md': '# Deep',
      'a/top.md': '# Top',
      'a/b/mid.md': '# Mid',
    })])
    expect(held.map((e) => e.path)).toEqual(['a/top.md', 'a/b/mid.md', 'a/b/c/deep.md'])
  })

  it('takes a loose file as it comes', async () => {
    const held = await expand([new File(['Name\nOne'], 'Plan.csv')])
    expect(held).toEqual([{ path: 'Plan.csv', text: 'Name\nOne' }])
  })
})
