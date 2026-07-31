import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { MENTION, mentionsIn, peopleIn } from './mention'

// A mention as the editor writes it: one element in the text, carrying whichever id applies.
function docWith(marks: { pageId?: string; userId?: string }[]): Y.Doc {
  const doc = new Y.Doc()
  const paragraph = new Y.XmlElement('paragraph')
  const text = new Y.XmlText()
  doc.getXmlFragment('prosemirror').insert(0, [paragraph])
  paragraph.insert(0, [text])
  marks.forEach((mark, at) => {
    const held = new Y.XmlElement(MENTION)
    for (const [key, value] of Object.entries(mark)) held.setAttribute(key, value)
    text.insertEmbed(at, held)
  })
  return doc
}

describe('mentions', () => {
  it('tells a page named from a person named', () => {
    const doc = docWith([
      { pageId: 'page-1', userId: '' },
      { pageId: '', userId: 'user-1' },
      { pageId: 'page-2', userId: '' },
    ])
    expect([...mentionsIn(doc)]).toEqual(['page-1', 'page-2'])
    expect([...peopleIn(doc)]).toEqual(['user-1'])
  })

  it('names each one once however often it appears', () => {
    const doc = docWith([{ userId: 'user-1' }, { userId: 'user-1' }])
    expect([...peopleIn(doc)]).toEqual(['user-1'])
  })

  it('finds nothing in a document with nothing in it', () => {
    const doc = new Y.Doc()
    expect(peopleIn(doc).size).toBe(0)
    expect(mentionsIn(doc).size).toBe(0)
  })
})
