import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  user: { id: 'furkan' } as { id: string } | null,
  owned: [] as unknown[],
  joined: [] as unknown[],
  byId: new Map<string, unknown>(),
  ensured: '' as string,
  from: vi.fn(),
  rpc: vi.fn(),
}))

vi.mock('./supabase', () => ({
  getUser: () => mocked.user,
  subscribeAuth: vi.fn(),
  supabase: {
    from: mocked.from,
    rpc: mocked.rpc,
  },
}))

const workspace = (id: string, name: string) => ({
  id,
  name,
  slug: name.toLowerCase(),
  owner: 'owner',
  prefix: name.slice(0, 5).toUpperCase(),
})

beforeEach(() => {
  localStorage.clear()
  mocked.user = { id: 'furkan' }
  mocked.owned = []
  mocked.joined = []
  mocked.byId = new Map()
  mocked.ensured = ''
  mocked.rpc.mockReset().mockImplementation(async (name: string) => ({
    data: name === 'ensure_workspace' ? mocked.ensured : null,
  }))
  mocked.from.mockReset().mockImplementation((table: string) => ({
    select: () => ({
      eq: (column: string, value: string) => {
        if (table === 'workspaces' && column === 'owner') {
          return Promise.resolve({ data: mocked.owned })
        }
        if (table === 'workspaces' && column === 'id') {
          return { maybeSingle: async () => ({ data: mocked.byId.get(value) ?? null }) }
        }
        if (table === 'workspace_members' && column === 'user_id') {
          return { neq: async () => ({ data: mocked.joined }) }
        }
        throw new Error(`Unexpected query: ${table}.${column}`)
      },
    }),
  }))
})

describe('workspace choice', () => {
  it('merges one owner query and one membership query, removes duplicates, and sorts by name', async () => {
    const alpha = workspace('alpha', 'Alpha')
    mocked.owned = [workspace('zulu', 'Zulu'), alpha]
    mocked.joined = [
      { workspace: workspace('panel', 'Panel') },
      { workspace: alpha },
    ]

    const { listWorkspaces } = await import('./workspace')
    const result = await listWorkspaces()

    expect(result.map((row) => row.name)).toEqual(['Alpha', 'Panel', 'Zulu'])
    expect(mocked.from.mock.calls.map(([table]) => table)).toEqual([
      'workspaces', 'workspace_members',
    ])
  })

  it('loads a reachable stored workspace without asking for a fallback', async () => {
    const panel = workspace('panel', 'Panel')
    mocked.byId.set(panel.id, panel)
    const { loadWorkspace, setWorkspace } = await import('./workspace')
    setWorkspace(panel.id)

    await expect(loadWorkspace()).resolves.toEqual(panel)
    expect(mocked.rpc).toHaveBeenCalledTimes(1)
    expect(mocked.rpc).toHaveBeenCalledWith('claim_invites')
    expect(localStorage.getItem('tuval:workspace')).toBe(panel.id)
  })

  it('replaces an unreachable stored id with the deterministic fallback', async () => {
    const mine = workspace('mine', 'Mine')
    mocked.byId.set(mine.id, mine)
    mocked.ensured = mine.id
    const { loadWorkspace, setWorkspace } = await import('./workspace')
    setWorkspace('removed')

    await expect(loadWorkspace()).resolves.toEqual(mine)
    expect(mocked.rpc.mock.calls.map(([name]) => name)).toEqual([
      'claim_invites', 'ensure_workspace',
    ])
    expect(localStorage.getItem('tuval:workspace')).toBe(mine.id)
  })

  it('shares invitation settlement and workspace loading across concurrent callers', async () => {
    const panel = workspace('panel', 'Panel')
    mocked.byId.set(panel.id, panel)
    const { loadWorkspace, setWorkspace } = await import('./workspace')
    setWorkspace(panel.id)

    await expect(Promise.all([loadWorkspace(), loadWorkspace()])).resolves.toEqual([panel, panel])
    expect(mocked.rpc.mock.calls.map(([name]) => name)).toEqual(['claim_invites'])
  })
})
