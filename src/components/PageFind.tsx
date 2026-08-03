import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react'
import type { EditorView } from 'prosemirror-view'
import { findIn, replaceHits, showHit } from '../board/find'
import { t } from '../i18n'

type Editor = {
  prosemirrorView: EditorView
  onChange: (callback: () => void) => (() => void) | undefined
}

// Finding and changing a word wherever it appears. The pair belongs together: somebody who has
// found every "Q3" in a document is usually there to make them all say "Q4".
export function PageFind({ editor, locked }: { editor: Editor; locked?: boolean }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [swap, setSwap] = useState('')
  const [matchCase, setMatchCase] = useState(false)
  const [at, setAt] = useState(0)
  const [tick, setTick] = useState(0)
  const field = useRef<HTMLInputElement>(null)

  // The view is not there until the editor has mounted, and asking early throws.
  const view = (): EditorView | null => {
    try { return editor.prosemirrorView } catch { return null }
  }

  // Counted again whenever the document changes, so a number on screen is never a number about a
  // document that has moved on.
  useEffect(() => editor.onChange(() => setTick((n) => n + 1)), [editor])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        setOpen(true)
        field.current?.select()
      } else if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  useEffect(() => { if (open) field.current?.focus() }, [open])

  const hits = useMemo(
    () => {
      const held = view()
      return open && held ? findIn(held.state.doc, query, matchCase) : []
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [query, matchCase, tick, open],
  )

  const here = hits.length ? Math.min(at, hits.length - 1) : 0

  // The selection is moved but the focus is not: somebody stepping through matches is still
  // typing in the field, and taking the cursor into the document would type into the page.
  const jump = (delta: number) => {
    if (!hits.length) return
    const next = (here + delta + hits.length) % hits.length
    setAt(next)
    const held = view()
    if (held) showHit(held, hits[next])
  }

  const change = (every: boolean) => {
    const held = view()
    if (!held || !hits.length) return
    replaceHits(held, every ? hits : [hits[here]], swap)
    setAt(every ? 0 : here)
  }

  const box = 'rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] text-ink outline-none placeholder:text-faint focus:border-pigment'
  const tap = 'grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-shade hover:text-ink disabled:opacity-30'

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        title={t('Find and replace — ⌘F')}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-shade hover:text-ink"
      >
        <Search size={13} /> {t('Find')}
      </button>

      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-[300px] rounded-xl border border-hairline bg-raise p-2 shadow-[0_8px_24px_rgba(20,19,16,0.12)]">
          <div className="flex items-center gap-1">
            <input
              ref={field}
              value={query}
              onChange={(e) => { setQuery(e.target.value); setAt(0) }}
              onKeyDown={(e) => {
                if (e.key !== 'Enter') return
                e.preventDefault()
                jump(e.shiftKey ? -1 : 1)
              }}
              placeholder={t('Find in this page')}
              className={`min-w-0 flex-1 ${box}`}
            />
            <span className="w-[52px] shrink-0 text-right text-[11px] tabular-nums text-muted">
              {query && (hits.length ? `${here + 1}/${hits.length}` : t('none'))}
            </span>
            <button type="button" disabled={!hits.length} onClick={() => jump(-1)} className={tap}>
              <ChevronUp size={14} />
            </button>
            <button type="button" disabled={!hits.length} onClick={() => jump(1)} className={tap}>
              <ChevronDown size={14} />
            </button>
            <button type="button" onClick={() => setOpen(false)} className={tap}>
              <X size={14} />
            </button>
          </div>

          {!locked && (
            <div className="mt-1.5 flex items-center gap-1">
              <input
                value={swap}
                onChange={(e) => setSwap(e.target.value)}
                placeholder={t('Replace with')}
                className={`min-w-0 flex-1 ${box}`}
              />
              <button
                type="button"
                disabled={!hits.length}
                onClick={() => change(false)}
                className="shrink-0 rounded-md px-2 py-1 text-[12px] font-semibold text-muted hover:bg-shade hover:text-ink disabled:opacity-30"
              >{t('Replace')}</button>
              <button
                type="button"
                disabled={!hits.length}
                onClick={() => change(true)}
                className="shrink-0 rounded-md bg-pigment px-2 py-1 text-[12px] font-semibold text-on-pigment hover:bg-pigment-deep disabled:opacity-30"
              >{t('All')}</button>
            </div>
          )}

          <label className="mt-1.5 flex select-none items-center gap-1.5 px-0.5 text-[11px] text-muted">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => { setMatchCase(e.target.checked); setAt(0) }}
              className="accent-pigment"
            />
            {t('Match case')}
          </label>
        </div>
      )}
    </div>
  )
}
