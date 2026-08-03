import { X } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useState, useSyncExternalStore } from 'react'
import { dismissTip, getAda, nextTip, subscribeAda } from '../board/ada'
import type { Tip } from '../board/ada'
import { GUIDE } from '../board/brand'
import { getVersion, subscribeDoc } from '../board/doc'
import { useBoardStore } from '../board/store'
import { getUser, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'

const WIDTH = 264
const QUIET = 5000

const anchorEl = (anchor: string) =>
  document.querySelector<HTMLElement>(`[data-ada="${anchor}"]`)

interface Place { left: number; tick: number; top?: number; bottom?: number; below: boolean }

export function Ada() {
  const version = useSyncExternalStore(subscribeDoc, getVersion, getVersion)
  const ada = useSyncExternalStore(subscribeAda, getAda, getAda)
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const presenting = useBoardStore((s) => s.presenting)
  const editing = useBoardStore((s) => s.editing)
  const [tip, setTip] = useState<Tip | null>(null)
  const [place, setPlace] = useState<Place | null>(null)

  const quiet = presenting === null && !editing

  useEffect(() => {
    setTip(null)
    if (!quiet) return
    const id = setTimeout(() => setTip(nextTip((a) => !!anchorEl(a))), QUIET)
    return () => clearTimeout(id)
  }, [version, ada, user, quiet])

  const measure = useCallback(() => {
    const el = tip && anchorEl(tip.anchor)
    if (!el) { setPlace(null); return }
    const r = el.getBoundingClientRect()
    const x = r.left + r.width / 2
    const left = Math.min(Math.max(x - WIDTH / 2, 12), innerWidth - WIDTH - 12)
    const below = r.top < innerHeight / 2
    setPlace({
      left,
      tick: x - left,
      below,
      ...(below ? { top: r.bottom + 12 } : { bottom: innerHeight - r.top + 12 }),
    })
  }, [tip])

  useLayoutEffect(() => {
    measure()
    addEventListener('resize', measure)
    return () => removeEventListener('resize', measure)
  }, [measure])

  if (!tip || !place) return null

  return (
    <aside
      style={{ left: place.left, top: place.top, bottom: place.bottom, width: WIDTH }}
      className="ada-label pointer-events-auto fixed z-50 rounded-xl border border-hairline bg-surface px-3 pb-2.5 pt-2 shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
    >
      <span
        aria-hidden
        style={{ left: place.tick - 0.5, [place.below ? 'top' : 'bottom']: -8 }}
        className="absolute h-2 w-px bg-hairline"
      />

      <div className="flex items-center gap-1.5">
        <span
          className="grid h-4 w-4 place-items-center rounded-sm text-[9px] font-bold text-white"
          style={{ background: GUIDE.color }}
        >
          {GUIDE.name[0]}
        </span>
        <span
          className="text-[10px] font-bold uppercase tracking-[0.13em]"
          style={{ color: GUIDE.color }}
        >
          {GUIDE.name}
        </span>
        <button
          type="button"
          title={t('Dismiss')}
          onClick={() => dismissTip(tip.id)}
          className="ml-auto grid h-5 w-5 place-items-center rounded-md text-muted hover:bg-tint"
        >
          <X size={12} />
        </button>
      </div>

      <p className="mt-1.5 text-[13px] font-semibold leading-snug text-ink">{t(tip.title)}</p>
      <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{t(tip.body)}</p>

      <button
        type="button"
        onClick={() => dismissTip(tip.id)}
        className="mt-2 text-xs font-semibold text-pigment hover:text-[#943321]"
      >
        {t('Got it')}
      </button>
    </aside>
  )
}
