import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { bodyOf } from './notion'
import { FRAGMENT } from './page'
import { append } from './pageBody'

const read = (doc: Y.Doc) => doc.getXmlFragment(FRAGMENT).toString()

const holding = (markdown: string) => {
  const doc = new Y.Doc()
  const made = bodyOf(markdown)
  if (made) append(doc, made.update)
  return doc
}

describe('folding waiting text into a page', () => {
  it('makes an empty page the text', () => {
    expect(read(holding('# Hello\n\nA paragraph.'))).toContain('>Hello</heading>')
    expect(read(holding('# Hello\n\nA paragraph.'))).toContain('>A paragraph.</paragraph>')
  })

  it('adds to the end of a page somebody has already written in', () => {
    const doc = holding('First.')
    append(doc, bodyOf('Second.')!.update)

    const xml = read(doc)
    expect(xml.indexOf('First.')).toBeLessThan(xml.indexOf('Second.'))
    // One block group, not two: the editor's schema has no place for a second.
    expect(xml.match(/<blockgroup>/g)).toHaveLength(1)
    expect(xml.match(/<blockcontainer /g)).toHaveLength(2)
  })

  it('keeps headings and lists rather than flattening them', () => {
    const doc = holding('Opening.')
    append(doc, bodyOf('## Findings\n\n- one\n- two')!.update)

    const xml = read(doc)
    expect(xml).toContain('level="2"')
    expect(xml.match(/<bulletlistitem /g)).toHaveLength(2)
  })

  it('appends again, so a second visit does not overwrite the first', () => {
    const doc = holding('One.')
    append(doc, bodyOf('Two.')!.update)
    append(doc, bodyOf('Three.')!.update)

    const xml = read(doc)
    expect(xml.match(/<blockcontainer /g)).toHaveLength(3)
    expect(xml.indexOf('Two.')).toBeLessThan(xml.indexOf('Three.'))
  })
})
