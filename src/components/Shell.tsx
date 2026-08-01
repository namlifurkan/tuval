import { useEffect, useSyncExternalStore } from 'react'
import { CircleDot, FileText, Inbox, LayoutGrid, Settings2, Target } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { armed } from '../board/keys'
import { loadInbox, subscribeInbox, unreadCount } from '../board/notifications'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Account } from './Account'
import { Favourites } from './Favourites'
import { PageTree } from './PageTree'
import { Palette } from './Palette'
import { Wordmark } from './Logo'

const NAV = [
  { path: '/dashboard', label: 'Boards', icon: LayoutGrid },
  { path: '/inbox', label: 'Inbox', icon: Inbox },
  { path: '/issues', label: 'Issues', icon: CircleDot },
  { path: '/projects', label: 'Projects', icon: Target },
  { path: '/docs', label: 'Docs', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings2 },
]

// One frame around everything that is not a board. A board fills the window on its own, because
// the canvas is the work; everywhere else there is a workspace to move around in.
export function Shell({ title, wide, action, children }: {
  title: string
  wide?: boolean
  action?: React.ReactNode
  children: React.ReactNode
}) {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const waiting = useSyncExternalStore(subscribeInbox, unreadCount, unreadCount)
  const here = location.pathname.replace(/\/+$/, '') || '/'

  // Asked for once wherever you land, so the badge is right on a page that is not the inbox.
  useEffect(() => { if (workspace) void loadInbox() }, [workspace])

  // g then a letter, the way every keyboard-first tracker does it.
  useEffect(() => {
    const where: { [key: string]: string } = {
      i: '/issues', p: '/projects', d: '/docs', b: '/dashboard', n: '/inbox', s: '/settings',
    }
    const key = armed('g', (second) => {
      const to = where[second]
      if (to) go(to)
      return !!to
    })
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [])

  return (
    <div className="flex h-dvh bg-[#F2EFE9]">
      <nav
        aria-label={t('Workspace')}
        className="hidden w-[228px] shrink-0 flex-col overflow-y-auto border-r border-[#E2DED5] px-3 py-4 sm:flex"
      >
        <a href="/" className="mb-1 px-2"><Wordmark height={18} /></a>
        <span className="mb-5 truncate px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
          {workspace?.name || t('Workspace')}
        </span>

        {NAV.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            type="button"
            aria-current={here === path ? 'page' : undefined}
            onClick={() => go(path)}
            className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition-colors
              ${here === path ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
          >
            <Icon size={15} strokeWidth={1.9} />
            <span className="min-w-0 flex-1 truncate">{t(label)}</span>
            {path === '/inbox' && waiting > 0 && (
              <span className="shrink-0 rounded-full bg-[#C8452D] px-1.5 text-[10px] font-bold text-white">
                {waiting}
              </span>
            )}
          </button>
        ))}

        <Favourites />

        <div className="mt-5"><PageTree /></div>

        <span className="mt-auto px-2 pt-4 text-[11px] leading-snug text-[#B6B1A6]">
          {t('Press ⌘K for anything')}
        </span>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E2DED5] bg-[#F2EFE9]/92 px-6 py-3 backdrop-blur-[2px]">
          <h1 className="truncate text-[15px] font-semibold text-[#141310]">{title}</h1>
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <Account />
          </div>
        </header>

        <main className={`mx-auto w-full px-6 pb-24 pt-7 ${wide ? 'max-w-[1180px]' : 'max-w-[900px]'}`}>
          {children}
        </main>
      </div>

      <Palette />
    </div>
  )
}

export const onShell = () => readRoute().kind !== 'board'
