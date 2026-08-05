import { beforeEach, describe, expect, it, vi } from 'vitest'

const held = vi.hoisted(() => ({
  brief: null as string | null,
  mode: 'append' as 'append' | 'replace',
  reads: 0,
  clears: 0,
}))

vi.mock('./store', () => ({ requestRender: () => {} }))
vi.mock('./access', () => ({ readOnly: () => false }))
vi.mock('./thumb', () => ({ makeThumb: () => 'thumb' }))
vi.mock('./storage', () => ({ BUCKET: 'board-images', storagePath: () => null }))
vi.mock('./workspace', () => ({ loadWorkspace: async () => ({ id: 'workspace-1' }) }))
vi.mock('./supabase', async (original) => ({
  ...(await original<typeof import('./supabase')>()),
  supabase: {},
  getUser: () => ({ id: 'someone' }),
  subscribeAuth: () => {},
}))

// The column, as the database keeps it: the clear only lands if the text is still the text that
// was read, which is what stops a second tab drawing the same brief again.
vi.mock('./cloud', () => ({
  readPendingBrief: async () => {
    held.reads += 1
    return held.brief ? { brief: held.brief, mode: held.mode } : null
  },
  clearPendingBrief: async (_room: string, brief: string) => {
    held.clears += 1
    if (held.brief !== brief) return false
    held.brief = null
    return true
  },
  appendUpdate: async () => null,
  claimBoard: async () => null,
  compactUpdates: async () => 0,
  LOG_MAX: 1_048_576,
  NOT_MINE: 'not-mine',
  pullSnapshot: async () => null,
  pullUpdates: async () => [],
  pushSnapshot: async () => null,
  snapshotStamp: async () => null,
  sweepImages: async () => 0,
}))

const brief = `# Yasal uyum testi

## Kabul akışı

- Telefon doğrulama
- Belge kabulü

## Flow

\`\`\`mermaid
flowchart TD
  n1["Telefon doğrulama"]
  n2["Belge kabulü"]
  n1 -- sonra --> n2
\`\`\`
`

const second = `# İkinci rapor

## Sonuç

- Yeni satır
`

const { drawPendingBrief } = await import('./sync')
const { createItems, getItems, getMeta, removeItems } = await import('./doc')
const { makeSticky } = await import('./items')

describe('drawPendingBrief', () => {
  beforeEach(() => {
    removeItems(getItems().map((i) => i.id))
    held.reads = 0
    held.clears = 0
    held.mode = 'append'
  })

  it('draws nothing when no brief is waiting', async () => {
    held.brief = null
    await drawPendingBrief()
    expect(getItems()).toHaveLength(0)
    expect(held.clears).toBe(0)
  })

  it('turns a waiting brief into frames, notes and arrows', async () => {
    held.brief = brief
    await drawPendingBrief()
    const items = getItems()
    expect(items.filter((i) => i.type === 'frame')).toHaveLength(1)
    expect(items.filter((i) => i.type === 'sticky')).toHaveLength(2)
    expect(items.filter((i) => i.type === 'connector')).toHaveLength(1)
    expect(getMeta().name).toBe('Yasal uyum testi')
  })

  it('empties the column so the next visitor draws nothing', async () => {
    held.brief = brief
    await drawPendingBrief()
    const drawn = getItems().length
    await drawPendingBrief()
    expect(getItems()).toHaveLength(drawn)
  })

  it('clears a brief that draws nothing rather than parsing it on every open', async () => {
    held.brief = 'no headings, no bullets, nothing to place'
    await drawPendingBrief()
    expect(getItems()).toHaveLength(0)
    expect(held.brief).toBeNull()
  })

  it('draws once when two tabs arrive together', async () => {
    held.brief = brief
    await Promise.all([drawPendingBrief(), drawPendingBrief()])
    const items = getItems()
    expect(items.filter((i) => i.type === 'sticky')).toHaveLength(2)
  })

  it('marks everything it draws, so a later brief can tell its own work apart', async () => {
    held.brief = brief
    await drawPendingBrief()
    expect(getItems().every((i) => i.via === 'brief')).toBe(true)
  })

  it('appends below what is already there rather than on top of it', async () => {
    held.brief = brief
    await drawPendingBrief()
    const first = getItems()
    const bottom = Math.max(...first.map((i) => i.y + i.h))

    held.brief = second
    await drawPendingBrief()
    const added = getItems().filter((i) => !first.some((was) => was.id === i.id))
    expect(added.length).toBeGreaterThan(0)
    expect(Math.min(...added.map((i) => i.y))).toBeGreaterThan(bottom)
    expect(getItems().filter((i) => i.type === 'frame')).toHaveLength(2)
  })

  it('replace takes back what a brief drew and leaves what a person put there', async () => {
    held.brief = brief
    await drawPendingBrief()
    const mine = makeSticky(4000, 4000, '#fff', 'benim notum')
    createItems([mine])

    held.brief = second
    held.mode = 'replace'
    await drawPendingBrief()

    const items = getItems()
    expect(items.find((i) => i.id === mine.id)).toBeTruthy()
    expect(items.filter((i) => i.type === 'frame')).toHaveLength(1)
    expect(items.filter((i) => i.type === 'sticky' && i.via === 'brief')).toHaveLength(1)
  })

  it('replace redraws where the last brief stood rather than moving down the canvas', async () => {
    held.brief = brief
    await drawPendingBrief()
    const wasAt = Math.min(...getItems().map((i) => i.y))

    held.brief = second
    held.mode = 'replace'
    await drawPendingBrief()
    expect(Math.min(...getItems().map((i) => i.y))).toBe(wasAt)
  })
})
