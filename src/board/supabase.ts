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

export const authError =
  new URLSearchParams(location.hash.replace(/^#/, '')).get('error_description') ?? ''

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

export type AuthTrouble = 'expired' | null
let trouble: AuthTrouble = null
let leaving = false
export const authTrouble = () => trouble

if (supabase) {
  void supabase.auth.getSession().then(({ data }) => announce(data.session))
  supabase.auth.onAuthStateChange((event, next) => {
    // A refresh token the server no longer knows leaves the client holding a session it can
    // never use. Supabase drops it and reports a sign-out, which on its own looks like the
    // app forgot you for no reason, so the reason is kept and shown.
    if (event === 'TOKEN_REFRESHED') trouble = null
    if (event === 'SIGNED_OUT') trouble = session && !leaving ? 'expired' : null
    leaving = false
    if (event === 'SIGNED_IN') trouble = null
    announce(next)
  })
}

export async function signIn(email: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  })
  if (error) throw error
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
}

export async function setPassword(password: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.updateUser({ password })
  if (error) throw error
}

export async function signOut() {
  leaving = true
  await supabase?.auth.signOut()
}

export const displayName = (email: string | undefined) => (email ?? '').split('@')[0] || 'user'
