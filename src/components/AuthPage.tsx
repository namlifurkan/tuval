import { useEffect, useState, useSyncExternalStore } from 'react'
import { go, goHome, readRoute } from '../board/boards'
import type { AuthPage as Page } from '../board/boards'
import {
  authError, getUser, isStaleLink, sendReset, setPassword, signIn, signInWith, signInWithPassword,
  subscribeAuth,
} from '../board/supabase'
import type { Provider } from '../board/supabase'
import { t } from '../i18n'
import { Wordmark } from './Logo'

const PROVIDERS: { id: Provider; name: string; path: string }[] = [
  {
    id: 'github',
    name: 'GitHub',
    path: 'M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5Z',
  },
  {
    id: 'apple',
    name: 'Apple',
    path: 'M17.05 12.54c0-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.63 1.11 8.8.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5ZM14.86 5.6c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.49 2.58-1.22Z',
  },
  {
    id: 'google',
    name: 'Google',
    path: 'M12 11v3.3h4.7c-.2 1.2-1.4 3.5-4.7 3.5-2.8 0-5.1-2.3-5.1-5.2S9.2 7.4 12 7.4c1.6 0 2.7.7 3.3 1.3l2.3-2.2C16.1 5.1 14.2 4.3 12 4.3 7.7 4.3 4.2 7.8 4.2 12s3.5 7.7 7.8 7.7c4.5 0 7.5-3.2 7.5-7.6 0-.5 0-.9-.1-1.1H12Z',
  },
]

const field = 'w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#C8452D]'
const primary = 'w-full rounded-lg bg-[#C8452D] px-3 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#A83621] disabled:opacity-40'
const quiet = 'text-[13px] font-semibold text-[#C8452D] hover:underline'

const COPY: Record<Page, { title: string; blurb: string }> = {
  login: {
    title: 'Sign in',
    blurb: 'Your boards follow you to any device.',
  },
  register: {
    title: 'Create an account',
    blurb: 'No password to begin with: confirm the address by email, then choose one.',
  },
  forgot: {
    title: 'Reset your password',
    blurb: 'We email a link that lets you set a new one.',
  },
  reset: {
    title: 'Choose a new password',
    blurb: 'You are signed in from the link. Pick a password and it is done.',
  },
}

export function AuthPage() {
  const route = readRoute()
  const page: Page = route.kind === 'auth' ? route.page : 'login'
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)

  const [email, setEmail] = useState('')
  const [password, setPass] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'sent' | 'error'>('idle')
  const [reason, setReason] = useState('')

  // A password reset lands here already signed in; anywhere else, being signed in means there
  // is nothing to do on this page.
  useEffect(() => {
    if (user && page !== 'reset') goHome()
  }, [user, page])

  const run = async (work: () => Promise<void>, after: 'sent' | 'idle') => {
    setState('busy')
    try {
      await work()
      setState(after)
    } catch (e) {
      setReason(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }

  const submit = () => {
    if (page === 'forgot') return run(() => sendReset(email.trim()), 'sent')
    if (page === 'reset') {
      if (password.length < 8) { setReason(t('At least 8 characters.')); setState('error'); return }
      return run(async () => { await setPassword(password); goHome() }, 'idle')
    }
    if (!email.trim()) return
    if (password) return run(() => signInWithPassword(email.trim(), password), 'idle')
    return run(() => signIn(email.trim()), 'sent')
  }

  const copy = COPY[page]

  return (
    <div className="grid min-h-dvh place-items-center bg-[#F2EFE9] px-5 py-12">
      <div className="w-full max-w-[380px]">
        <a href="/" className="inline-block"><Wordmark height={20} /></a>

        <h1 className="mt-7 text-[26px] font-bold leading-tight tracking-[-0.015em] text-[#141310]">
          {t(copy.title)}
        </h1>
        <p className="mt-1.5 text-sm leading-relaxed text-[#4A463E]">{t(copy.blurb)}</p>

        {authError && (
          <p className="mt-4 rounded-lg border border-[#E2DED5] bg-[#F7E9E4] px-3 py-2 text-[12px] leading-snug text-[#141310]">
            {isStaleLink
              ? t('That sign-in link no longer works: {reason}. Links are single use and they expire, so ask for a fresh one below.', { reason: authError })
              : t('Signing in did not go through: {reason}', { reason: authError })}
          </p>
        )}

        {state === 'sent' ? (
          <p className="mt-6 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-3 text-sm leading-relaxed text-[#141310]">
            {t('Check {email} for a link. It works once and expires.', { email })}
          </p>
        ) : (
          <div className="mt-6 grid gap-2">
            {page !== 'reset' && (
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                type="email"
                autoComplete="email"
                placeholder="you@company.com"
                spellCheck={false}
                className={field}
              />
            )}
            {page !== 'forgot' && (
              <input
                value={password}
                onChange={(e) => setPass(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') void submit() }}
                type="password"
                autoComplete={page === 'login' ? 'current-password' : 'new-password'}
                placeholder={page === 'login' ? t('Password (leave empty for a link)') : t('New password')}
                className={field}
              />
            )}
            <button type="button" disabled={state === 'busy'} onClick={() => void submit()} className={primary}>
              {state === 'busy' ? t('Sending…')
                : page === 'reset' ? t('Save password')
                  : page === 'forgot' ? t('Send link')
                    : password ? t('Sign in') : t('Send link')}
            </button>
          </div>
        )}

        {state === 'error' && (
          <p className="mt-3 text-[12px] leading-snug text-[#DC2626]">{reason}</p>
        )}

        {(page === 'login' || page === 'register') && (
          <>
            <div className="my-5 flex items-center gap-3 text-[10px] uppercase tracking-[0.13em] text-[#B6B1A6]">
              <span className="h-px flex-1 bg-[#E2DED5]" />{t('or')}<span className="h-px flex-1 bg-[#E2DED5]" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              {PROVIDERS.map(({ id, name, path }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { void signInWith(id).catch((e: Error) => { setReason(e.message); setState('error') }) }}
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-2.5 text-[13px] font-semibold text-[#141310] transition-colors hover:border-[#C8452D] hover:text-[#C8452D]"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={path} />
                  </svg>
                  {name}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-[#8A867C]">
          {page === 'login' && (
            <>
              <button type="button" onClick={() => go('/register')} className={quiet}>{t('Create an account')}</button>
              <button type="button" onClick={() => go('/forgot')} className={quiet}>{t('Forgot your password?')}</button>
            </>
          )}
          {page === 'register' && (
            <button type="button" onClick={() => go('/login')} className={quiet}>{t('I already have an account')}</button>
          )}
          {(page === 'forgot' || page === 'reset') && (
            <button type="button" onClick={() => go('/login')} className={quiet}>{t('Back to sign in')}</button>
          )}
        </div>

        <p className="mt-8 max-w-[46ch] text-[11px] leading-relaxed text-[#8A867C]">
          {t('Without an account Tuval still works: boards live in this browser and nothing leaves it.')}
        </p>
      </div>
    </div>
  )
}
