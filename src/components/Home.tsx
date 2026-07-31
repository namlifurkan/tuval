import { readRoute } from '../board/boards'
import { AuthPage } from './AuthPage'
import { Dashboard } from './Dashboard'
import { Landing } from './Landing'

// The front door is the front door for everybody. Signing in does not replace the page that
// explains the product; the board list has its own address.
export function Home() {
  const route = readRoute()
  if (route.kind === 'auth') return <AuthPage />
  return route.kind === 'dashboard' ? <Dashboard /> : <Landing />
}
