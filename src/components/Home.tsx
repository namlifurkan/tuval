import { readRoute } from '../board/boards'
import { lazy, Suspense } from 'react'
import { AuthPage } from './AuthPage'
import { Dashboard } from './Dashboard'
import { Docs } from './Docs'
import { Issues } from './Issues'
import { Page } from './Page'
import { Settings } from './Settings'
const Landing = lazy(() => import('./Landing').then((m) => ({ default: m.Landing })))

// The front door is the front door for everybody. Signing in does not replace the page that
// explains the product; the board list has its own address.
export function Home() {
  const route = readRoute()
  if (route.kind === 'auth') return <AuthPage />
  if (route.kind === 'settings') return <Settings />
  if (route.kind === 'issues') return <Issues />
  if (route.kind === 'docs') return <Docs />
  if (route.kind === 'page') return <Page />
  if (route.kind === 'dashboard') return <Dashboard />
  return <Suspense fallback={null}><Landing /></Suspense>
}
