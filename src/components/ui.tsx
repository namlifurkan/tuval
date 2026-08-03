import { t } from '../i18n'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CSSProperties, ReactNode } from 'react'

export function IconButton({
  active, title, onClick, children, disabled, className = '',
}: {
  active?: boolean
  title?: string
  onClick?: (e: React.MouseEvent) => void
  children: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      className={`tap-target relative grid h-9 w-9 place-items-center rounded-lg text-ink transition-[background-color,box-shadow] duration-150
        ${active
          ? 'bg-[#F7E9E4] text-pigment ring-1 ring-pigment/25'
          : 'hover:bg-shade hover:ring-1 hover:ring-black/[0.07]'}
        ${disabled ? 'cursor-not-allowed opacity-35' : ''} ${className}`}
    >
      {children}
    </button>
  )
}

export function Popover({
  open, onClose, children, className = '', anchor = 'right',
}: {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  anchor?: 'right' | 'left' | 'top' | 'bottom' | 'topLeft' | 'bottomRight'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)

  useLayoutEffect(() => {
    if (!open) { setRect(null); setSize(null); return }
    const trigger = holder.current?.parentElement
    if (trigger) setRect(trigger.getBoundingClientRect())
  }, [open])

  useLayoutEffect(() => {
    const el = ref.current
    if (!open || !el) return
    const measure = () => setSize({ w: el.offsetWidth, h: el.offsetHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => { ro.disconnect(); window.removeEventListener('resize', measure) }
  }, [open, rect])

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node
      if (ref.current?.contains(target)) return
      if (holder.current?.parentElement?.contains(target)) return
      onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  const style = (): CSSProperties => {
    if (!rect) return { visibility: 'hidden' }
    const gap = 10
    const pad = 8
    const w = size?.w ?? 0
    const h = size?.h ?? 0
    const clampX = (x: number) => Math.max(pad, Math.min(x, window.innerWidth - w - pad))
    const clampY = (y: number) => Math.max(pad, Math.min(y, window.innerHeight - h - pad))

    let left: number
    let top: number
    switch (anchor) {
      case 'right':
        left = rect.right + gap
        top = rect.top
        if (left + w > window.innerWidth - pad) left = rect.left - gap - w
        break
      case 'left':
        left = rect.left - gap - w
        top = rect.top
        if (left < pad) left = rect.right + gap
        break
      case 'top':
        left = rect.left + rect.width / 2 - w / 2
        top = rect.top - gap - h
        if (top < pad) top = rect.bottom + gap
        break
      case 'topLeft':
        left = rect.left
        top = rect.top - gap - h
        if (top < pad) top = rect.bottom + gap
        break
      case 'bottomRight': {
        const bottomOver = h > 0 && rect.bottom + gap + h > window.innerHeight - pad
        return {
          right: Math.max(pad, window.innerWidth - rect.right),
          top: bottomOver ? clampY(rect.top - gap - h) : rect.bottom + gap,
          visibility: 'visible',
        }
      }
      default:
        left = rect.left + rect.width / 2 - w / 2
        top = rect.bottom + gap
        if (top + h > window.innerHeight - pad) top = rect.top - gap - h
        break
    }
    return { left: clampX(left), top: clampY(top), visibility: size ? 'visible' : 'hidden' }
  }

  if (!open) return <span ref={holder} className="hidden" />

  return (
    <>
      <span ref={holder} className="hidden" />
      {createPortal(
        <div
          ref={ref}
          onPointerDown={(e) => e.stopPropagation()}
          style={style()}
          className={`fixed z-[70] max-h-[calc(100vh-16px)] overflow-y-auto rounded-xl border border-black/5 bg-surface p-2 shadow-[3px_3px_0_rgba(20,19,16,0.09)] ${className}`}
        >
          {children}
        </div>,
        document.body,
      )}
    </>
  )
}

export function ColorGrid({
  colors, value, onPick, columns = 8,
}: {
  colors: readonly string[]
  value?: string
  onPick: (c: string) => void
  columns?: number
}) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0,1fr))` }}>
      {colors.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onPick(c)}
          title={c}
          className={`h-6 w-6 rounded-md border transition-transform hover:scale-110
            ${value === c ? 'ring-2 ring-pigment ring-offset-1' : ''}
            ${c === 'transparent' ? 'border-dashed border-[#C6C2B6]' : 'border-black/10'}`}
          style={{
            background: c === 'transparent'
              ? 'repeating-conic-gradient(#EAE6DD 0% 25%, #fff 0% 50%) 50%/8px 8px'
              : c,
          }}
        />
      ))}
    </div>
  )
}

export function HexInput({ value, onPick }: { value?: string; onPick: (c: string) => void }) {
  const [hex, setHex] = useState(value && value.startsWith('#') ? value : '#')
  return (
    <div className="mt-2 flex items-center gap-1.5 border-t border-shade pt-2">
      <span className="text-xs font-semibold text-muted">{t('Hex')}</span>
      <input
        value={hex}
        onChange={(e) => {
          const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
          setHex(v)
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onPick(v)
        }}
        spellCheck={false}
        className="w-full rounded-lg border border-hairline px-2 py-1 font-mono text-xs outline-none focus:border-pigment"
      />
      <input
        type="color"
        value={/^#([0-9a-f]{6})$/i.test(hex) ? hex : '#ffffff'}
        onChange={(e) => { setHex(e.target.value); onPick(e.target.value) }}
        className="h-7 w-8 cursor-pointer rounded-md border border-hairline bg-surface p-0.5"
      />
    </div>
  )
}

export function usePopover() {
  const [open, setOpen] = useState(false)
  return { open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }
}

export const Divider = () => <div className="mx-1 h-6 w-px shrink-0 bg-hairline" />
