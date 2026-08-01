import { Schema } from 'prosemirror-model'
import { describe, expect, it } from 'vitest'
import { findIn } from './find'

// The smallest schema that has the two things the position maths can trip over: a block boundary
// and an inline chip that takes up a position without holding any text.
const schema = new Schema({
  nodes: {
    doc: { content: 'block+' },
    paragraph: { group: 'block', content: 'inline*' },
    mention: { group: 'inline', inline: true, atom: true },
    text: { group: 'inline' },
  },
})

const { doc, paragraph, mention, text } = {
  doc: (...blocks: never[]) => schema.node('doc', null, blocks),
  paragraph: (...inline: never[]) => schema.node('paragraph', null, inline) as never,
  mention: () => schema.node('mention') as never,
  text: (s: string) => schema.text(s) as never,
}

const said = (d: ReturnType<typeof doc>, hit: { from: number; to: number }) =>
  d.textBetween(hit.from, hit.to)

describe('findIn', () => {
  it('finds every occurrence and points at the right characters', () => {
    const d = doc(paragraph(text('bar and bar')), paragraph(text('one bar')))
    const hits = findIn(d, 'bar')
    expect(hits).toHaveLength(3)
    expect(hits.map((h) => said(d, h))).toEqual(['bar', 'bar', 'bar'])
  })

  it('ignores case unless asked not to', () => {
    const d = doc(paragraph(text('Bar bar')))
    expect(findIn(d, 'bar')).toHaveLength(2)
    expect(findIn(d, 'bar', true)).toHaveLength(1)
  })

  it('does not match across a paragraph break', () => {
    const d = doc(paragraph(text('ab')), paragraph(text('cd')))
    expect(findIn(d, 'bc')).toEqual([])
  })

  it('counts positions past a chip rather than past the letters', () => {
    const d = doc(paragraph(text('Q3 '), mention(), text(' Q3')))
    const hits = findIn(d, 'Q3')
    expect(hits).toHaveLength(2)
    expect(hits.map((h) => said(d, h))).toEqual(['Q3', 'Q3'])
  })

  it('refuses a phrase that a chip is sitting in the middle of', () => {
    const d = doc(paragraph(text('Q3'), mention(), text('Q4')))
    expect(findIn(d, 'Q3Q4')).toEqual([])
  })
})
