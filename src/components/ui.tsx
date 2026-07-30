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
      className={`tap-target relative grid h-9 w-9 place-items-center rounded-lg text-[#141310] transition-colors
        ${active ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EFEBE2]'}
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
  anchor?: 'right' | 'top' | 'bottom' | 'topLeft' | 'bottomRight'
}) {
  const ref = useRef<HTMLDivElement>(null)
  const holder = useRef<HTMLSpanElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)

  useLayoutEffect(() => {
    if (!open) return setRect(null)
    const trigger = holder.current?.parentElement
    if (trigger) setRect(trigger.getBoundingClientRect())
  }, [open])

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
    switch (anchor) {
      case 'right':
        return { left: rect.right + gap, top: rect.top }
      case 'top':
        return { bottom: window.innerHeight - rect.top + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }
      case 'topLeft':
        return { bottom: window.innerHeight - rect.top + gap, left: rect.left }
      case 'bottomRight':
        return { top: rect.bottom + gap, right: window.innerWidth - rect.right }
      default:
        return { top: rect.bottom + gap, left: rect.left + rect.width / 2, transform: 'translateX(-50%)' }
    }
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
          className={`fixed z-[70] max-h-[80vh] overflow-y-auto rounded-xl border border-black/5 bg-[#FCFBF8] p-2 shadow-[0_8px_28px_rgba(20,19,16,0.18)] ${className}`}
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
            ${value === c ? 'ring-2 ring-[#C8452D] ring-offset-1' : ''}
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
    <div className="mt-2 flex items-center gap-1.5 border-t border-[#EAE6DD] pt-2">
      <span className="text-xs font-semibold text-[#8A867C]">Hex</span>
      <input
        value={hex}
        onChange={(e) => {
          const v = e.target.value.startsWith('#') ? e.target.value : `#${e.target.value}`
          setHex(v)
          if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onPick(v)
        }}
        spellCheck={false}
        className="w-full rounded-lg border border-[#E2DED5] px-2 py-1 font-mono text-xs outline-none focus:border-[#C8452D]"
      />
      <input
        type="color"
        value={/^#([0-9a-f]{6})$/i.test(hex) ? hex : '#ffffff'}
        onChange={(e) => { setHex(e.target.value); onPick(e.target.value) }}
        className="h-7 w-8 cursor-pointer rounded-md border border-[#E2DED5] bg-[#FCFBF8] p-0.5"
      />
    </div>
  )
}

export function usePopover() {
  const [open, setOpen] = useState(false)
  return { open, setOpen, toggle: () => setOpen((o) => !o), close: () => setOpen(false) }
}

export const Divider = () => <div className="mx-1 h-6 w-px shrink-0 bg-[#E2DED5]" />
