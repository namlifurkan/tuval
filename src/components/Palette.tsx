import { useEffect, useMemo, useRef, useState } from 'react'
import { go, newRoom, openBoard, touchBoard } from '../board/boards'
import { createRecord, loadRecords } from '../board/records'
import { t } from '../i18n'

interface Action { id: string; label: string; hint?: string; run: () => void }

// Everything reachable without the mouse. Linear's reputation is not its feature list, it is
// never having to look for anything, and that is a thing you either build in or never add.
export function Palette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const field = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((was) => !was)
        setQuery('')
        setAt(0)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => { if (open) field.current?.focus() }, [open])

  const actions = useMemo<Action[]>(() => {
    const typed = query.trim()
    const list: Action[] = [
      { id: 'boards', label: t('Go to boards'), hint: '/dashboard', run: () => go('/dashboard') },
      { id: 'issues', label: t('Go to issues'), hint: '/issues', run: () => go('/issues') },
      { id: 'settings', label: t('Go to settings'), hint: '/settings', run: () => go('/settings') },
      {
        id: 'new-board',
        label: t('New board'),
        run: () => {
          const room = newRoom()
          touchBoard(room, { name: '', opened: Date.now() })
          openBoard(room)
        },
      },
    ]

    // Typing something that matches no command is taken as the issue you meant to write.
    if (typed) {
      list.unshift({
        id: 'new-issue',
        label: t('New issue: {title}', { title: typed }),
        hint: '↵',
        run: () => { void createRecord(typed).then(() => loadRecords('issue')) },
      })
    }
    return list
  }, [query])

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return actions
    return actions.filter((a) => a.id === 'new-issue' || a.label.toLowerCase().includes(q))
  }, [actions, query])

  if (!open) return null

  const choose = (action: Action | undefined) => {
    if (!action) return
    setOpen(false)
    action.run()
  }

  return (
    <div
      className="fixed inset-0 z-[90] flex items-start justify-center bg-[#141310]/20 px-5 pt-[14vh]"
      onPointerDown={() => setOpen(false)}
    >
      <div
        onPointerDown={(e) => e.stopPropagation()}
        className="w-full max-w-[520px] overflow-hidden rounded-xl border border-[#E2DED5] bg-[#FCFBF8] shadow-[3px_3px_0_rgba(20,19,16,0.09)]"
      >
        <input
          ref={field}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setAt(0) }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setAt((i) => Math.min(i + 1, shown.length - 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setAt((i) => Math.max(i - 1, 0)) }
            if (e.key === 'Enter') { e.preventDefault(); choose(shown[at]) }
          }}
          placeholder={t('Search, or write an issue')}
          className="w-full border-b border-[#EAE6DD] bg-transparent px-4 py-3 text-sm outline-none placeholder:text-[#8A867C]"
        />
        <div className="max-h-[46vh] overflow-y-auto p-1">
          {shown.map((action, i) => (
            <button
              key={action.id}
              type="button"
              onMouseEnter={() => setAt(i)}
              onClick={() => choose(action)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm
                ${i === at ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#141310]'}`}
            >
              <span className="min-w-0 flex-1 truncate">{action.label}</span>
              {action.hint && <span className="shrink-0 text-[11px] text-[#8A867C]">{action.hint}</span>}
            </button>
          ))}
          {!shown.length && (
            <p className="px-3 py-4 text-center text-sm text-[#8A867C]">{t('Nothing matches')}</p>
          )}
        </div>
      </div>
    </div>
  )
}
