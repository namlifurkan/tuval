import { createClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Tuval works without a backend. Everything below stays inert until both keys are set, and
// the app falls back to the local board registry and IndexedDB.
export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const cloudEnabled = !!supabase

let session: Session | null = null
const listeners = new Set<() => void>()

export const getSession = () => session
export const getUser = () => session?.user ?? null

export function subscribeAuth(fn: () => void) {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

function announce(next: Session | null) {
  session = next
  listeners.forEach((l) => l())
}

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => announce(data.session))
  supabase.auth.onAuthStateChange((_event, next) => announce(next))
}

export async function signIn(email: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  })
  if (error) throw error
}

export async function signOut() {
  await supabase?.auth.signOut()
}

export const displayName = (email: string | undefined) => (email ?? '').split('@')[0] || 'user'
