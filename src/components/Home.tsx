import { useSyncExternalStore } from 'react'
import { getBoards, subscribeBoards } from '../board/boards'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { Dashboard } from './Dashboard'
import { Landing } from './Landing'

// No room in the URL means the front door. Anyone with work to come back to gets their
// boards; a true first visit meets the product before being asked for anything.
export function Home() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const local = useSyncExternalStore(subscribeBoards, getBoards, getBoards)
  if (user || !cloudEnabled || local.length) return <Dashboard />
  return <Landing />
}
