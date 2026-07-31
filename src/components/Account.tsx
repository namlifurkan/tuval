import { useEffect, useState, useSyncExternalStore } from 'react'
import {
  authError, authTrouble, cloudEnabled, displayName, getUser, setPassword, signIn,
  signInWithPassword, signOut, subscribeAuth,
} from '../board/supabase'
import { t } from '../i18n'
import { IconButton, Popover, usePopover } from './ui'
import { LogIn } from 'lucide-react'

const readUser = () => getUser()

export function Account() {
  const user = useSyncExternalStore(subscribeAuth, readUser, readUser)
  const pop = usePopover()
  const [email, setEmail] = useState('')
  const [password, setPass] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [reason, setReason] = useState('')
  const [fresh, setFresh] = useState('')
  const [note, setNote] = useState('')

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
      setReason(e instanceof Error ? e.message : String(e))
      setState('error')
    }
  }

  const save = async () => {
    if (fresh.length < 8) { setNote(t('At least 8 characters.')); return }
    setNote(t('Saving…'))
    try {
      await setPassword(fresh)
      setFresh('')
      setNote(t('Password saved. Next time you can sign in with it.'))
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    }
  }

  const initial = (user?.email ?? '?')[0].toUpperCase()

  return (
    <div className="relative" data-ada="account">
      {user ? (
        <button
          type="button"
          title={user.email}
          onClick={pop.toggle}
          className="grid h-8 w-8 place-items-center rounded-md bg-[#3E5C93] text-[11px] font-bold text-white"
        >
          {initial}
        </button>
      ) : (
        <IconButton title={t('Sign in')} active={pop.open} onClick={pop.toggle}>
          <LogIn size={18} strokeWidth={1.8} />
        </IconButton>
      )}

      <Popover open={pop.open} onClose={pop.close} anchor="bottomRight" className="w-[268px]">
        {user ? (
          <>
            <div className="px-2.5 pb-2 pt-1">
              <div className="text-sm font-semibold text-[#141310]">{displayName(user.email)}</div>
              <div className="truncate text-xs text-[#8A867C]">{user.email}</div>
            </div>
            <div className="my-1 h-px bg-[#EAE6DD]" />
            <div className="px-2.5 pb-1.5 text-xs font-semibold text-[#8A867C]">{t('Password')}</div>
            <input
              value={fresh}
              onChange={(e) => setFresh(e.target.value)}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void save() }}
              type="password"
              autoComplete="new-password"
              placeholder={t('New password')}
              className="mx-1 mb-1.5 w-[calc(100%-8px)] rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-sm outline-none focus:border-[#C8452D]"
            />
            <button
              type="button"
              disabled={!fresh}
              onClick={() => void save()}
              className="mx-1 w-[calc(100%-8px)] rounded-lg border border-[#E2DED5] px-2 py-1.5 text-sm font-semibold text-[#141310] hover:bg-[#EFEBE2] disabled:opacity-40"
            >
              {t('Save password')}
            </button>
            {note && (
              <p className="px-2.5 pt-1.5 text-[11px] leading-snug text-[#8A867C]">{note}</p>
            )}
            <div className="my-1.5 h-px bg-[#EAE6DD]" />
            <p className="px-2.5 pb-2 text-[11px] leading-snug text-[#8A867C]">
              {t('Your boards are saved to the cloud and reachable from any device.')}
            </p>
            <button
              type="button"
              onClick={() => { void signOut(); pop.close() }}
              className="w-full rounded-lg px-2.5 py-1.5 text-left text-sm hover:bg-[#EFEBE2]"
            >
              {t('Sign out')}
            </button>
          </>
        ) : (
          <>
            <div className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-[#8A867C]">{t('Sign in')}</div>
            {authError && state === 'idle' && (
              <p className="mx-1 mb-2 rounded-lg border border-[#E2DED5] bg-[#F7E9E4] px-2 py-1.5 text-[11px] leading-snug text-[#141310]">
                {t('That sign-in link no longer works: {reason}. Links are single use and they expire, so ask for a fresh one below.', { reason: authError })}
              </p>
            )}
            {state === 'sent' ? (
              <p className="px-2.5 pb-2 text-sm leading-snug text-[#141310]">
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
                  className="mx-1 mb-2 w-[calc(100%-8px)] rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-sm outline-none focus:border-[#C8452D]"
                />
                <input
                  value={password}
                  onChange={(e) => setPass(e.target.value)}
                  onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void send() }}
                  type="password"
                  autoComplete="current-password"
                  placeholder={t('Password (leave empty for a link)')}
                  className="mx-1 mb-2 w-[calc(100%-8px)] rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-sm outline-none focus:border-[#C8452D]"
                />
                <button
                  type="button"
                  disabled={state === 'sending' || !email.trim()}
                  onClick={() => void send()}
                  className="mx-1 w-[calc(100%-8px)] rounded-lg bg-[#C8452D] px-2 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {state === 'sending' ? t('Sending…') : password ? t('Sign in') : t('Send link')}
                </button>
              </>
            )}
            {state === 'error' && (
              <p className="px-2.5 pt-2 text-[11px] leading-snug text-[#DC2626]">{reason}</p>
            )}
            {authTrouble() === 'expired' && (
              <p className="px-2.5 pb-1 pt-2 text-[11px] leading-snug text-[#DC2626]">
                {t('Your session expired and could not be renewed. Sign in again.')}
              </p>
            )}
            <p className="px-2.5 pb-1 pt-2 text-[11px] leading-snug text-[#8A867C]">
              {t('First time: leave the password empty and confirm the link we email you. Then set a password from this menu and sign in with it. Without signing in Tuval keeps working, but boards stay in this browser only.')}
            </p>
          </>
        )}
      </Popover>
    </div>
  )
}
