import { describe, expect, it } from 'vitest'
import { miroToItems, nearestSticky, plain } from './miro'

const board = {
  data: [
    {
      id: 'f1', type: 'frame',
      data: { title: 'Discovery' },
      position: { x: 0, y: 0 }, geometry: { width: 800, height: 600 },
    },
    {
      id: 's1', type: 'sticky_note', parent: { id: 'f1' },
      data: { content: '<p>Users abandon<br>at checkout</p>' },
      style: { fillColor: 'light_yellow' },
      position: { x: -100, y: -50 }, geometry: { width: 200, height: 200 },
    },
    {
      id: 's2', type: 'sticky_note',
      data: { content: 'Payment errors' },
      style: { fillColor: '#3E5C93' },
      position: { x: 400, y: 0 }, geometry: { width: 200, height: 200 },
    },
    {
      id: 'sh1', type: 'shape',
      data: { shape: 'flow_chart_decision', content: 'Retry?' },
      position: { x: 800, y: 0 }, geometry: { width: 240, height: 160 },
    },
    { id: 'x1', type: 'embed', position: { x: 0, y: 0 } },
    {
      id: 'c1', type: 'connector',
      data: { startItem: { id: 's1' }, endItem: { id: 's2' }, content: 'then' },
    },
    { id: 'c2', type: 'connector', data: { startItem: { id: 's1' }, endItem: { id: 'gone' } } },
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

  it('places a child relative to its frame', () => {
    const sticky = byType('sticky').find((i) => 'text' in i && i.text.startsWith('Users'))!
    expect({ x: sticky.x, y: sticky.y }).toEqual({ x: -200, y: -150 })
    expect(sticky.parentId).toBe(byType('frame')[0].id)
  })

  it('keeps line breaks and drops the markup', () => {
    const sticky = byType('sticky').find((i) => 'text' in i && i.text.startsWith('Users'))!
    expect((sticky as { text: string }).text).toBe('Users abandon\nat checkout')
  })

  it('maps a flowchart shape to its Tuval kind', () => {
    expect((byType('shape')[0] as { kind: string }).kind).toBe('diamond')
  })

  it('rewires a connector onto the new ids', () => {
    const c = byType('connector')[0] as { from: { itemId: string }; to: { itemId: string }; text: string }
    const ids = new Set(items.map((i) => i.id))
    expect(ids.has(c.from.itemId)).toBe(true)
    expect(ids.has(c.to.itemId)).toBe(true)
    expect(c.text).toBe('then')
  })

  it('counts what it could not bring over', () => {
    expect(skipped).toEqual({ embed: 1, connector: 1 })
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
