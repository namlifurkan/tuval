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
    pullSnapshot: vi.fn(),
    pushSnapshot: vi.fn(),
    snapshotStamp: vi.fn(),
    claimBoard: vi.fn(),
    applyUpdate: vi.fn(),
    loadWorkspace: vi.fn(),
  }
})

vi.mock('yjs', () => ({
  applyUpdate: mocked.applyUpdate,
  encodeStateAsUpdate: () => new Uint8Array([1, 2, 3]),
}))
vi.mock('./doc', () => ({
  room: 'board-1',
  ydoc: mocked.ydoc,
  getItems: () => [],
  getMeta: () => ({ name: 'Board', surface: 'paper' }),
}))
vi.mock('./access', () => ({ readOnly: () => false }))
vi.mock('./storage', () => ({ storagePath: () => null }))
vi.mock('./thumb', () => ({ makeThumb: () => 'thumb' }))
vi.mock('./cloud', () => ({
  claimBoard: mocked.claimBoard,
  pullSnapshot: mocked.pullSnapshot,
  pushSnapshot: mocked.pushSnapshot,
  snapshotStamp: mocked.snapshotStamp,
  sweepImages: vi.fn(),
}))
vi.mock('./supabase', () => ({
  getUser: () => mocked.user,
  subscribeAuth: vi.fn(),
  supabase: {},
}))
vi.mock('./workspace', () => ({ loadWorkspace: mocked.loadWorkspace }))

// A save is a chain of awaits now that it reconciles the row before writing it.
const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve() }

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  mocked.handlers.clear()
  mocked.user = { id: 'user-1' }
  mocked.pullSnapshot.mockReset().mockResolvedValue(null)
  mocked.pushSnapshot.mockReset().mockResolvedValue(null)
  mocked.snapshotStamp.mockReset().mockResolvedValue(null)
  mocked.claimBoard.mockReset().mockResolvedValue(null)
  mocked.applyUpdate.mockReset()
  mocked.loadWorkspace.mockReset().mockResolvedValue({ id: 'workspace-1' })
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
