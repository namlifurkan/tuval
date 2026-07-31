import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { go, newRoom, openBoard, touchBoard } from '../board/boards'
import {
  ancestors, createRecord, getPages, getRecords, loadRecords, searchBodies, subscribeRecords,
} from '../board/records'
import type { Hit } from '../board/records'
import { t } from '../i18n'

interface Action { id: string; label: string; note?: string; hint?: string; run: () => void }

const pages = getPages
const issues = () => getRecords('issue')

// Everything reachable without the mouse. Linear's reputation is not its feature list, it is
// never having to look for anything, and that is a thing you either build in or never add.
//
// What is searched is what is already loaded: the page tree is in the store on every screen, so
// finding a page costs nothing and works with the network off.
export function Palette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [at, setAt] = useState(0)
  const field = useRef<HTMLInputElement>(null)
  const docs = useSyncExternalStore(subscribeRecords, pages, pages)
  const work = useSyncExternalStore(subscribeRecords, issues, issues)
  const [inside, setInside] = useState<Hit[]>([])

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
  useEffect(() => { if (open && !work.length) void loadRecords('issue') }, [open, work.length])

  // Asked a beat after the typing stops, and thrown away if the answer arrives for a question
  // that is no longer on screen.
  useEffect(() => {
    if (!open) return
    const typed = query.trim()
    if (typed.length < 2) { setInside([]); return }
    let live = true
    const timer = window.setTimeout(() => {
      void searchBodies(typed).then((found) => { if (live) setInside(found) })
    }, 220)
    return () => { live = false; clearTimeout(timer) }
  }, [open, query])

  const commands = useMemo<Action[]>(() => [
    { id: 'boards', label: t('Go to boards'), hint: '/dashboard', run: () => go('/dashboard') },
    { id: 'issues', label: t('Go to issues'), hint: '/issues', run: () => go('/issues') },
    { id: 'docs', label: t('Go to docs'), hint: '/docs', run: () => go('/docs') },
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
    { id: 'new-page', label: t('New page'), run: () => void createRecord('', 'doc').then((id) => id && go(`/d/${id}`)) },
  ], [])

  const shown = useMemo(() => {
    const typed = query.trim()
    const q = typed.toLowerCase()
    if (!q) return commands

    const hit = (title: string) => title.toLowerCase().includes(q)
    const found: Action[] = [
      ...docs.filter((p) => hit(p.title || t('Untitled page'))).slice(0, 8).map((p) => ({
        id: `d:${p.id}`,
        label: `${p.icon ? `${p.icon} ` : ''}${p.title || t('Untitled page')}`,
        note: ancestors(docs, p.id).map((up) => up.title || t('Untitled page')).join(' / '),
        hint: t('Page'),
        run: () => go(`/d/${p.id}`),
      })),
      ...work.filter((i) => hit(i.title)).slice(0, 6).map((i) => ({
        id: `i:${i.id}`,
        label: i.title,
        hint: t('Issue'),
        run: () => go(`/i/${i.id}`),
      })),
      ...commands.filter((c) => c.label.toLowerCase().includes(q)),
      // What the title did not say. Anything already matched by name is not repeated.
      ...inside
        .filter((hit) => !hit.title.toLowerCase().includes(q))
        .map((hit) => ({
          id: `b:${hit.id}`,
          label: `${hit.icon ? `${hit.icon} ` : ''}${hit.title || t('Untitled page')}`,
          note: hit.excerpt,
          hint: t('In the text'),
          run: () => go(hit.kind === 'issue' ? `/i/${hit.id}` : `/d/${hit.id}`),
        })),
    ]

    // Typing something nothing answers to is taken as the issue you meant to write.
    found.push({
      id: 'new-issue',
      label: t('New issue: {title}', { title: typed }),
      hint: '↵',
      run: () => { void createRecord(typed).then(() => loadRecords('issue')) },
    })
    return found
  }, [commands, docs, work, query, inside])

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
          placeholder={t('Find a page, an issue, or write one')}
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
              <span className="min-w-0 flex-1">
                <span className="block truncate">{action.label}</span>
                {action.note && (
                  <span className="mt-0.5 block truncate text-[11px] text-[#8A867C]">{action.note}</span>
                )}
              </span>
              {action.hint && <span className="shrink-0 text-[11px] text-[#8A867C]">{action.hint}</span>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
