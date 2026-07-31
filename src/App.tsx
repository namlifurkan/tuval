import { lazy, Suspense, useSyncExternalStore } from 'react'
import { readRoute } from './board/boards'
import { getLang, subscribeLang } from './i18n'

// The board carries the renderer, the CRDT and the synchronisation layer; the front door, the
// account pages and the board list carry none of it. Splitting them here is what keeps signing
// in from downloading an editor.
const Board = lazy(() => import('./components/Board'))
const Home = lazy(() => import('./components/Home').then((m) => ({ default: m.Home })))

export default function App() {
  // Remount on language change: t() is read during render, not through a hook.
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang)
  const board = readRoute().kind === 'board'

  return (
    <div key={lang} className="h-dvh w-dvw bg-[#F2EFE9]">
      <Suspense fallback={null}>{board ? <Board /> : <Home />}</Suspense>
    </div>
  )
}
