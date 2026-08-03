import { describe, expect, it } from 'vitest'
import { miroToItems, nearestSticky, plain } from './miro'

// Shaped exactly like GET /v2/boards/{id}/items and /connectors answer, down to `relativeTo` and
// to the connector keeping its ends at the top level. The first version of this fixture invented
// a tidier shape, so every test passed while no real board imported.
const board = {
  data: [
    {
      id: 'f1', type: 'frame',
      data: { title: 'Discovery' },
      position: { x: 0, y: 0, origin: 'center', relativeTo: 'canvas_center' },
      geometry: { width: 800, height: 600 },
    },
    {
      id: 's1', type: 'sticky_note', parent: { id: 'f1' },
      data: { content: '<p>Users abandon<br>at checkout</p>' },
      style: { fillColor: 'light_yellow' },
      position: { x: 200, y: 150, origin: 'center', relativeTo: 'parent_top_left' },
      geometry: { width: 200, height: 200 },
    },
    {
      id: 's2', type: 'sticky_note',
      data: { content: 'Payment errors' },
      style: { fillColor: '#3E5C93' },
      position: { x: 400, y: 0, origin: 'center', relativeTo: 'canvas_center' },
      geometry: { width: 200, height: 200 },
    },
    {
      id: 'sh1', type: 'shape',
      data: { shape: 'flow_chart_decision', content: 'Retry?' },
      position: { x: 800, y: 0, origin: 'center', relativeTo: 'canvas_center' },
      geometry: { width: 240, height: 160 },
    },
    {
      id: 'i1', type: 'image',
      data: { imageUrl: 'https://api.miro.com/v2/boards/x/resources/images/9?format=preview' },
      position: { x: 0, y: 900, origin: 'center', relativeTo: 'canvas_center' },
      geometry: { width: 300, height: 200 },
    },
    { id: 'x1', type: 'embed', position: { x: 0, y: 0 } },
    {
      id: 'c1', type: 'connector', shape: 'elbowed',
      startItem: { id: 's1' }, endItem: { id: 's2' },
      captions: [{ content: '<p>EVET</p>' }, { content: '<p>sonra</p>' }],
      style: { strokeColor: '#333333', strokeWidth: '2.0' },
    },
    { id: 'c2', type: 'connector', startItem: { id: 's1' }, endItem: { id: 'gone' } },
  ],
}

describe('miro import', () => {
  const { items, skipped } = miroToItems(board)
  const byType = (t: string) => items.filter((i) => i.type === t)

  it('maps every supported type', () => {
    expect(byType('frame')).toHaveLength(1)
    expect(byType('sticky')).toHaveLength(2)
    expect(byType('shape')).toHaveLength(1)
    expect(byType('connector')).toHaveLength(1)
  })

  it('turns the centre point into a top-left box', () => {
    const frame = byType('frame')[0]
    expect({ x: frame.x, y: frame.y, w: frame.w, h: frame.h })
      .toEqual({ x: -400, y: -300, w: 800, h: 600 })
  })

  it('measures a child from its frame top left, not its centre', () => {
    const sticky = byType('sticky').find((i) => 'text' in i && i.text.startsWith('Users'))!
    // Frame top left (-400, -300) + (200, 150), then back off half the sticky.
    expect({ x: sticky.x, y: sticky.y }).toEqual({ x: -300, y: -250 })
    expect(sticky.parentId).toBe(byType('frame')[0].id)
  })

  it('keeps a child inside the frame it belongs to', () => {
    const frame = byType('frame')[0]
    const sticky = byType('sticky').find((i) => 'text' in i && i.text.startsWith('Users'))!
    expect(sticky.x).toBeGreaterThanOrEqual(frame.x)
    expect(sticky.y).toBeGreaterThanOrEqual(frame.y)
    expect(sticky.x + sticky.w).toBeLessThanOrEqual(frame.x + frame.w)
    expect(sticky.y + sticky.h).toBeLessThanOrEqual(frame.y + frame.h)
  })

  it('keeps line breaks and drops the markup', () => {
    const sticky = byType('sticky').find((i) => 'text' in i && i.text.startsWith('Users'))!
    expect((sticky as { text: string }).text).toBe('Users abandon\nat checkout')
  })

  it('maps a flowchart shape to its Tuval kind', () => {
    expect((byType('shape')[0] as { kind: string }).kind).toBe('diamond')
  })

  it('rewires a connector onto the new ids and keeps its caption', () => {
    const c = byType('connector')[0] as {
      from: { itemId: string }; to: { itemId: string }; text: string
      shape: string; labels?: { text: string }[]
    }
    const ids = new Set(items.map((i) => i.id))
    expect(ids.has(c.from.itemId)).toBe(true)
    expect(ids.has(c.to.itemId)).toBe(true)
    expect(c.text).toBe('EVET')
    expect(c.labels?.[0].text).toBe('sonra')
    expect(c.shape).toBe('elbow')
  })

  it('counts what it could not bring over, pictures included', () => {
    expect(skipped).toEqual({ embed: 1, image: 1, connector: 1 })
  })

  it('draws frames before their contents', () => {
    expect(items[0].type).toBe('frame')
  })

  it('snaps colours onto the Tuval palette', () => {
    expect(nearestSticky('light_yellow')).toBe('#F0E3B0')
    expect(nearestSticky('#3E5C93')).toBe('#3E5C93')
    expect(nearestSticky('#010203')).toBe('#1F1D1A')
    expect(nearestSticky(undefined)).toBe('#F0E3B0')
  })

  it('unescapes entities', () => {
    expect(plain('a &amp; b &lt;c&gt;')).toBe('a & b <c>')
  })
})
