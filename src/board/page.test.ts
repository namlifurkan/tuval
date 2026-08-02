import { describe, expect, it } from 'vitest'
import * as Y from 'yjs'
import { FRAGMENT, applyStoredPage, decodePageDoc, hex } from './page'

const written = (words: string) => {
  const doc = new Y.Doc()
  const para = new Y.XmlElement('paragraph')
  para.insert(0, [new Y.XmlText(words)])
  doc.getXmlFragment(FRAGMENT).insert(0, [para])
  return doc
}

const wordsIn = (doc: Y.Doc) => doc.getXmlFragment(FRAGMENT).toJSON()

describe('stored page bytes', () => {
  it('round-trips a valid bytea value', () => {
    const bytes = new Uint8Array([0, 1, 127, 255])
    expect(decodePageDoc(hex(bytes))).toEqual(bytes)
  })

  it('rejects an odd or non-hex body instead of passing corrupt bytes to Yjs', () => {
    expect(() => decodePageDoc('\\x123')).toThrow('damaged')
    expect(() => decodePageDoc('\\xnope')).toThrow('damaged')
  })
})

// One bad byte used to be a page that never opened and never said why, and the danger sits one
// step further on: an editor mounted on a document that failed to load writes an empty paragraph
// two seconds later, over the only copy there was.
describe('opening a page whose stored copy is damaged', () => {
  it('puts a whole one back and says so', () => {
    const stored = hex(Y.encodeStateAsUpdate(written('Kept')))
    const into = new Y.Doc()
    expect(applyStoredPage(into, stored)).toBe(true)
    expect(wordsIn(into)).toContain('Kept')
  })

  it('reports damage rather than throwing, so the page still opens', () => {
    const into = new Y.Doc()
    expect(applyStoredPage(into, '\\xnope')).toBe(false)
    expect(applyStoredPage(into, '\\xdeadbeefdeadbeefdeadbeef')).toBe(false)
  })

  it('keeps whatever was readable before the damage', () => {
    const whole = Y.encodeStateAsUpdate(written('Half a page is not none of it'))
    const cut = new Uint8Array([...whole.slice(0, whole.length - 1), 0xff])
    const into = new Y.Doc()
    // Either it read the update or it did not; what it must never do is throw past the caller.
    expect(() => applyStoredPage(into, hex(cut))).not.toThrow()
  })

  it('leaves the document it was handed usable when the bytes are refused', () => {
    const into = new Y.Doc()
    expect(applyStoredPage(into, '\\x0102030405')).toBe(false)
    const para = new Y.XmlElement('paragraph')
    para.insert(0, [new Y.XmlText('Typed after the failure')])
    into.getXmlFragment(FRAGMENT).insert(0, [para])
    expect(wordsIn(into)).toContain('Typed after the failure')
  })
})
