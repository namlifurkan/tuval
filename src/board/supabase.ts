import { createClient } from '@supabase/supabase-js'
import type { Session, SupabaseClient, UserIdentity } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Tuval works without a backend. Everything below stays inert until both keys are set, and
// the app falls back to the local board registry and IndexedDB.
export const supabase: SupabaseClient | null = url && anonKey
  ? createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null

export const cloudEnabled = !!supabase

// A failure comes back in the hash for the implicit flow and in the query for PKCE, and the
// code matters: a stale link and a refused identity are not the same problem.
const returned = (key: string) =>
  new URLSearchParams(location.hash.replace(/^#/, '')).get(key)
  ?? new URLSearchParams(location.search).get(key)
  ?? ''

export const authError = returned('error_description')
export const authErrorCode = returned('error_code') || returned('error')
export const isStaleLink = /otp_expired|access_denied/.test(authErrorCode)

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

// Restoring a stored session is asynchronous, so anything that reads the cloud on mount would
// otherwise run signed out and come back empty. Await this first.
export const authReady: Promise<void> = supabase
  ? supabase.auth.getSession().then(({ data }) => { announce(data.session) })
  : Promise.resolve()

if (supabase) {
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
  // Signing in this way is proof enough for accounts that set a password before the flag existed.
  if (!getUser()?.user_metadata?.has_password) {
    void supabase.auth.updateUser({ data: { has_password: true } })
  }
}

// Supabase does not say whether an account has a password, so the answer is kept where it
// travels with the session: the user's own metadata.
// Only an account whose sole way in is an emailed link needs to be pushed into choosing a
// password. Connect GitHub or sign in with Google and there is already a second way back.
export const hasPassword = () => {
  const user = getUser()
  if (!user) return true
  const providers = (user.app_metadata?.providers as string[] | undefined) ?? []
  if (providers.some((p) => p !== 'email')) return true
  return !!user.user_metadata?.has_password
}

export async function setPassword(password: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.updateUser({
    password,
    data: { has_password: true },
  })
  if (error) throw error
}

export type Provider = 'github' | 'google' | 'apple'

export const MIN_PASSWORD = 8

// Typing a password you cannot see, once, into an account you then have to sign in to is how
// people lock themselves out. It is asked for twice and the two have to match.
export function passwordProblem(value: string, again: string): string | null {
  if (value.length < MIN_PASSWORD) return 'At least 8 characters.'
  if (value !== again) return 'The two passwords do not match.'
  return null
}

export async function signInWith(provider: Provider) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: location.origin + location.pathname },
  })
  if (error) throw error
}

export async function sendReset(email: string) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/reset`,
  })
  if (error) throw error
}

// Letting the server guess which account an OAuth identity belongs to is what fails when more
// than one identity already carries the address. Signed in, there is nothing to guess: the
// identity is attached to the account that asked for it.
export async function listIdentities() {
  const { data } = await supabase?.auth.getUserIdentities() ?? { data: null }
  return data?.identities ?? []
}

export async function linkProvider(provider: Provider) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo: location.origin + location.pathname },
  })
  if (error) throw error
}

export async function unlinkProvider(identity: UserIdentity) {
  if (!supabase) throw new Error('Supabase is not configured')
  const { error } = await supabase.auth.unlinkIdentity(identity)
  if (error) throw error
}

export async function signOut() {
  leaving = true
  await supabase?.auth.signOut()
}

// A GitHub account can keep its address private, and then the email prefix is nothing to go
// by. The name the provider hands over is the better answer when there is one.
// A name the person chose wins over whatever a provider handed over, which in turn beats the
// email prefix. A GitHub account can keep its address private, so the prefix is a last resort.
export const displayName = (email: string | undefined) => {
  const meta = getUser()?.user_metadata as Record<string, string> | undefined
  const given = meta?.display_name?.trim()
    || meta?.user_name || meta?.preferred_username || meta?.full_name || meta?.name
  return given || (email ?? '').split('@')[0] || 'user'
}
