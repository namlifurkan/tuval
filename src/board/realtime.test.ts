import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (message: { payload: unknown } | { key: string }) => void

const mocked = vi.hoisted(() => ({
  user: { id: 'user-1' } as { id: string } | null,
  channels: [] as Array<{
    send: ReturnType<typeof vi.fn>
    handlers: Map<string, Handler>
    subscribed?: (status: string) => void
    unsubscribe: ReturnType<typeof vi.fn>
  }>,
  applyUpdate: vi.fn(),
  requestRender: vi.fn(),
}))

vi.mock('yjs', () => ({
  applyUpdate: mocked.applyUpdate,
  encodeStateAsUpdate: () => new Uint8Array([3]),
  encodeStateVector: () => new Uint8Array([1]),
  mergeUpdates: (updates: Uint8Array[]) => updates[0],
}))
vi.mock('y-protocols/awareness', () => ({
  applyAwarenessUpdate: vi.fn(),
  encodeAwarenessUpdate: () => new Uint8Array([2]),
  removeAwarenessStates: vi.fn(),
}))
vi.mock('./doc', () => ({
  room: 'board-1',
  provider: null,
  ydoc: { on: vi.fn() },
  awareness: {
    clientID: 42,
    on: vi.fn(),
  },
}))
vi.mock('./store', () => ({ requestRender: mocked.requestRender }))
vi.mock('./supabase', () => ({
  getUser: () => mocked.user,
  subscribeAuth: vi.fn(),
  supabase: {
    realtime: { setAuth: vi.fn() },
    channel: vi.fn(() => {
      const channel = {
        send: vi.fn(),
        handlers: new Map<string, Handler>(),
        subscribed: undefined as ((status: string) => void) | undefined,
        unsubscribe: vi.fn(),
        track: vi.fn(),
        presenceState: vi.fn(() => ({})),
        on(type: string, filter: { event: string }, handler: Handler) {
          this.handlers.set(`${type}:${filter.event}`, handler)
          return this
        },
        subscribe(handler: (status: string) => void) {
          this.subscribed = handler
          return this
        },
      }
      mocked.channels.push(channel)
      return channel
    }),
  },
}))

beforeEach(() => {
  vi.useFakeTimers()
  vi.resetModules()
  mocked.user = { id: 'user-1' }
  mocked.channels.length = 0
  mocked.applyUpdate.mockReset()
  mocked.requestRender.mockReset()
})

afterEach(() => vi.useRealTimers())

describe('realtime transport', () => {
  it('marks a connection live and reconnects after a channel error', async () => {
    const realtime = await import('./realtime')
    realtime.startRealtime()
    const first = mocked.channels[0]

    first.subscribed?.('SUBSCRIBED')
    expect(realtime.realtimeOn()).toBe(true)
    expect(first.send).toHaveBeenCalled()

    first.subscribed?.('CHANNEL_ERROR')
    expect(realtime.realtimeOn()).toBe(false)
    await vi.advanceTimersByTimeAsync(1_000)
    expect(mocked.channels).toHaveLength(2)
  })

  it('requests a state-vector repair when one chunk never arrives', async () => {
    const realtime = await import('./realtime')
    realtime.startRealtime()
    const channel = mocked.channels[0]
    channel.subscribed?.('SUBSCRIBED')
    channel.send.mockClear()

    channel.handlers.get('broadcast:y')?.({
      payload: { k: 'u', d: 'AQ==', id: 'partial', i: 0, n: 2 },
    })
    await vi.advanceTimersByTimeAsync(2_000)

    expect(channel.send).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ k: 'sv', r: 1 }),
    }))
  })

  it('periodically reconciles even when an entire broadcast was dropped', async () => {
    const realtime = await import('./realtime')
    realtime.startRealtime()
    const channel = mocked.channels[0]
    channel.subscribed?.('SUBSCRIBED')
    channel.send.mockClear()

    await vi.advanceTimersByTimeAsync(15_000)
    expect(channel.send).toHaveBeenCalledWith(expect.objectContaining({
      payload: expect.objectContaining({ k: 'sv', r: 1 }),
    }))
  })
})
