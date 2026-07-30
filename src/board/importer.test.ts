import { describe, expect, it } from 'vitest'
import { parseBrief } from './importer'

const brief = `# Checkout redesign

## Discovery

Owner: Ada, Mina

- [Decision] Ship guest checkout first
- Payment errors are not explained
  second line of the same note

## Build

\`\`\`ts
export function verify(token: string) {
  return true
}
\`\`\`

| Step | Owner |
| --- | --- |
| Address | Ada |
| Payment | Mina |

## Flow

\`\`\`mermaid
flowchart TD
  n1["Ship guest checkout first"]
  n2["Payment errors are not explained"]
  n1 -- fix first --> n2
\`\`\`
`

describe('parseBrief', () => {
  const parsed = parseBrief(brief)

  it('takes the first h1 as the title', () => {
    expect(parsed.title).toBe('Checkout redesign')
  })

  it('makes a section per heading and keeps flow out of them', () => {
    expect(parsed.sections.map((s) => s.title)).toEqual(['Discovery', 'Build'])
  })

  it('reads an owner line without turning it into a note', () => {
    expect(parsed.sections[0].owners).toEqual(['Ada', 'Mina'])
    expect(parsed.sections[0].nodes.every((n) => !n.text.startsWith('Owner'))).toBe(true)
  })

  it('lifts a bracketed status into a label', () => {
    expect(parsed.sections[0].nodes[0]).toMatchObject({
      kind: 'sticky', label: 'Decision', text: 'Ship guest checkout first',
    })
  })

  it('folds an indented continuation into the same note', () => {
    expect(parsed.sections[0].nodes[1].text).toBe(
      'Payment errors are not explained\nsecond line of the same note',
    )
  })

  it('keeps fenced code whole, with its language', () => {
    const code = parsed.sections[1].nodes.find((n) => n.kind === 'code')
    expect(code?.lang).toBe('ts')
    expect(code?.text).toContain('export function verify')
    expect(code?.text).not.toContain('```')
  })

  it('reads a table and drops the divider row', () => {
    const table = parsed.sections[1].nodes.find((n) => n.kind === 'table')
    expect(table?.rows).toEqual([['Step', 'Owner'], ['Address', 'Ada'], ['Payment', 'Mina']])
  })

  it('reads mermaid nodes and edges', () => {
    expect(parsed.labels.get('n1')).toBe('Ship guest checkout first')
    expect(parsed.edges).toEqual([{ from: 'n1', to: 'n2', label: 'fix first' }])
  })

  it('recognises a Turkish flow heading too', () => {
    const tr = parseBrief('## Akış\n\n```mermaid\nflowchart TD\n  a --> b\n```')
    expect(tr.edges).toHaveLength(1)
    expect(tr.sections).toHaveLength(0)
  })

  it('survives an empty document', () => {
    const empty = parseBrief('')
    expect(empty.sections).toEqual([])
    expect(empty.edges).toEqual([])
  })

  it('keeps loose text when there is no heading', () => {
    const loose = parseBrief('- one\n- two')
    expect(loose.sections[0].nodes).toHaveLength(2)
  })
})
