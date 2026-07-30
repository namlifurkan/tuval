import { describe, expect, it } from 'vitest'
import { tokenize } from './code'

const kinds = (line: string, lang: string) =>
  tokenize(line, lang).map((t) => `${t.kind}:${t.text}`)

describe('tokenize', () => {
  it('marks keywords, calls, numbers and strings', () => {
    expect(kinds('const n = fib(42)', 'ts')).toEqual([
      'keyword:const', 'plain: n = ', 'call:fib', 'plain:(', 'number:42', 'plain:)',
    ])
  })

  it('takes the rest of the line as a comment', () => {
    expect(kinds('a = 1 // why not', 'ts').at(-1)).toBe('comment:// why not')
  })

  it('uses the language comment marker', () => {
    expect(kinds('x = 1 # note', 'py').at(-1)).toBe('comment:# note')
    expect(kinds('x = 1 # note', 'ts').at(-1)).not.toBe('comment:# note')
  })

  it('keeps an escaped quote inside the string', () => {
    expect(kinds("s = 'it\\'s'", 'ts')).toContain("string:'it\\'s'")
  })

  it('never loses characters', () => {
    const line = 'export function f(a: number) { return "x" + 1 } // tail'
    expect(tokenize(line, 'ts').map((t) => t.text).join('')).toBe(line)
  })

  it('falls back to plain text for an unknown language', () => {
    expect(kinds('const x', 'txt')).toEqual(['plain:const x'])
  })

  it('merges neighbouring runs of the same kind', () => {
    expect(tokenize('a b c', 'ts')).toHaveLength(1)
  })
})
