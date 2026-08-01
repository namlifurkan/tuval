import { describe, expect, it } from 'vitest'
import { BACKUP_VERSION, readBackup } from './backup'

const good = JSON.stringify({
  version: BACKUP_VERSION,
  taken_at: '2026-08-01T00:00:00.000Z',
  workspace: { name: 'Studio', prefix: 'STU' },
  records: [{ id: 'a', kind: 'doc', title: 'Plan' }],
  docs: [], labels: [], record_labels: [], record_links: [], cycles: [],
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
    const older = JSON.stringify({ ...JSON.parse(good), version: BACKUP_VERSION + 1 })
    expect(() => readBackup(older)).toThrow(/different version/)
  })

  it('lets bad JSON say so itself rather than pretending it read something', () => {
    expect(() => readBackup('{oh no')).toThrow()
  })
})
