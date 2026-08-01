import { readRoute, routePath, subscribeRoute } from '../board/boards'
import { lazy, Suspense, useSyncExternalStore } from 'react'
import { AuthPage } from './AuthPage'
import { Dashboard } from './Dashboard'
import { Docs } from './Docs'
import { Inbox } from './Inbox'
const Published = lazy(() => import('./Published').then((m) => ({ default: m.Published })))
import { Issues } from './Issues'
import { Projects } from './Projects'
import { Page } from './Page'
import { Settings } from './Settings'
const Landing = lazy(() => import('./Landing').then((m) => ({ default: m.Landing })))

// The front door is the front door for everybody. Signing in does not replace the page that
// explains the product; the board list has its own address.
export function Home() {
  useSyncExternalStore(subscribeRoute, routePath, routePath)
  const route = readRoute()
  if (route.kind === 'auth') return <AuthPage />
  if (route.kind === 'settings') return <Settings />
  if (route.kind === 'issues' || route.kind === 'issue') return <Issues />
  if (route.kind === 'projects') return <Projects />
  if (route.kind === 'docs') return <Docs />
  if (route.kind === 'inbox') return <Inbox />
  if (route.kind === 'published') return <Suspense fallback={null}><Published /></Suspense>
  if (route.kind === 'page') return <Page key={route.id} />
  if (route.kind === 'dashboard') return <Dashboard />
  return <Suspense fallback={null}><Landing /></Suspense>
}
