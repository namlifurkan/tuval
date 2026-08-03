import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  authError, authMessage, authTrouble, cloudEnabled, isStaleLink, displayName, getUser, signIn, signInWith,
  signInWithPassword, signOut, subscribeAuth,
} from '../board/supabase'
import { go } from '../board/boards'
import { initials } from '../board/me'
import { avatarUrl } from '../board/profile'
import { myProfile } from '../board/publicProfile'
import { t } from '../i18n'
import { IconButton, Popover, usePopover } from './ui'
import { LogIn } from 'lucide-react'

const PROVIDERS = [
  {
    id: 'github' as const,
    name: 'GitHub',
    path: 'M12 .5C5.7.5.5 5.7.5 12a11.5 11.5 0 0 0 7.9 10.9c.6.1.8-.2.8-.6v-2c-3.2.7-3.9-1.5-3.9-1.5-.5-1.3-1.3-1.7-1.3-1.7-1-.7.1-.7.1-.7 1.1.1 1.7 1.2 1.7 1.2 1 1.8 2.7 1.3 3.4 1 .1-.7.4-1.3.7-1.6-2.6-.3-5.3-1.3-5.3-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.1 0 0 1-.3 3.2 1.2a11 11 0 0 1 5.8 0c2.2-1.5 3.2-1.2 3.2-1.2.6 1.6.2 2.8.1 3.1.8.8 1.2 1.8 1.2 3.1 0 4.5-2.7 5.5-5.3 5.8.4.4.8 1.1.8 2.2v3.3c0 .4.2.7.8.6A11.5 11.5 0 0 0 23.5 12C23.5 5.7 18.3.5 12 .5Z',
  },
  {
    id: 'apple' as const,
    name: 'Apple',
    path: 'M17.05 12.54c0-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.69 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.18-1.54 2.67-.39 6.63 1.11 8.8.73 1.06 1.6 2.25 2.74 2.21 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.18-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5ZM14.86 5.6c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.69-.92 2.69.97.07 1.96-.49 2.58-1.22Z',
  },
  {
    id: 'google' as const,
    name: 'Google',
    path: 'M12 11v3.3h4.7c-.2 1.2-1.4 3.5-4.7 3.5-2.8 0-5.1-2.3-5.1-5.2S9.2 7.4 12 7.4c1.6 0 2.7.7 3.3 1.3l2.3-2.2C16.1 5.1 14.2 4.3 12 4.3 7.7 4.3 4.2 7.8 4.2 12s3.5 7.7 7.8 7.7c4.5 0 7.5-3.2 7.5-7.6 0-.5 0-.9-.1-1.1H12Z',
  },
]

const readUser = () => getUser()

export function Account() {
  const user = useSyncExternalStore(subscribeAuth, readUser, readUser)
  const pop = usePopover()
  const [email, setEmail] = useState('')
  const [password, setPass] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [reason, setReason] = useState('')
  // The address somebody hands out is not one they should have to go to settings to find again.
  const [mine, setMine] = useState('')

  useEffect(() => {
    if (!user) { setMine(''); return }
    void myProfile().then((found) => setMine(found?.handle ?? ''))
  }, [user])

  const { setOpen } = pop
  useEffect(() => {
    if (!authError || user) return
    const id = setTimeout(() => setOpen(true), 300)
    return () => clearTimeout(id)
  }, [setOpen, user])

  if (!cloudEnabled) return null

  const send = async () => {
    const mail = email.trim()
    if (!mail) return
    setState('sending')
    try {
      if (password) {
        await signInWithPassword(mail, password)
        setPass('')
        setState('idle')
      } else {
        await signIn(mail)
        setState('sent')
      }
    } catch (e) {
      setReason(t(authMessage(e)))
      setState('error')
    }
  }

  const face = avatarUrl()
  const initial = initials(displayName(user?.email))

  return (
    <div className="relative" data-ada="account">
      {user ? (
        <button
          type="button"
          title={user.email}
          onClick={pop.toggle}
          className="grid h-8 w-8 place-items-center overflow-hidden rounded-md bg-[#3E5C93] text-[11px] font-bold text-white"
        >
          {face ? <img src={face} alt="" className="h-full w-full object-cover" /> : initial}
        </button>
      ) : (
        <IconButton title={t('Sign in')} onClick={() => go('/login')}>
          <LogIn size={18} strokeWidth={1.8} />
        </IconButton>
      )}

      <Popover open={pop.open} onClose={pop.close} anchor="bottomRight" className="w-[268px]">
        {user ? (
          <>
            <div className="flex items-center gap-2.5 px-2.5 pb-2 pt-1">
              <span className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-md bg-[#3E5C93] text-xs font-bold text-white">
                {face ? <img src={face} alt="" className="h-full w-full object-cover" /> : initial}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-ink">{displayName(user.email)}</div>
                <div className="truncate text-xs text-muted">{user.email}</div>
              </div>
            </div>
            <div className="my-1 h-px bg-shade" />
            {mine && (
              <a
                href={`/u/${mine}`}
                className="block w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-tint"
              >
                {t('Your page')}
              </a>
            )}
            <button
              type="button"
              onClick={() => go('/settings')}
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-tint"
            >
              {t('Account settings')}
            </button>
            <button
              type="button"
              onClick={() => { void signOut(); pop.close() }}
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-tint"
            >
              {t('Sign out')}
            </button>
          </>
        ) : (
          <>
            <div className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-muted">{t('Sign in')}</div>
            <div className="mx-1 mb-2 grid grid-cols-3 gap-1">
              {PROVIDERS.map(({ id, name, path }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => { void signInWith(id).catch((e: Error) => { setReason(t(authMessage(e))); setState('error') }) }}
                  className="flex items-center justify-center gap-1 rounded-lg border border-hairline bg-surface px-1.5 py-1.5 text-[13px] font-semibold text-ink transition-colors hover:border-pigment hover:text-pigment"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                    <path d={path} />
                  </svg>
                  {name}
                </button>
              ))}
            </div>
            <div className="mx-2.5 mb-2 flex items-center gap-2 text-[10px] uppercase tracking-[0.13em] text-[#B6B1A6]">
              <span className="h-px flex-1 bg-shade" />{t('or')}<span className="h-px flex-1 bg-shade" />
            </div>
            {authError && state === 'idle' && (
              <p className="mx-1 mb-2 rounded-lg border border-hairline bg-[#F7E9E4] px-2 py-1.5 text-[11px] leading-snug text-ink">
                {isStaleLink
                  ? t('That sign-in link no longer works: {reason}. Links are single use and they expire, so ask for a fresh one below.', { reason: authError })
                  : t('Signing in did not go through: {reason}', { reason: authError })}
              </p>
            )}
            {state === 'sent' ? (
              <p className="px-2.5 pb-2 text-sm leading-snug text-ink">
                {t('Check {email} for a sign-in link.', { email })}
              </p>
            ) : (
              <>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void send() }}
                  type="email"
                  placeholder="you@company.com"
                  spellCheck={false}
                  className="mx-1 mb-2 w-[calc(100%-8px)] rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-pigment"
                />
                <input
                  value={password}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void send() }}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('Password (leave empty for a link)')}
                  className="mx-1 mb-2 w-[calc(100%-8px)] rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-pigment"
                />
                <button
                  type="button"
                  disabled={state === 'sending' || !email.trim()}
                  onClick={() => void send()}
                  className="mx-1 w-[calc(100%-8px)] rounded-lg bg-pigment px-2 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {state === 'sending' ? t('Sending…') : password ? t('Sign in') : t('Send link')}
                </button>
              </>
            )}
            {state === 'error' && (
              <p className="px-2.5 pt-2 text-[11px] leading-snug text-[#943321]">{reason}</p>
            )}
            {authTrouble() === 'expired' && (
              <p className="px-2.5 pb-1 pt-2 text-[11px] leading-snug text-[#943321]">
                {t('Your session expired and could not be renewed. Sign in again.')}
              </p>
            )}
            <p className="px-2.5 pb-1 pt-2 text-[11px] leading-snug text-muted">
              {t('First time with an address: leave the password empty, confirm the link we email you, then pick a password. Without signing in Tuval keeps working, but boards stay in this browser only.')}
            </p>
          </>
        )}
      </Popover>
    </div>
  )
}
