import { useEffect, useState, useSyncExternalStore } from 'react'
import { ChevronRight, Copy, Plus, Table2 } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import {
  ancestors, between, canReparent, createRecord, getPages, loadPages, patchRecord, subscribeRecords,
} from '../board/records'
import type { Record } from '../board/records'
import { pageTemplates, fromTemplate } from '../board/pageTemplates'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { Popover } from './Popover'
import { t } from '../i18n'

const pages = getPages

type Where = 'above' | 'below' | 'inside'

const OPEN = 'tuval:tree-open'

const readOpen = (): Set<string> => {
  try { return new Set(JSON.parse(localStorage.getItem(OPEN) ?? '[]') as string[]) } catch { return new Set() }
}

const writeOpen = (ids: Set<string>) => {
  try { localStorage.setItem(OPEN, JSON.stringify([...ids])) } catch { /* private mode */ }
}

function Row({ page, kids, depth, here, open, toggle, add, move }: {
  page: Record
  kids: Map<string | null, Record[]>
  depth: number
  here: string
  open: Set<string>
  toggle: (id: string) => void
  add: (parent: string) => void
  move: (id: string, onto: Record, where: Where) => void
}) {
  // A database draws its rows itself. Repeating them in the tree would bury the pages.
  const children = page.kind === 'database' ? [] : kids.get(page.id) ?? []
  const expanded = open.has(page.id)
  const active = here === page.id
  const [over, setOver] = useState<Where | null>(null)

  // The top and bottom sixths of a row put the page beside this one; the middle puts it inside.
  // Sixths rather than thirds because dropping inside is the common intent and the easier target
  // should be the one people mean.
  const zone = (e: React.DragEvent): Where => {
    const box = e.currentTarget.getBoundingClientRect()
    const y = (e.clientY - box.top) / box.height
    if (y < 0.17) return 'above'
    if (y > 0.83) return 'below'
    return 'inside'
  }

  return (
    <li>
      <div
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setOver(zone(e)) }}
        onDragLeave={() => setOver(null)}
        onDrop={(e) => {
          e.preventDefault()
          e.stopPropagation()
          const id = e.dataTransfer.getData('text/plain')
          setOver(null)
          if (id && id !== page.id) move(id, page, zone(e))
        }}
        className={`group flex items-center rounded-md pr-1 transition-colors
          ${active ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}
          ${over === 'inside' ? 'ring-1 ring-[#C8452D]' : ''}
          ${over === 'above' ? 'border-t border-[#C8452D]' : ''}
          ${over === 'below' ? 'border-b border-[#C8452D]' : ''}`}
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
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', page.id); e.dataTransfer.effectAllowed = 'move' }}
          aria-current={active ? 'page' : undefined}
          onClick={(e) => { e.preventDefault(); go(`/d/${page.id}`) }}
          className="min-w-0 flex-1 truncate py-1 text-left text-[13px] font-medium"
        >
          {page.icon
            ? <span className="mr-1.5">{page.icon}</span>
            : page.kind === 'database' && <Table2 size={12} className="mr-1.5 inline text-[#8A867C]" />}
          {page.title || t(page.kind === 'database' ? 'Untitled database' : 'Untitled page')}
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
              move={move}
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

  useEffect(() => { if (workspace) void loadPages() }, [workspace])

  const kids = new Map<string | null, Record[]>()
  const known = new Set(rows.map((r) => r.id))
  for (const row of rows) {
    // A page whose parent is archived is shown at the top rather than hidden under a row that
    // is no longer drawn.
    const parent = row.parent_id && known.has(row.parent_id) ? row.parent_id : null
    if (!kids.has(parent)) kids.set(parent, [])
    kids.get(parent)!.push(row)
  }
  // The rows arrive in position order but a page just moved has a new one, so each branch is
  // ordered again here rather than waiting for the next load.
  for (const branch of kids.values()) branch.sort((a, b) => a.position - b.position)

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

  // Dropped beside a page it becomes its sibling and takes a position between its neighbours;
  // dropped on one it goes inside, at the end. A page cannot be dropped into its own branch.
  const move = (id: string, onto: Record, where: Where) => {
    const parent = where === 'inside' ? onto.id : onto.parent_id
    if (!canReparent(rows, id, parent)) return

    const siblings = (kids.get(parent) ?? []).filter((r) => r.id !== id)
    let position: number
    if (where === 'inside') {
      position = between(siblings.at(-1) ?? null, null)
    } else {
      const at = siblings.findIndex((r) => r.id === onto.id)
      const [before, after] = where === 'above'
        ? [siblings[at - 1] ?? null, onto]
        : [onto, siblings[at + 1] ?? null]
      position = between(before, after)
    }

    patchRecord(id, { parent_id: parent, position })
    if (where === 'inside') {
      setOpen((was) => {
        const next = new Set(was).add(onto.id)
        writeOpen(next)
        return next
      })
    }
  }

  const roots = kids.get(null) ?? []

  return (
    <div className="mt-1 mb-3">
      <div className="flex items-center justify-between pl-2 pr-1">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
          {t('Pages')}
        </span>
        <span className="flex items-center gap-0.5">
          <button
            type="button"
            aria-label={t('New database')}
            title={t('New database')}
            onClick={() => void createRecord('', 'database', null).then((id) => id && go(`/d/${id}`))}
            className="grid h-5 w-5 place-items-center rounded text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
          >
            <Table2 size={13} />
          </button>
          {!!pageTemplates().length && (
            <Popover
              width={200}
              trigger={({ toggle }) => (
                <button
                  type="button"
                  aria-label={t('New page from a template')}
                  title={t('New page from a template')}
                  onClick={toggle}
                  className="grid h-5 w-5 place-items-center rounded text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
                >
                  <Copy size={12} />
                </button>
              )}
            >
              {(close) => (
                <>
                  {pageTemplates().map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => {
                        close()
                        void fromTemplate(tpl.id, null)
                          .then((made) => { if (made) go(`/d/${made}`) })
                          // A copy that half happened is worse than one that did not: silence
                          // here left a page in the tree and the person on the old screen.
                          .catch((e: Error) => alert(e.message))
                      }}
                      className="w-full truncate rounded-md px-2 py-1 text-left text-[12px] hover:bg-[#EAE6DD]"
                    >
                      {tpl.icon && <span className="mr-1.5">{tpl.icon}</span>}
                      {tpl.title || t('Untitled page')}
                    </button>
                  ))}
                </>
              )}
            </Popover>
          )}
          <button
            type="button"
            aria-label={t('New page')}
            onClick={() => add(null)}
            className="grid h-5 w-5 place-items-center rounded text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
          >
            <Plus size={13} />
          </button>
        </span>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const id = e.dataTransfer.getData('text/plain')
          if (!id) return
          patchRecord(id, { parent_id: null, position: between(roots.at(-1) ?? null, null) })
        }}
      >
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
                move={move}
              />
            ))}
          </ul>
        )
        : <p className="mt-1 px-2 text-[12px] leading-snug text-[#B6B1A6]">{t('No pages yet')}</p>}
      <div className="h-6" aria-hidden />
      </div>
    </div>
  )
}
