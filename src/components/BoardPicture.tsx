import { useEffect, useRef } from 'react'
import { fitRect } from '../board/camera'
import { boxOf, render } from '../board/render'
import { inEnglish } from '../i18n'
import { TEMPLATES } from '../board/templates'
import type { Item } from '../board/types'

// The pictures on this site --------------------------------------------------------------------
// A page of type on a coloured band is a page nobody looks at, and stock photography of somebody
// smiling at a laptop would say nothing true about this. What we have instead is the renderer.
//
// The first attempt used the thumbnail painter, which draws grey boxes and no text because it
// exists to fill a 200-pixel preview. Blown up to six hundred it looked exactly like the mockup
// it was standing in for. This calls render() — the same function the live canvas calls, every
// frame — into an offscreen context. So these are not pictures of boards. They are boards.

const built = new Map<string, Item[]>()

const itemsFor = (template: string): Item[] => {
  const held = built.get(template)
  if (held) return held
  const made = inEnglish(() => TEMPLATES.find((one) => one.id === template)?.build({ x: 0, y: 0 }) ?? [])
  built.set(template, made)
  return made
}

const NOTHING = {
  preview: new Map(),
  badge: null,
  spacing: [],
  dropFrame: null,
  marquee: null,
  guides: [],
  draft: null,
  connectorDraft: null,
  anchorsFor: null,
  remote: [],
  spaceDown: false,
  cursor: 'default',
}

export function BoardPicture({ template, className = '', surface = '#F2EFE9' }: {
  template: string
  className?: string
  surface?: string
}) {
  const plate = useRef<HTMLCanvasElement>(null)
  const shell = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = plate.current
    const box = shell.current
    if (!canvas || !box) return

    const paint = () => {
      const width = box.clientWidth
      const height = box.clientHeight
      if (!width || !height) return

      // Drawn at the screen's own density: a board scaled up from a low-resolution bitmap is
      // the soft grey that made the last attempt look fake.
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const items = itemsFor(template)
      const world = boxOf(items)
      if (!world.w) return

      render({
        ctx,
        cam: fitRect(world, width - 28, height - 28),
        width,
        height,
        items,
        selection: new Set(),
        hover: null,
        editing: null,
        editingCell: null,
        session: NOTHING,
        surface,
        texture: 'paper',
        showAnchors: false,
        dpr,
      })
    }

    paint()
    const watch = new ResizeObserver(paint)
    watch.observe(box)
    // Web fonts land after the first paint and the board is mostly type, so it is drawn again
    // once they have. Without this every picture is set in the fallback font.
    void document.fonts?.ready.then(paint)
    return () => watch.disconnect()
  }, [template, surface])

  const name = TEMPLATES.find((one) => one.id === template)?.name ?? template
  // The frame takes the board's own proportions. A fixed ratio letterboxes: a wide kanban in a
  // 16/10 box is a small picture floating in a lot of paper, which reads as a placeholder again.
  const world = boxOf(itemsFor(template))
  const ratio = world.w && world.h ? `${world.w} / ${world.h + 44}` : '16 / 10'

  return (
    <div
      ref={shell}
      className={`overflow-hidden rounded-xl ${className}`}
      style={{ aspectRatio: ratio, background: surface }}
    >
      <canvas
        ref={plate}
        className="h-full w-full"
        role="img"
        aria-label={`A ${name} board, drawn by the editor itself`}
      />
    </div>
  )
}
