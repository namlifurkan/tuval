import { useEffect } from 'react'
import { arrive } from '../board/arrive'
import { readRoute, routePath, subscribeRoute } from '../board/boards'
import { lazy, Suspense, useSyncExternalStore } from 'react'
import { AuthPage } from './AuthPage'
import { Collection } from './Collection'
import { Dashboard } from './Dashboard'
import { Docs } from './Docs'
import { Inbox } from './Inbox'
import { Runs } from './Runs'
const Published = lazy(() => import('./Published').then((m) => ({ default: m.Published })))
const PublicForm = lazy(() => import('./PublicForm').then((m) => ({ default: m.PublicForm })))
const Profile = lazy(() => import('./Profile').then((m) => ({ default: m.Profile })))
const Project = lazy(() => import('./Project').then((m) => ({ default: m.Project })))
import { Issues } from './Issues'
import { Projects } from './Projects'
import { Page } from './Page'
import { Settings } from './Settings'
const SitePage = lazy(() => import('./SitePage').then((m) => ({ default: m.SitePage })))

// The front door is the front door for everybody. Signing in does not replace the page that
// explains the product; the board list has its own address.
export function Home() {
  const here = useSyncExternalStore(subscribeRoute, routePath, routePath)
  const route = readRoute()

  // Every page, not just the marketing renderer: the rule that hides a section is global.
  useEffect(arrive, [here])
  if (route.kind === 'auth') return <AuthPage />
  if (route.kind === 'settings') return <Settings />
  if (route.kind === 'issues' || route.kind === 'issue') return <Issues />
  if (route.kind === 'projects') return <Projects />
  if (route.kind === 'docs') return <Docs />
  if (route.kind === 'inbox') return <Inbox />
  if (route.kind === 'runs') return <Runs />
  if (route.kind === 'published') return <Suspense fallback={null}><Published /></Suspense>
  if (route.kind === 'form') return <Suspense fallback={null}><PublicForm /></Suspense>
  if (route.kind === 'page') return <Page key={route.id} />
  if (route.kind === 'collection') return <Collection key={route.id} />
  if (route.kind === 'profile') return <Suspense fallback={null}><Profile key={route.handle} /></Suspense>
  if (route.kind === 'project') return <Suspense fallback={null}><Project key={route.id} /></Suspense>
  if (route.kind === 'dashboard') return <Dashboard />
  return <Suspense fallback={null}><SitePage key={routePath()} /></Suspense>
}
