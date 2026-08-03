import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const doc = vi.hoisted(() => ({ meta: {} as Record<string, unknown> }))

vi.mock('./doc', () => ({ getMeta: () => doc.meta }))
vi.mock('./render', () => ({ boxOf: () => ({ x: 0, y: 0, w: 10, h: 10 }), render: () => {} }))
vi.mock('./paperPrefs', () => ({ readTexture: () => 'paper' }))

const { ARTIFACT_INK, ARTIFACT_PAPER, ARTIFACT_SHEET, artifactSurface } = await import('./artifacts')
const { exportHTML } = await import('./pageExport')

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

const preferDark = () => {
  localStorage.setItem('theme', 'dark')
  vi.stubGlobal('matchMedia', () => ({ matches: true, media: '(prefers-color-scheme: dark)' }))
}

describe('artifact surface', () => {
  beforeEach(() => {
    doc.meta = {}
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('is the surface the document carries', () => {
    doc.meta = { surface: 'slate' }
    expect(artifactSurface()).toBe('#25262A')
  })

  it('falls back to paper when the document names no surface', () => {
    expect(artifactSurface()).toBe('#F2EFE9')
    doc.meta = { surface: 'no-such-surface' }
    expect(artifactSurface()).toBe('#F2EFE9')
  })

  it('stays the document surface however the viewer prefers to see things', () => {
    doc.meta = { surface: 'sand' }
    const shared = artifactSurface()
    preferDark()
    expect(artifactSurface()).toBe(shared)
    expect(artifactSurface()).toBe('#EDE5D4')
  })

  it('reads the document it is handed, not the one on screen', () => {
    doc.meta = { surface: 'slate' }
    expect(artifactSurface({ surface: 'mist' })).toBe('#E3E7EA')
  })
})

describe('exported files', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  it('carry the document paper and ink under a dark viewer preference', async () => {
    preferDark()
    let written = ''
    vi.stubGlobal('URL', {
      createObjectURL: (blob: Blob) => {
        void blob.text().then((text) => { written = text })
        return 'blob:artifact'
      },
      revokeObjectURL: () => {},
    })
    const editor = {
      blocksToMarkdownLossy: async () => '',
      blocksToHTMLLossy: async () => '<p>Body</p>',
      document: [],
      schema: {},
    }
    await exportHTML(editor, 'Page')
    await new Promise((done) => { setTimeout(done, 0) })
    expect(written).toContain(ARTIFACT_PAPER)
    expect(written).toContain(ARTIFACT_INK)
  })

  it('are printed on a fixed sheet', () => {
    expect(ARTIFACT_SHEET).toBe('#FFFFFF')
    expect(source('print.ts')).toContain('background: ${ARTIFACT_SHEET}')
  })
})

describe('artifact modules', () => {
  const modules = ['export.ts', 'thumb.ts', 'duplicate.ts', 'print.ts', 'pageExport.ts', 'sync.ts']

  const viewerPreference = [
    /localStorage/, /sessionStorage/, /matchMedia/, /prefers-color-scheme/, /['"][./]*appearance['"]/,
  ]

  it('never ask the viewer what colour to be', () => {
    for (const name of modules) {
      for (const asking of viewerPreference) expect(source(name)).not.toMatch(asking)
    }
  })

  it('name one surface and let no module invent its own', () => {
    expect(source('thumb.ts')).not.toMatch(/surface\s*=\s*'#/)
    expect(source('sync.ts')).toContain('makeThumb(getItems())')
    for (const name of ['duplicate.ts', 'thumb.ts', 'export.ts']) {
      expect(source(name)).toContain('artifactSurface(')
    }
  })
})
