import { useEffect, useSyncExternalStore } from 'react'
import { Bot, CircleDot, FileText, Inbox, LayoutGrid, Settings2, Target } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { openJournal } from '../board/journal'
import { armed } from '../board/keys'
import { loadInbox, subscribeInbox, unreadCount } from '../board/notifications'
import { getWorkspace, loadWorkspace, subscribeWorkspace, workspaceError } from '../board/workspace'
import { t } from '../i18n'
import { Account } from './Account'
import { Collections } from './Collections'
import { ProjectSwitcher } from './ProjectSwitcher'
import { WorkspaceSwitcher } from './WorkspaceSwitcher'
import { Favourites } from './Favourites'
import { PageTree } from './PageTree'
import { Palette } from './Palette'
import { Wordmark } from './Logo'

const NAV = [
  { path: '/dashboard', label: 'Boards', icon: LayoutGrid },
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/runs', label: 'Agent runs', icon: Bot },
  { path: '/issues', label: 'Issues', icon: CircleDot },
  { path: '/projects', label: 'Projects', icon: Target },
  { path: '/pages', label: 'Docs', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings2 },
]

// One frame around everything that is not a board. A board fills the window on its own, because
// the canvas is the work; everywhere else there is a workspace to move around in.
export function Shell({ title, wide, bare, action, children }: {
  title: string
  wide?: boolean
  // A screen that draws its own title — a page, a project, a collection — asks for the heading
  // to be left out rather than being given one twice.
  bare?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const workspaceProblem = useSyncExternalStore(subscribeWorkspace, workspaceError, workspaceError)
  const waiting = useSyncExternalStore(subscribeInbox, unreadCount, unreadCount)
  const here = location.pathname.replace(/\/+$/, '') || '/'

  // Asked for once wherever you land, so the badge is right on a page that is not the inbox.
  useEffect(() => { if (workspace) void loadInbox() }, [workspace])

  // g then a letter, the way every keyboard-first tracker does it.
  useEffect(() => {
    const where: { [key: string]: string } = {
      i: '/issues', p: '/projects', d: '/pages', b: '/dashboard', n: '/inbox', s: '/settings',
    }
    const key = armed('g', (second) => {
      if (second === 'j') { void openJournal(); return true }
      const to = where[second]
      if (to) go(to)
      return !!to
    })
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  return (
    <div className="flex h-dvh bg-paper">
      <nav
        aria-label={t('Workspace')}
        className="hidden w-[228px] shrink-0 flex-col overflow-y-auto border-r border-hairline px-3 py-4 sm:flex"
      >
        <a href="/" className="mb-1 px-2"><Wordmark height={18} /></a>
        <WorkspaceSwitcher />
        <ProjectSwitcher />

        {NAV.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            type="button"
            aria-current={here === path ? 'page' : undefined}
            onClick={() => go(path)}
            className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition-colors
              ${here === path ? 'bg-[#F7E9E4] text-pigment' : 'text-ink-soft hover:bg-shade'}`}
          >
            <Icon size={15} strokeWidth={1.9} />
            <span className="min-w-0 flex-1 truncate">{t(label)}</span>
            {path === '/inbox' && waiting > 0 && (
              <span className="shrink-0 rounded-full bg-pigment px-1.5 text-[10px] font-bold text-white">
                {waiting}
              </span>
            )}
          </button>
        ))}

        <Favourites />

        <div className="mt-5"><PageTree /></div>

        <Collections />

        <span className="mt-auto px-2 pt-4 text-[11px] leading-snug text-[#B6B1A6]">
          {t('Press ⌘K for anything')}
        </span>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        {/* The bar names where you are; it is not the page's title. Putting the only heading in
            a 15px sticky strip is how every screen ended up with a button as its largest type. */}
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-hairline bg-paper/92 px-6 py-3 backdrop-blur-[2px]">
          <p className="truncate text-[13px] font-semibold text-muted">{title}</p>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <Account />
          </div>
        </header>

        <main className={`mx-auto w-full px-6 pb-24 pt-8 ${wide ? 'max-w-[1180px]' : 'max-w-[900px]'}`}>
          {workspaceProblem && (
            <div className="mb-5 flex items-center gap-3 rounded-lg border border-hairline bg-[#F7E9E4] px-3 py-2 text-sm text-ink-soft">
              <span className="min-w-0 flex-1">{t('Could not load the workspace.')}</span>
              <button
                type="button"
                onClick={() => { void loadWorkspace() }}
                className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-pigment hover:bg-surface"
              >{t('Try again')}</button>
            </div>
          )}
          {!bare && (
            <h1
              className="mb-7 font-bold leading-[1.02] tracking-[-0.035em] text-ink"
              style={{ fontSize: 'clamp(1.9rem, 3.4vw, 2.6rem)' }}
            >{title}</h1>
          )}
          {children}
        </main>
      </div>

      <Palette />
    </div>
  )
}

export const onShell = () => readRoute().kind !== 'board'
