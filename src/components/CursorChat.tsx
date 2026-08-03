import { t } from '../i18n'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toScreen } from '../board/camera'
import { awareness } from '../board/doc'
import { getPointer } from '../board/interaction'
import { me } from '../board/me'
import { requestRender, useBoardStore } from '../board/store'

export function CursorChat() {
  const open = useBoardStore((s) => s.chatOpen)
  const camera = useBoardStore((s) => s.camera)
  const update = useBoardStore((s) => s.update)
  const [text, setText] = useState('')
  const ref = useRef<HTMLInputElement>(null)

  useLayoutEffect(() => {
    if (open) ref.current?.focus()
  }, [open])

  useEffect(() => {
    if (open) return
    const id = setTimeout(() => awareness.setLocalStateField('chat', null), 12000)
    return () => clearTimeout(id)
  }, [open, text])

  if (!open) return null

  const at = toScreen(camera, getPointer().x, getPointer().y)
  const close = () => {
    update({ chatOpen: false })
    setText('')
    requestRender()
  }

  return (
    <div
      className="absolute z-50 flex items-center gap-2 rounded-[2px] border-2 bg-surface px-3 py-1.5 shadow-[2px_2px_0_rgba(20,19,16,0.07)]"
      style={{ left: at.x + 12, top: at.y + 36, borderColor: me.color }}
    >
      <input
        ref={ref}
        value={text}
        maxLength={44}
        placeholder={t('Say something…')}
        onChange={(e) => {
          setText(e.target.value)
          awareness.setLocalStateField('chat', { text: e.target.value, at: Date.now() })
        }}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Enter' || e.key === 'Escape') {
            if (e.key === 'Escape') awareness.setLocalStateField('chat', null)
            close()
          }
        }}
        onBlur={close}
        className="w-[220px] bg-transparent text-sm outline-none placeholder:text-muted"
      />
      <kbd className="rounded bg-tint px-1.5 py-0.5 text-[10px] font-semibold text-muted">esc</kbd>
    </div>
  )
}
