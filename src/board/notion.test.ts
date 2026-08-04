import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import { asDay, asNumber, expand, guessType, headerAt, numbersIn } from './notion'

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

  it('still calls a Turkish money column a number', () => {
    expect(guessType(['1.234', '2.500', '890'])).toBe('number')
    expect(guessType(['1.234,56', '99,90'])).toBe('number')
  })

  it('reads a date written with dots', () => {
    expect(guessType(['03.08.2026', '14.12.2026'])).toBe('date')
  })
})

// The three rows the panel produced by running the old regex. Each one was silently wrong.
describe('which mark is the decimal point', () => {
  it('takes three digits after a dot as a grouping mark', () => {
    expect(numbersIn(['1.234'])).toEqual({ decimal: ',' })
    expect(asNumber('1.234', { decimal: ',' })).toBe(1234)
  })

  it('reads a Turkish decimal instead of dropping the column to text', () => {
    expect(numbersIn(['1.234,56'])).toEqual({ decimal: ',' })
    expect(asNumber('1.234,56', { decimal: ',' })).toBe(1234.56)
    expect(asNumber('1234,56', { decimal: ',' })).toBe(1234.56)
  })

  it('leaves an English column alone', () => {
    expect(numbersIn(['1,234.56', '99.90'])).toEqual({ decimal: '.' })
    expect(asNumber('1,234.56', { decimal: '.' })).toBe(1234.56)
    expect(asNumber('1234.56', { decimal: '.' })).toBe(1234.56)
  })

  it('does not read a leading zero as a thousand', () => {
    expect(numbersIn(['0.500', '0.250'])).toEqual({ decimal: '.' })
    expect(asNumber('0.500', { decimal: '.' })).toBe(0.5)
  })

  it('strips every grouping mark, not the first one', () => {
    expect(asNumber('1.234.567,89', { decimal: ',' })).toBe(1234567.89)
    expect(asNumber('1,234,567.89', { decimal: '.' })).toBe(1234567.89)
  })

  it('is nothing at all when the column is not numbers', () => {
    expect(numbersIn(['1.234', 'Ayşe'])).toBeNull()
    expect(numbersIn([])).toBeNull()
  })
})

describe('where the headings are', () => {
  it('takes row one when row one is the headings', () => {
    expect(headerAt([['Name', 'Fee'], ['Ayşe', '1.200']])).toBe(0)
  })

  it('walks past what the file calls itself', () => {
    expect(headerAt([['2026 Müşteri Listesi'], ['Name', 'Fee'], ['Ayşe', '1.200']])).toBe(1)
    expect(headerAt([['2026 Müşteri Listesi', '', ''], ['Name', 'Fee', 'City'], ['Ayşe', '1.200', 'İzmir']])).toBe(1)
  })

  it('takes row one rather than guess when there is nothing under it', () => {
    expect(headerAt([['Name', 'Fee']])).toBe(0)
    expect(headerAt([])).toBe(0)
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

  it('reads a date written with dots as the day it says', () => {
    expect(asDay('03.08.2026')).toBe('2026-08-03')
    expect(asDay('3.8.2026')).toBe('2026-08-03')
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

describe('what a real export throws at it', () => {
  const bytes = (files: { [path: string]: string }) =>
    zipSync(Object.fromEntries(
      Object.entries(files).map(([path, text]) => [path, strToU8(text)]),
    ))

  it('goes into a zip of zips, which is how a large export arrives', async () => {
    const inner = bytes({ 'Export/Notes 1a2b.md': '# Notes' })
    const outer = zipSync({ 'Part-1.zip': inner })
    const held = await expand([new File([outer as unknown as BlobPart], 'Export.zip')])
    expect(held.map((e) => e.path)).toEqual(['Export/Notes 1a2b.md'])
  })

  it('drops the byte order mark rather than naming a column after it', async () => {
    const held = await expand([new File(['﻿Name,Owner\nOne,Ayse'], 'Plan.csv')])
    expect(held[0].text.startsWith('Name,')).toBe(true)
  })

  it('leaves alone what is neither a page nor a database', async () => {
    const held = await expand([new File([bytes({
      'Export/cover.png': 'not a png',
      'Export/Notes 1a2b.md': '# Notes',
    }) as unknown as BlobPart], 'Export.zip')])
    expect(held).toHaveLength(1)
  })
})
