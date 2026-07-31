import { readRoute } from '../board/boards'
import { Dashboard } from './Dashboard'
import { Landing } from './Landing'

// The front door is the front door for everybody. Signing in does not replace the page that
// explains the product; the board list has its own address.
export function Home() {
  return readRoute().kind === 'dashboard' ? <Dashboard /> : <Landing />
}
