import { describe, expect, it } from 'vitest'
import { isEmptyQuestion, matches, NO_RULES } from './collections'
import type { Record as Row } from './records'

const day = (offset: number) => {
  const now = new Date()
  const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, 9)
  return at.toISOString()
}

const row = (over: Partial<Row> = {}): Row => ({
  id: 'r', kind: 'doc', title: 'Launch plan', status: null, assignee: null, due_at: null,
  ...over,
} as Row)

describe('collection rules', () => {
  it('matches everything when nothing is asked', () => {
    expect(matches(row(), NO_RULES)).toBe(true)
    expect(isEmptyQuestion(NO_RULES)).toBe(true)
  })

  it('narrows by kind and by status', () => {
    expect(matches(row({ kind: 'issue' }), { ...NO_RULES, kinds: ['doc'] })).toBe(false)
    expect(matches(row({ kind: 'doc' }), { ...NO_RULES, kinds: ['doc', 'issue'] })).toBe(true)
    expect(matches(row(), { ...NO_RULES, status: ['todo'] })).toBe(false)
    expect(matches(row({ status: 'todo' }), { ...NO_RULES, status: ['todo', 'doing'] })).toBe(true)
  })

  it('reads the title without minding case or edges', () => {
    expect(matches(row(), { ...NO_RULES, title: 'LAUNCH' })).toBe(true)
    expect(matches(row(), { ...NO_RULES, title: '  plan ' })).toBe(true)
    expect(matches(row(), { ...NO_RULES, title: 'retro' })).toBe(false)
  })

  it('calls a page late only once its day has passed', () => {
    const late = { ...NO_RULES, due: 'overdue' as const }
    expect(matches(row({ due_at: day(-1) }), late)).toBe(true)
    // Due today is not late. Counting from now rather than from midnight would have made it so
    // from the moment the working day started.
    expect(matches(row({ due_at: day(0) }), late)).toBe(false)
    expect(matches(row({ due_at: null }), late)).toBe(false)
  })

  it('takes the week as the seven days ahead, not the seven behind', () => {
    const soon = { ...NO_RULES, due: 'week' as const }
    expect(matches(row({ due_at: day(3) }), soon)).toBe(true)
    expect(matches(row({ due_at: day(9) }), soon)).toBe(false)
    expect(matches(row({ due_at: day(-2) }), soon)).toBe(false)
  })
})
