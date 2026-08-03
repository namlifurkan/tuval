import { t } from '../i18n'
import { toScreen } from '../board/camera'
import { requestRender, useBoardStore } from '../board/store'
import { useItems } from '../board/useBoard'
import type { EmbedItem } from '../board/types'

export function EmbedLayer() {
  const items = useItems()
  const camera = useBoardStore((s) => s.camera)
  const active = useBoardStore((s) => s.activeEmbed)
  const selection = useBoardStore((s) => s.selection)
  const update = useBoardStore((s) => s.update)
  const embeds = items.filter((i): i is EmbedItem => i.type === 'embed')
  if (!embeds.length) return null

  return (
    <>
      {embeds.map((item) => {
        const p = toScreen(camera, item.x, item.y)
        const w = item.w * camera.z
        const h = item.h * camera.z
        if (w < 60 || h < 40) return null
        const live = active === item.id
        const selected = selection.includes(item.id)
        return (
          <div
            key={item.id}
            className="absolute z-10 overflow-hidden rounded-[10px]"
            style={{
              left: p.x,
              top: p.y,
              width: w,
              height: h,
              transform: `rotate(${item.rotation}rad)`,
              pointerEvents: live ? 'auto' : 'none',
              opacity: item.opacity ?? 1,
              boxShadow: live ? '0 0 0 2px #B43E28' : selected ? '0 0 0 2px #141310' : 'none',
            }}
          >
            <iframe
              src={item.url}
              title={item.title}
              className="h-full w-full border-0 bg-shade"
              loading="lazy"
              referrerPolicy="no-referrer"
              allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
              sandbox="allow-scripts allow-same-origin allow-popups allow-presentation allow-forms"
            />
            {selected && !live && (
              <div className="pointer-events-none absolute inset-0 grid place-items-end justify-center pb-2">
                <span className="rounded-md bg-ink/80 px-2 py-0.5 text-[11px] font-medium text-paper">
                  {t('Double click to use the content')}
                </span>
              </div>
            )}
            {live && (
              <button
                type="button"
                onClick={() => { update({ activeEmbed: null }); requestRender() }}
                className="absolute right-2 top-2 rounded-lg bg-ink px-2 py-1 text-[11px] font-semibold text-paper"
              >
                Kilidi kapat
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}
