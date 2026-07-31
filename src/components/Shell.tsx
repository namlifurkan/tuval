import { useSyncExternalStore } from 'react'
import { CircleDot, FileText, LayoutGrid, Settings2 } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Account } from './Account'
import { Palette } from './Palette'
import { Wordmark } from './Logo'

const NAV = [
  { path: '/dashboard', label: 'Boards', icon: LayoutGrid },
  { path: '/issues', label: 'Issues', icon: CircleDot },
  { path: '/docs', label: 'Docs', icon: FileText },
  { path: '/settings', label: 'Settings', icon: Settings2 },
]

// One frame around everything that is not a board. A board fills the window on its own, because
// the canvas is the work; everywhere else there is a workspace to move around in.
export function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const here = location.pathname.replace(/\/+$/, '') || '/'

  return (
    <div className="flex h-dvh bg-[#F2EFE9]">
      <nav className="hidden w-[212px] shrink-0 flex-col border-r border-[#E2DED5] px-3 py-4 sm:flex">
        <a href="/" className="mb-1 px-2"><Wordmark height={18} /></a>
        <span className="mb-5 truncate px-2 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
          {workspace?.name || t('Workspace')}
        </span>

        {NAV.map(({ path, label, icon: Icon }) => (
          <button
            key={path}
            type="button"
            onClick={() => go(path)}
            className={`mb-0.5 flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm font-semibold transition-colors
              ${here === path ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
          >
            <Icon size={15} strokeWidth={1.9} />
            {t(label)}
          </button>
        ))}

        <span className="mt-auto px-2 text-[11px] leading-snug text-[#B6B1A6]">
          {t('Press ⌘K for anything')}
        </span>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[#E2DED5] bg-[#F2EFE9]/92 px-6 py-3 backdrop-blur-[2px]">
          <h1 className="truncate text-[15px] font-semibold text-[#141310]">{title}</h1>
          <Account />
        </header>

        <main className="mx-auto w-full max-w-[900px] px-6 pb-24 pt-7">{children}</main>
      </div>

      <Palette />
    </div>
  )
}

export const onShell = () => readRoute().kind !== 'board'
