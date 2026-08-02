import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocked = vi.hoisted(() => ({
  // Rows already here, by table. A restore writes into a live installation, not an empty one.
  members: [{ user_id: 'ann' }] as { user_id: string }[],
  sent: [] as { table: string; rows: Record<string, unknown>[] }[],
  refuse: (() => null) as (table: string, rows: Record<string, unknown>[]) => string | null,
}))

vi.mock('./supabase', () => ({
  supabase: {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'ann' } } }) },
    from: (table: string) => ({
      select: () => ({ eq: () => Promise.resolve({ data: mocked.members, error: null }) }),
      upsert: (rows: Record<string, unknown>[]) => {
        mocked.sent.push({ table, rows })
        const said = mocked.refuse(table, rows)
        return Promise.resolve({ error: said ? { message: said } : null })
      },
    }),
  },
}))
vi.mock('./workspace', () => ({
  getWorkspace: () => ({ id: 'ws', name: 'Studio', slug: 'studio', owner: 'ann', prefix: 'STU' }),
}))

const { BACKUP_VERSION, importWorkspace, readBackup } = await import('./backup')

const good = JSON.stringify({
  version: BACKUP_VERSION,
  taken_at: '2026-08-01T00:00:00.000Z',
  workspace: { name: 'Studio', prefix: 'STU' },
  records: [{ id: 'a', kind: 'doc', title: 'Plan' }],
  docs: [], labels: [], record_labels: [], record_links: [], cycles: [],
})

const rowsFor = (table: string) => mocked.sent.filter((s) => s.table === table).flatMap((s) => s.rows)

const backup = (records: Record<string, unknown>[], boards: Record<string, unknown>[] = []) =>
  readBackup(JSON.stringify({ ...JSON.parse(good), records, boards }))

beforeEach(() => {
  mocked.members = [{ user_id: 'ann' }]
  mocked.sent = []
  mocked.refuse = () => null
})

// A backup arrives from outside, which makes reading one a trust boundary: what it says about
// itself is checked before anything is written over.
describe('readBackup', () => {
  it('accepts one of ours', () => {
    expect(readBackup(good).records).toHaveLength(1)
  })

  it('refuses a file that is not a backup', () => {
    expect(() => readBackup('{"hello":"there"}')).toThrow(/not a Tuval backup/)
    expect(() => readBackup('null')).toThrow(/not a Tuval backup/)
    expect(() => readBackup('[]')).toThrow(/not a Tuval backup/)
  })

  it('refuses a version it does not know how to put back', () => {
    const newer = JSON.stringify({ ...JSON.parse(good), version: BACKUP_VERSION + 1 })
    expect(() => readBackup(newer)).toThrow(/different version/)
  })

  it('accepts the first backup format, whose missing board fields are optional', () => {
    const older = JSON.stringify({ ...JSON.parse(good), version: 1 })
    const held = readBackup(older)
    expect(held.records).toHaveLength(1)
    // Filled in rather than left undefined, so the restore has nothing to trip over.
    expect(held.boards).toEqual([])
    expect(held.board_docs).toEqual([])
  })

  it('lets bad JSON say so itself rather than pretending it read something', () => {
    expect(() => readBackup('{oh no')).toThrow()
  })
})

// The half that is the point. A file you cannot put back proves nothing, and a restore that dies
// in the middle is worse than one that refuses at the start: it leaves a workspace half full and
// no way to tell which half.
describe('importWorkspace', () => {
  it('keeps the people who exist here and drops only the ones who do not', async () => {
    mocked.members = [{ user_id: 'ann' }, { user_id: 'bob' }]
    const out = await importWorkspace(backup([
      { id: 'a', kind: 'issue', assignee: 'bob', created_by: 'ann', updated_by: 'ghost' },
    ]))

    const [row] = rowsFor('records')
    expect(row.assignee).toBe('bob')
    expect(row.created_by).toBe('ann')
    expect(row.updated_by).toBeNull()
    expect(out.strangers).toBe(1)
  })

  it('does not stop at a row the database refuses, and says how many it left behind', async () => {
    mocked.refuse = (table, rows) =>
      table === 'records' && rows.some((r) => r.id === 'bad') ? 'violates foreign key' : null

    const held = backup([
      { id: 'ok-1', kind: 'doc' },
      { id: 'bad', kind: 'doc' },
      { id: 'ok-2', kind: 'doc' },
    ])
    held.record_links = [{ from_id: 'ok-1', to_id: 'ok-2', kind: 'relates_to' }]
    const out = await importWorkspace(held)

    // The batch was refused, so each row was tried alone and two of the three got in.
    expect(out.records).toBe(2)
    expect(out.refused).toBe(1)
    // And the tables after records were still written: the run did not stop.
    expect(mocked.sent.map((s) => s.table)).toContain('record_links')
  })

  it('writes the boards before it gives up on anything, and keeps a known owner', async () => {
    mocked.members = [{ user_id: 'ann' }, { user_id: 'bob' }]
    const out = await importWorkspace(backup(
      [{ id: 'a', kind: 'doc' }],
      [{ id: 'room-1', owner: 'bob' }, { id: 'room-2', owner: 'ghost' }],
    ))

    const boards = rowsFor('boards')
    expect(boards.find((b) => b.id === 'room-1')?.owner).toBe('bob')
    // Nobody by that name here, so it belongs to whoever restored it rather than being refused.
    expect(boards.find((b) => b.id === 'room-2')?.owner).toBe('ann')
    expect(out.boards).toBe(2)
    expect(out.refused).toBe(0)
  })

  it('puts the parent back on a second pass, so a child ahead of its parent is not lost', async () => {
    await importWorkspace(backup([
      { id: 'child', kind: 'doc', parent_id: 'parent' },
      { id: 'parent', kind: 'doc' },
    ]))

    const passes = mocked.sent.filter((s) => s.table === 'records')
    expect(passes[0].rows.find((r) => r.id === 'child')?.parent_id).toBeNull()
    // One request for the second pass rather than one per record: a real workspace has thousands,
    // and thousands of round trips is thousands of chances to stop halfway.
    expect(passes).toHaveLength(2)
    expect(passes[1].rows).toHaveLength(1)
    expect(passes[1].rows[0]).toMatchObject({ id: 'child', parent_id: 'parent' })
  })
})
