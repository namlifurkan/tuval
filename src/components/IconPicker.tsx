import { useEffect, useRef, useState } from 'react'
import { t } from '../i18n'

// emoji-mart's own element rather than its React wrapper: the wrapper's peer range stops at
// React 18 and this is the same twenty lines it would run for us.
// The picker lives in a shadow root, so a stylesheet cannot reach it. What it does read is a
// handful of custom properties, which is how the whole thing is brought onto our paper.
const SKIN = {
  '--rgb-background': '252, 251, 248',
  '--rgb-input': '242, 239, 233',
  '--rgb-color': '20, 19, 16',
  '--rgb-accent': '200, 69, 45',
  '--color-border': '#E2DED5',
  '--font-family': '"Instrument Sans", system-ui, sans-serif',
  '--shadow': 'none',
}

async function mount(host: HTMLElement, onPick: (emoji: string) => void) {
  const [{ Picker }, data] = await Promise.all([
    import('emoji-mart'),
    import('@emoji-mart/data').then((m) => m.default),
  ])
  host.replaceChildren()
  // eslint-disable-next-line no-new
  new Picker({
    data,
    parent: host,
    autoFocus: true,
    previewPosition: 'none',
    skinTonePosition: 'none',
    theme: 'light',
    i18n: { search: t('Search'), categories: { frequent: t('Frequently used') } },
    onEmojiSelect: (chosen: { native?: string }) => { if (chosen.native) onPick(chosen.native) },
  })
  const el = host.firstElementChild as HTMLElement | null
  if (el) for (const [key, value] of Object.entries(SKIN)) el.style.setProperty(key, value)
}

export function IconPicker({ value, onPick }: { value: string; onPick: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open || !host.current) return
    void mount(host.current, (emoji) => { onPick(emoji); setOpen(false) })
  }, [open, onPick])

  useEffect(() => {
    if (!open) return
    const away = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', away)
    return () => window.removeEventListener('keydown', away)
  }, [open])

  return (
    <div className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((was) => !was)}
        className={`grid place-items-center rounded-lg transition-colors hover:bg-[#EAE6DD]
          ${value ? 'h-14 w-14 text-[44px] leading-none' : 'h-7 px-2 text-[12px] font-semibold text-[#8A867C]'}`}
      >
        {value || t('Add an icon')}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onPointerDown={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-50 mt-1">
            {!!value && (
              <button
                type="button"
                onClick={() => { onPick(''); setOpen(false) }}
                className="mb-1 w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-left text-[12px] font-semibold text-[#8A867C] hover:text-[#DC2626]"
              >
                {t('Remove icon')}
              </button>
            )}
            <div
              ref={host}
              style={{ colorScheme: 'light' }}
              className="overflow-hidden rounded-xl border border-[#E2DED5] shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
            />
          </div>
        </>
      )}
    </div>
  )
}
