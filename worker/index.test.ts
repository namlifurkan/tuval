import { describe, expect, it } from 'vitest'
import worker, { decodePreview, isKnownPath, rewriteCardShell } from './index'

describe('board preview data', () => {
  it.each(['image/webp', 'image/png', 'image/jpeg'])('accepts %s', (type) => {
    const decoded = decodePreview(`data:${type};base64,SGVsbG8=`)
    expect(decoded?.type).toBe(type)
    expect(new TextDecoder().decode(decoded?.bytes)).toBe('Hello')
  })

  it('refuses an editor-controlled HTML type', () => {
    expect(decodePreview('data:text/html;base64,PGgxPkJvb208L2gxPg==')).toBeNull()
  })

  it('refuses malformed base64', () => {
    expect(decodePreview('data:image/png;base64,!')).toBeNull()
  })
})

describe('route responses', () => {
  it('knows prerendered, app, dynamic, and static paths', () => {
    expect(isKnownPath('/pricing')).toBe(true)
    expect(isKnownPath('/i/one')).toBe(true)
    expect(isKnownPath('/assets/app.js')).toBe(true)
    expect(isKnownPath('/this-does-not-exist')).toBe(false)
  })

  it('returns the shell with a 404 for an unknown path', async () => {
    const response = await worker.fetch(new Request('https://tuval.dev/missing'), {
      ASSETS: { fetch: async () => new Response('<html><body>Tuval</body></html>') },
    })

    expect(response.status).toBe(404)
    expect(await response.text()).toContain('Tuval')
  })
})

describe('link card head', () => {
  it('replaces a prerendered head using the closing head marker', () => {
    const html = rewriteCardShell(
      '<html><head><title>Home title</title><link rel="canonical" href="https://tuval.dev" />'
        + '<meta property="og:title" content="Home" /></head><body></body></html>',
      { title: 'Public page · Tuval', note: 'A public page.', picture: '/brand/tuval-wordmark.png' },
      'https://tuval.dev/p/public-page?shared=yes',
    )

    expect(html).toContain('<title>Public page · Tuval</title>')
    expect(html).toContain('<link rel="canonical" href="https://tuval.dev/p/public-page" />')
    expect(html).toContain('property="og:title" content="Public page · Tuval"')
    expect(html).not.toContain('Home title')
    expect(html).not.toContain('content="Home"')
  })
})
