import { useState, useSyncExternalStore } from 'react'
import { getUser, hasPassword, passwordProblem, setPassword, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'

// The email link proves the address once. After that an account needs a password of its own,
// so this stays until there is one. It is a band rather than a dialogue: nothing is hidden
// behind it, the board underneath keeps working.
export function PasswordGate() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const [value, setValue] = useState('')
  const [again, setAgain] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)

  if (!user || done || hasPassword()) return null

  const save = async () => {
    const problem = passwordProblem(value, again)
    if (problem) { setNote(t(problem)); return }
    setSaving(true)
    try {
      await setPassword(value)
      setDone(true)
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e))
      setSaving(false)
    }
  }

  return (
    <div className="pointer-events-auto border-b border-pigment-deep bg-pigment px-5 py-3 text-on-pigment sm:px-8">
      <div className="mx-auto flex w-full max-w-[1180px] flex-wrap items-center gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{t('Finish setting up your account')}</p>
          <p className="mt-0.5 max-w-[62ch] text-[12px] leading-snug text-on-pigment/80">
            {t('The email link confirmed {email}. Choose a password and you can sign in with it from now on.', { email: user.email ?? '' })}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void save() }}
            type="password"
            autoComplete="new-password"
            placeholder={t('New password')}
            className="w-[170px] rounded-lg border border-on-pigment/30 bg-on-pigment/10 px-2 py-1.5 text-sm text-on-pigment outline-none placeholder:text-on-pigment/60 focus:border-on-pigment"
          />
          <input
            value={again}
            onChange={(e) => setAgain(e.target.value)}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void save() }}
            type="password"
            autoComplete="new-password"
            placeholder={t('Again')}
            className="w-[150px] rounded-lg border border-on-pigment/30 bg-on-pigment/10 px-2 py-1.5 text-sm text-on-pigment outline-none placeholder:text-on-pigment/60 focus:border-on-pigment"
          />
          <button
            type="button"
            disabled={saving || !value || !again}
            onClick={() => void save()}
            className="rounded-lg bg-on-pigment px-3 py-1.5 text-sm font-semibold text-pigment disabled:opacity-50"
          >
            {saving ? t('Saving…') : t('Save password')}
          </button>
        </div>
        {note && <p className="w-full text-[12px] text-on-pigment">{note}</p>}
      </div>
    </div>
  )
}
