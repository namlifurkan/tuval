import { describe, expect, it } from 'vitest'
import { decodePageDoc, hex } from './page'

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
