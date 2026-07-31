import { useEffect, useState, useSyncExternalStore } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { ancestors, createRecord, getRecords, loadRecords, subscribeRecords } from '../board/records'
import type { Record } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'

const pages = () => getRecords('doc')

const OPEN = 'tuval:tree-open'

const readOpen = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN) ?? '[]') as string[]) } catch { return new Set() }
}

const writeOpen = (ids: Set<string>) => {
  try { localStorage.setItem(OPEN, JSON.stringify([...ids])) } catch { /* private mode */ }
}

function Row({ page, kids, depth, here, open, toggle, add }: {
  page: Record
  kids: Map<string | null, Record[]>
  depth: number
  here: string
  open: Set<string>
  toggle: (id: string) => void
  add: (parent: string) => void
}) {
  const children = kids.get(page.id) ?? []
  const expanded = open.has(page.id)
  const active = here === page.id

  return (
    <li>
      <div
        className={`group flex items-center rounded-md pr-1 transition-colors
          ${active ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
        style={{ paddingLeft: `${depth * 12}px` }}
      >
        <button
          type="button"
          aria-label={expanded ? t('Collapse') : t('Expand')}
          aria-expanded={expanded}
          onClick={() => toggle(page.id)}
          className={`grid h-5 w-5 shrink-0 place-items-center rounded transition-transform hover:bg-[#E2DED5]
            ${expanded ? 'rotate-90' : ''} ${children.length ? '' : 'invisible'}`}
        >
          <ChevronRight size={13} />
        </button>

        <a
          href={`/d/${page.id}`}
          aria-current={active ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); go(`/d/${page.id}`) }}
          className="min-w-0 flex-1 truncate py-1 text-left text-[13px] font-medium"
        >
          {page.icon && <span className="mr-1.5">{page.icon}</span>}
          {page.title || t('Untitled page')}
        </a>

        <button
          type="button"
          aria-label={t('Add a page inside')}
          onClick={() => add(page.id)}
          className="grid h-5 w-5 shrink-0 place-items-center rounded opacity-0 hover:bg-[#E2DED5] focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Plus size={13} />
        </button>
      </div>

      {expanded && !!children.length && (
        <ul>
          {children.map((kid) => (
            <Row
              key={kid.id}
              page={kid}
              kids={kids}
              depth={depth + 1}
              here={here}
              open={open}
              toggle={toggle}
              add={add}
            />
          ))}
        </ul>
      )}
    </li>
  )
}

// Notion's spine. Every screen shows it, so a page written yesterday is one click away from
// wherever you are rather than behind a list you have to go and open.
export function PageTree() {
  const rows = useSyncExternalStore(subscribeRecords, pages, pages)
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const route = readRoute()
  const here = route.kind === 'page' ? route.id : ''
  const [open, setOpen] = useState(readOpen)

  useEffect(() => { if (workspace) void loadRecords('doc') }, [workspace])

  const kids = new Map<string | null, Record[]>()
  const known = new Set(rows.map((r) => r.id))
  for (const row of rows) {
    // A page whose parent is archived is shown at the top rather than hidden under a row that
    // is no longer drawn.
    const parent = row.parent_id && known.has(row.parent_id) ? row.parent_id : null
    if (!kids.has(parent)) kids.set(parent, [])
    kids.get(parent)!.push(row)
  }

  // The branch you are standing on is open whether or not you opened it yourself.
  const shown = new Set(open)
  for (const up of ancestors(rows, here)) shown.add(up.id)

  const toggle = (id: string) => {
    setOpen((was) => {
      const next = new Set(was)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      writeOpen(next)
      return next
    })
  }

  const add = (parent: string | null) => {
    void createRecord('', 'doc', parent).then((id) => {
      if (!id) return
      if (parent) {
        setOpen((was) => {
          const next = new Set(was).add(parent)
          writeOpen(next)
          return next
        })
      }
      go(`/d/${id}`)
    })
  }

  const roots = kids.get(null) ?? []

  return (
    <div className="mt-1 mb-3">
      <div className="flex items-center justify-between pl-2 pr-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
          {t('Pages')}
        </span>
        <button
          type="button"
          aria-label={t('New page')}
          onClick={() => add(null)}
          className="grid h-5 w-5 place-items-center rounded text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
        >
          <Plus size={13} />
        </button>
      </div>

      {roots.length
        ? (
          <ul className="mt-1">
            {roots.map((page) => (
              <Row
                key={page.id}
                page={page}
                kids={kids}
                depth={0}
                here={here}
                open={shown}
                toggle={toggle}
                add={add}
              />
            ))}
          </ul>
        )
        : <p className="mt-1 px-2 text-[12px] leading-snug text-[#B6B1A6]">{t('No pages yet')}</p>}
    </div>
  )
}
