import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => {
  const handlers = new Set<(update: Uint8Array, origin?: unknown) => void>()
  return {
    handlers,
    ydoc: {
      on: vi.fn((_event: string, handler: (update: Uint8Array, origin?: unknown) => void) => {
        handlers.add(handler)
      }),
    },
    user: { id: 'user-1' } as { id: string } | null,
    meta: { name: 'Board', surface: 'paper' } as Record<string, unknown>,
    pullSnapshot: vi.fn(),
    pushSnapshot: vi.fn(),
    snapshotStamp: vi.fn(),
    claimBoard: vi.fn(),
    applyUpdate: vi.fn(),
    loadWorkspace: vi.fn(),
    appendUpdate: vi.fn(),
    pullUpdates: vi.fn(),
    compactUpdates: vi.fn(),
    setForeign: vi.fn(),
  }
})

vi.mock('yjs', () => ({
  applyUpdate: mocked.applyUpdate,
  encodeStateAsUpdate: () => new Uint8Array([1, 2, 3]),
  mergeUpdates: (all: Uint8Array[]) => all[0],
}))
vi.mock('./doc', () => ({
  room: 'board-1',
  ydoc: mocked.ydoc,
  getItems: () => [],
  getMeta: () => mocked.meta,
}))
vi.mock('./access', () => ({ readOnly: () => false, setForeign: mocked.setForeign }))
vi.mock('./storage', () => ({ storagePath: () => null }))
vi.mock('./thumb', () => ({ makeThumb: () => 'thumb' }))
vi.mock('./cloud', () => ({
  claimBoard: mocked.claimBoard,
  pullSnapshot: mocked.pullSnapshot,
  pushSnapshot: mocked.pushSnapshot,
  snapshotStamp: mocked.snapshotStamp,
  sweepImages: vi.fn(),
  readPendingBrief: vi.fn(async () => null),
  clearPendingBrief: vi.fn(async () => false),
  appendUpdate: mocked.appendUpdate,
  pullUpdates: mocked.pullUpdates,
  compactUpdates: mocked.compactUpdates,
  LOG_MAX: 1_048_576,
  NOT_MINE: 'not-mine',
}))
vi.mock('./supabase', () => ({
  getUser: () => mocked.user,
  subscribeAuth: vi.fn(),
  supabase: {},
}))
vi.mock('./workspace', () => ({ loadWorkspace: mocked.loadWorkspace }))

// A save is a chain of awaits now that it reconciles the row before writing it.
const settle = async () => { for (let i = 0; i < 20; i++) await Promise.resolve() }

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  mocked.handlers.clear()
  mocked.user = { id: 'user-1' }
  mocked.meta = { name: 'Board', surface: 'paper' }
  mocked.pullSnapshot.mockReset().mockResolvedValue(null)
  mocked.pushSnapshot.mockReset().mockResolvedValue(null)
  mocked.snapshotStamp.mockReset().mockResolvedValue(null)
  mocked.claimBoard.mockReset().mockResolvedValue(null)
  mocked.applyUpdate.mockReset()
  mocked.loadWorkspace.mockReset().mockResolvedValue({ id: 'workspace-1' })
  mocked.appendUpdate.mockReset().mockResolvedValue(1)
  mocked.pullUpdates.mockReset().mockResolvedValue([])
  mocked.compactUpdates.mockReset().mockResolvedValue(0)
  mocked.setForeign.mockReset()
})

afterEach(() => vi.useRealTimers())

describe('cloud sync', () => {
  it('does not overwrite the cloud when restore fails, then retries the restore', async () => {
    mocked.pullSnapshot
      .mockRejectedValueOnce(new Error('snapshot unavailable'))
      .mockResolvedValueOnce(new Uint8Array([9]))
    const sync = await import('./sync')

    sync.startCloudSync()
    await settle()
    expect(mocked.pushSnapshot).not.toHaveBeenCalled()
    expect(sync.cloudError()).toBe('snapshot unavailable')

    await vi.advanceTimersByTimeAsync(5_000)
    await settle()
    expect(mocked.applyUpdate).toHaveBeenCalledOnce()
    expect(mocked.pushSnapshot).toHaveBeenCalledOnce()
    expect(sync.cloudError()).toBe(null)
  })

  it('keeps a failed save dirty and retries it', async () => {
    mocked.pushSnapshot
      .mockResolvedValueOnce('network down')
      .mockResolvedValueOnce(null)
    const sync = await import('./sync')

    sync.startCloudSync()
    await settle()
    expect(sync.cloudError()).toBe('network down')
    expect(mocked.pushSnapshot).toHaveBeenCalledOnce()

    await vi.advanceTimersByTimeAsync(5_000)
    await settle()
    expect(mocked.pushSnapshot).toHaveBeenCalledTimes(2)
    expect(sync.cloudError()).toBe(null)
  })

  it('does not claim a row for a board nobody has put anything on', async () => {
    mocked.meta = {}
    const sync = await import('./sync')

    sync.startCloudSync()
    await settle()
    expect(mocked.claimBoard).not.toHaveBeenCalled()
    expect(mocked.pushSnapshot).not.toHaveBeenCalled()

    for (const handler of mocked.handlers) handler(new Uint8Array([7]), 'local')
    await vi.advanceTimersByTimeAsync(2_500)
    await settle()
    expect(mocked.claimBoard).not.toHaveBeenCalled()
  })

  it('claims the row as soon as the board has a name', async () => {
    mocked.meta = {}
    const sync = await import('./sync')

    sync.startCloudSync()
    await settle()
    expect(mocked.claimBoard).not.toHaveBeenCalled()

    mocked.meta = { name: 'Quarter plan' }
    for (const handler of mocked.handlers) handler(new Uint8Array([7]), 'local')
    await vi.advanceTimersByTimeAsync(2_500)
    await settle()
    // Claimed once by the log, which cannot write until the row exists, and once by the save,
    // which is what keeps the name and the date on it current. What matters is that neither
    // happened before the board had a name.
    expect(mocked.claimBoard).toHaveBeenCalled()
    expect(mocked.claimBoard.mock.calls.every(([, name]) => name === 'Quarter plan')).toBe(true)
  })

  it('saves an edit that arrives while an earlier save is in flight', async () => {
    let finish!: (value: string | null) => void
    mocked.pushSnapshot.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
    const sync = await import('./sync')

    sync.startCloudSync()
    await settle()
    expect(mocked.pushSnapshot).toHaveBeenCalledOnce()

    for (const handler of mocked.handlers) handler(new Uint8Array([7]), 'local')
    finish(null)
    await settle()
    await vi.advanceTimersByTimeAsync(2_500)
    await settle()
    expect(mocked.pushSnapshot).toHaveBeenCalledTimes(2)
  })
})

describe('what the log no longer has to keep', () => {
  it('drops only what the row holds and the lag has released', async () => {
    const { compactableSeq } = await import('./sync')
    const seen = [
      { seq: 1, at: 1_000 },
      { seq: 2, at: 2_000 },
      { seq: 3, at: 9_000 },
    ]

    expect(compactableSeq(seen, 5_000, 9)).toBe(2)
    // Covered by the row but younger than the lag: a tab that lost the race still has a minute
    // to write it again.
    expect(compactableSeq(seen, 500, 9)).toBe(0)
    // Old enough, but the row this tab just wrote does not contain it.
    expect(compactableSeq(seen, 20_000, 1)).toBe(1)
  })

  it('claims the board before writing anything about it', async () => {
    // The policy on the log asks whether you may write the board, and that is answered from the
    // boards row. Appending first is refused, and a board that cannot log never gets claimed —
    // so it never reaches the cloud and the dashboard files it under this browser.
    const order: string[] = []
    mocked.claimBoard.mockReset().mockImplementation(async () => { order.push('claim'); return null })
    mocked.appendUpdate.mockReset().mockImplementation(async () => { order.push('append'); return 1 })
    const sync = await import('./sync')

    sync.startCloudSync()
    // Typed before the first save finishes, which is when a board is new and the row does not
    // exist yet — the only moment the order matters.
    mocked.handlers.forEach((handler) => handler(new Uint8Array([7])))
    await vi.advanceTimersByTimeAsync(3_000)
    await settle()

    expect(order[0]).toBe('claim')
    expect(order).toContain('append')
    expect(sync.cloudError()).toBe(null)
  })

  it('asks for the row once when the log and the save both need it', async () => {
    // Both found no row and both inserted one; the loser was told the key was taken, which is
    // how a fresh board started answering 23505 instead of saving.
    let finish!: (value: string | null) => void
    mocked.claimBoard.mockReset()
      .mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
      .mockResolvedValue(null)
    const sync = await import('./sync')

    sync.startCloudSync()
    mocked.handlers.forEach((handler) => handler(new Uint8Array([7])))
    await vi.advanceTimersByTimeAsync(2_500)
    await settle()
    expect(mocked.claimBoard).toHaveBeenCalledOnce()

    finish(null)
    await settle()
    expect(sync.cloudError()).toBe(null)
  })

  it('stops asking when the row belongs to another account', async () => {
    // Retrying is asking the same question for ever: the answer will not change until somebody
    // signs in as the other account. The board goes read-only and says so instead.
    mocked.claimBoard.mockReset().mockResolvedValue('not-mine')
    const sync = await import('./sync')

    sync.startCloudSync()
    mocked.handlers.forEach((handler) => handler(new Uint8Array([7])))
    await vi.advanceTimersByTimeAsync(3_000)
    await settle()
    expect(mocked.setForeign).toHaveBeenCalledWith(true)
    const asked = mocked.claimBoard.mock.calls.length

    await vi.advanceTimersByTimeAsync(30_000)
    await settle()
    expect(mocked.claimBoard.mock.calls.length).toBe(asked)
    expect(mocked.appendUpdate).not.toHaveBeenCalled()
    // Nothing to show in the corner: the banner explains it, and a badge saying the save failed
    // would be a second, worse account of the same thing.
    expect(sync.cloudError()).toBe(null)
  })

  it('holds the log while the claim is refused rather than writing what will bounce', async () => {
    mocked.claimBoard.mockReset()
      .mockResolvedValue('new row violates row-level security policy for table "boards"')
    const sync = await import('./sync')

    sync.startCloudSync()
    await settle()
    mocked.handlers.forEach((handler) => handler(new Uint8Array([7])))
    await vi.advanceTimersByTimeAsync(3_000)
    await settle()

    expect(mocked.appendUpdate).not.toHaveBeenCalled()
    expect(sync.cloudError()).toContain('row-level security')
  })
})
