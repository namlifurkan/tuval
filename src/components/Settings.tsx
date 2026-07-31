import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { go, goHome } from '../board/boards'
import { initials } from '../board/me'
import { avatarUrl, profileName, setProfile, uploadAvatar } from '../board/profile'
import {
  displayName, getUser, hasPassword, passwordProblem, setPassword, signOut, subscribeAuth,
} from '../board/supabase'
import { getLang, LANGS, setLang, subscribeLang, t } from '../i18n'
import { Identities } from './Identities'
import { Wordmark } from './Logo'

const field = 'w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#C8452D]'
const button = 'rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2 text-sm font-semibold text-[#141310] transition-colors hover:border-[#C8452D] hover:text-[#C8452D] disabled:opacity-40'

function Row({ title, note, children }: {
  title: string
  note?: string
  children: React.ReactNode
}) {
  return (
    <section className="border-t border-[#E2DED5] py-7 first:border-t-0 first:pt-0">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">{title}</h2>
      {note && <p className="mt-1.5 max-w-[62ch] text-[12px] leading-relaxed text-[#8A867C]">{note}</p>}
      <div className="mt-4 max-w-[420px]">{children}</div>
    </section>
  )
}

export function Settings() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const lang = useSyncExternalStore(subscribeLang, getLang, getLang)
  const file = useRef<HTMLInputElement>(null)

  const [name, setName] = useState('')
  const [face, setFace] = useState('')
  const [saved, setSaved] = useState('')
  const [busy, setBusy] = useState(false)

  const [fresh, setFresh] = useState('')
  const [again, setAgain] = useState('')
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!user) { go('/login'); return }
    setName(profileName() || displayName(user.email))
    setFace(avatarUrl())
  }, [user])

  if (!user) return null

  const saveProfile = async () => {
    setBusy(true)
    try {
      await setProfile({ display_name: name.trim(), avatar_url: face })
      setSaved(t('Saved'))
    } catch (e) {
      setSaved(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const pickFace = async (chosen: File) => {
    setBusy(true)
    try {
      const url = await uploadAvatar(chosen)
      setFace(url)
      await setProfile({ avatar_url: url })
      setSaved(t('Saved'))
    } catch (e) {
      setSaved(e instanceof Error ? e.message : String(e))
    }
    setBusy(false)
  }

  const savePassword = async () => {
    const problem = passwordProblem(fresh, again)
    if (problem) { setNote(t(problem)); return }
    try {
      await setPassword(fresh)
      setFresh('')
      setAgain('')
      setNote(t('Saved'))
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="h-dvh overflow-y-auto bg-[#F2EFE9]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E2DED5] bg-[#F2EFE9]/92 px-6 py-3 backdrop-blur-[2px] sm:px-10">
        <a href="/" aria-label={t('Home')}><Wordmark height={18} /></a>
        <button type="button" onClick={goHome} className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#141310] hover:bg-[#EAE6DD]">
          {t('Your boards')}
        </button>
      </header>

      <main className="mx-auto w-full max-w-[720px] px-6 pb-24 pt-8 sm:px-10">
        <h1 className="mb-8 font-[600] text-[clamp(1.5rem,3vw,2rem)] leading-none tracking-[-0.015em] text-[#141310]">
          {t('Account')}
        </h1>

        <Row title={t('Profile')} note={t('This is the name and face the rest of your team sees on a board.')}>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => file.current?.click()}
              className="group relative grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-[#E2DED5] bg-[#3E5C93] text-lg font-bold text-white"
            >
              {face
                ? <img src={face} alt="" className="h-full w-full object-cover" />
                : initials(name || displayName(user.email))}
              <span className="absolute inset-0 grid place-items-center bg-[#141310]/60 text-[10px] font-semibold uppercase tracking-[0.13em] text-white opacity-0 transition-opacity group-hover:opacity-100">
                {t('Change')}
              </span>
            </button>
            <input
              ref={file}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const chosen = e.target.files?.[0]
                e.target.value = ''
                if (chosen) void pickFace(chosen)
              }}
            />
            <div className="min-w-0 flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('Your name')}
                className={field}
              />
              <p className="mt-1.5 truncate text-[12px] text-[#8A867C]">{user.email}</p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <button type="button" disabled={busy} onClick={() => void saveProfile()} className={button}>
              {busy ? t('Saving…') : t('Save')}
            </button>
            {saved && <span className="text-[12px] text-[#8A867C]">{saved}</span>}
          </div>
        </Row>

        <Row
          title={t('Password')}
          note={hasPassword() ? undefined : t('This account has no password yet, so an emailed link is the only way in.')}
        >
          <div className="grid gap-2">
            <input
              value={fresh}
              onChange={(e) => setFresh(e.target.value)}
              type="password"
              autoComplete="new-password"
              placeholder={t('New password')}
              className={field}
            />
            <input
              value={again}
              onChange={(e) => setAgain(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void savePassword() }}
              type="password"
              autoComplete="new-password"
              placeholder={t('Again')}
              className={field}
            />
          </div>
          <div className="mt-3 flex items-center gap-3">
            <button type="button" disabled={!fresh || !again} onClick={() => void savePassword()} className={button}>
              {t('Save password')}
            </button>
            {note && <span className="text-[12px] text-[#8A867C]">{note}</span>}
          </div>
        </Row>

        <Row title={t('Sign-in methods')} note={t('Connect a provider here rather than signing in with it: an account is chosen, not guessed.')}>
          <div className="rounded-xl border border-[#E2DED5] bg-[#FCFBF8] py-2">
            <Identities />
          </div>
        </Row>

        <Row title={t('Language')}>
          <div className="flex gap-2">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLang(l.id)}
                className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors
                  ${lang === l.id ? 'bg-[#F7E9E4] text-[#C8452D]' : 'hover:bg-[#EAE6DD]'}`}
              >{l.name}</button>
            ))}
          </div>
        </Row>

        <Row title={t('Signing out')} note={t('Boards stay in the cloud; this browser simply forgets who you are.')}>
          <button type="button" onClick={() => { void signOut(); go('/') }} className={button}>
            {t('Sign out')}
          </button>
        </Row>
      </main>
    </div>
  )
}
