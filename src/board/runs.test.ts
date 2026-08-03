import { describe, expect, it, vi } from 'vitest'

vi.mock('./supabase', () => ({ supabase: null }))
vi.mock('./workspace', () => ({ getWorkspace: () => null }))
vi.mock('./records', () => ({ patchRecord: vi.fn() }))

const { spanOf } = await import('./runs')

const run = (started: string, ended: string) => ({
  run: 'r', via: null, started, ended, records: 1, writes: 1,
})

describe('how long a run took', () => {
  it('says it in the unit somebody would use', () => {
    expect(spanOf(run('2026-08-03T00:00:00Z', '2026-08-03T00:00:00.400Z'))).toBe('a moment')
    expect(spanOf(run('2026-08-03T00:00:00Z', '2026-08-03T00:00:20Z'))).toBe('20s')
    expect(spanOf(run('2026-08-03T00:00:00Z', '2026-08-03T00:14:00Z'))).toBe('14m')
    expect(spanOf(run('2026-08-03T00:00:00Z', '2026-08-03T02:05:00Z'))).toBe('2h 5m')
  })

  it('does not invent a duration out of a broken stamp', () => {
    expect(spanOf(run('not a date', '2026-08-03T00:14:00Z'))).toBe('a moment')
  })
})
