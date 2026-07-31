import { useSyncExternalStore } from 'react'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { Dashboard } from './Dashboard'
import { Landing } from './Landing'

// No room in the URL means the front door. A signed-in person wants their boards; anybody
// else should meet the product before being asked for anything.
export function Home() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  if (user || !cloudEnabled) return <Dashboard />
  return <Landing />
}
