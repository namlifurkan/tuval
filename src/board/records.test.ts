import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  rows: new Map<string, unknown[]>(),
  ranges: [] as Array<[number, number]>,
  workspace: { id: 'workspace-1' } as { id: string } | null,
  workspaceListener: null as (() => void) | null,
  change: null as ((payload: { new: Record<string, unknown>; old: Record<string, unknown> }) => void) | null,
  from: vi.fn(),
  removeChannel: vi.fn(),
}))

function query() {
  let kind = ''
  const builder = {
    select: () => builder,
    eq: (column: string, value: string) => {
      if (column === 'kind') kind = value
      return builder
    },
    is: () => builder,
    order: () => builder,
    range: async (from: number, to: number) => {
      mocked.ranges.push([from, to])
      return { data: (mocked.rows.get(kind) ?? []).slice(from, to + 1), error: null }
    },
  }
  return builder
}

vi.mock('./supabase', () => ({
  getUser: () => ({ id: 'user-1' }),
  supabase: {
    from: mocked.from,
    rpc: vi.fn(),
    removeChannel: mocked.removeChannel,
    channel: vi.fn(() => {
      const channel = {
        on: (_type: string, _filter: unknown, callback: typeof mocked.change) => {
          mocked.change = callback
          return channel
        },
        subscribe: () => channel,
      }
      return channel
    }),
  },
}))
vi.mock('./workspace', () => ({
  getWorkspace: () => mocked.workspace,
  subscribeWorkspace: (listener: () => void) => {
    mocked.workspaceListener = listener
    return () => { mocked.workspaceListener = null }
  },
}))
vi.mock('./cloud', () => ({ TRASH_DAYS: 30 }))

const row = (id: number, kind: string) => ({ id: `${kind}-${id}`, kind, position: id })

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  mocked.rows.clear()
  mocked.ranges.length = 0
  mocked.workspace = { id: 'workspace-1' }
  mocked.workspaceListener = null
  mocked.change = null
  mocked.from.mockReset().mockImplementation(() => query())
  mocked.removeChannel.mockReset()
})

afterEach(() => vi.useRealTimers())

describe('record loading', () => {
  it('paginates past the server row cap with deterministic ranges', async () => {
    mocked.rows.set('issue', Array.from({ length: 1_201 }, (_, i) => row(i, 'issue')))
    const records = await import('./records')

    await records.loadRecords('issue')

    expect(records.getRecords('issue')).toHaveLength(1_201)
    expect(mocked.ranges).toEqual([[0, 499], [500, 999], [1000, 1499]])
  })

  it('keeps pages and databases in separate caches before merging the tree', async () => {
    mocked.rows.set('doc', [row(1, 'doc'), row(2, 'doc')])
    mocked.rows.set('database', [row(3, 'database')])
    const records = await import('./records')

    await records.loadPages()

    expect(records.getRecords('doc')).toHaveLength(2)
    expect(records.getRecords('database')).toHaveLength(1)
    expect(records.getPages()).toHaveLength(3)
  })

  it('refreshes the affected cache after a remote record change', async () => {
    mocked.rows.set('issue', [row(1, 'issue')])
    const records = await import('./records')
    await records.loadRecords('issue')
    records.startRecordSync()

    mocked.rows.set('issue', [row(1, 'issue'), row(2, 'issue')])
    mocked.change?.({ new: { kind: 'issue' }, old: {} })
    await vi.advanceTimersByTimeAsync(150)

    expect(records.getRecords('issue')).toHaveLength(2)
  })
})
