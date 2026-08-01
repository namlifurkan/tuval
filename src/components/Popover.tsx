import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// A table that scrolls sideways clips anything that hangs out of it, and a menu is exactly that.
// So the menu is not in the table: it is at the end of the document, placed where the button is.
export function Popover({ trigger, children, width = 200 }: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode
  children: (close: () => void) => React.ReactNode
  width?: number
}) {
  const [open, setOpen] = useState(false)
  const [box, setBox] = useState({ left: 0, top: 0 })
  const anchor = useRef<HTMLSpanElement>(null)

  // Stable across renders so the effect below can depend on it without re-subscribing.
  const place = useCallback(() => {
    // The wrapper is display:contents so it can sit inside a table cell without becoming a box,
    // and a thing with no box measures as zero. What is measured is the button it wraps.
    const rect = anchor.current?.firstElementChild?.getBoundingClientRect()
    if (!rect) return
    setBox({
      left: Math.min(rect.left, window.innerWidth - width - 8),
      top: Math.min(rect.bottom + 2, window.innerHeight - 40),
    })
  }, [width])

  useEffect(() => {
    if (!open) return
    place()
    const away = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', away)
    window.addEventListener('resize', place)
    // Capture, because the thing that scrolls is the table rather than the window.
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('keydown', away)
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open, place])

  return (
    <span ref={anchor} className="contents">
      {trigger({ open, toggle: () => setOpen((was) => !was) })}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[80]" onClick={() => setOpen(false)} />
          <div
            style={{ left: box.left, top: box.top, width }}
            className="fixed z-[81] rounded-lg border border-[#E2DED5] bg-[#FCFBF8] p-1 shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
          >
            {children(() => setOpen(false))}
          </div>
        </>,
        document.body,
      )}
    </span>
  )
}
