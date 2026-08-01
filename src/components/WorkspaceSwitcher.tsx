import { useEffect, useState, useSyncExternalStore } from 'react'
import { Building2, Check, ChevronsUpDown } from 'lucide-react'
import { setScope } from '../board/scope'
import { getUser, subscribeAuth } from '../board/supabase'
import {
  getWorkspace, listWorkspaces, setWorkspace, subscribeWorkspace,
} from '../board/workspace'
import type { Workspace } from '../board/workspace'
import { t } from '../i18n'
import { Popover } from './Popover'

// The outer scope, above the project one. A workspace is a different company's worth of work:
// its own issue numbering, its own people, its own boards. The project switcher below narrows
// what is already on screen; this one changes what is on screen.
export function WorkspaceSwitcher() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const signedIn = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const [all, setAll] = useState<Workspace[]>([])

  useEffect(() => {
    if (!signedIn) { setAll([]); return }
    void listWorkspaces().then(setAll)
  }, [signedIn, workspace])

  if (!workspace) return null

  const name = workspace.name || t('Workspace')

  // Nothing to switch to is not a menu. One workspace stays the label it has always been.
  if (all.length < 2) {
    return (
      <span className="mb-2 flex items-center gap-1.5 px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
        <span className="min-w-0 truncate">{name}</span>
      </span>
    )
  }

  // A project id belongs to the workspace it was read from, so it means nothing in the next one.
  const goTo = (id: string) => {
    if (id === workspace.id) return
    setScope('')
    setWorkspace(id)
    // shortcut: reloading drains the records, pages and boards singleton caches. Replace this
    // with explicit reset() methods when switching needs to preserve in-memory UI state.
    location.reload()
  }

  return (
    <Popover
      width={230}
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={t('Switch workspace: {name}', { name })}
          className="mb-2 flex min-h-11 w-full items-center gap-1.5 rounded-lg px-2 py-1 text-left text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C] transition-colors hover:bg-[#EAE6DD] hover:text-[#141310] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#141310]"
        >
          <Building2 size={12} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <ChevronsUpDown size={12} className="shrink-0" />
        </button>
      )}
    >
      {(close) => (
        <>
          {all.map((one) => (
            <button
              key={one.id}
              type="button"
              onClick={() => { close(); goTo(one.id) }}
              aria-current={one.id === workspace.id ? 'true' : undefined}
              className="flex min-h-11 w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-left text-[13px] hover:bg-[#EAE6DD] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#141310]"
            >
              <Building2 size={13} className="shrink-0 text-[#8A867C]" />
              <span className="min-w-0 flex-1 truncate">{one.name || one.slug}</span>
              {one.id === workspace.id && <Check size={13} className="shrink-0 text-[#C8452D]" />}
            </button>
          ))}
        </>
      )}
    </Popover>
  )
}
