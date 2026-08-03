import { useEffect, useState } from 'react'
import type { UserIdentity } from '@supabase/supabase-js'
import { linkProvider, listIdentities, unlinkProvider } from '../board/supabase'
import type { Provider } from '../board/supabase'
import { t } from '../i18n'

const NAMES: Record<Provider, string> = { github: 'GitHub', apple: 'Apple', google: 'Google' }
const ALL = Object.keys(NAMES) as Provider[]

// Connecting a provider from inside the account is the reliable direction. Signing in with
// GitHub on an address that already has an account asks the server to work out which account
// is meant, and it refuses as soon as the answer is not obvious.
export function Identities() {
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [note, setNote] = useState('')

  useEffect(() => { void listIdentities().then(setIdentities) }, [])

  const linked = new Set(identities.map((i) => i.provider))
  const missing = ALL.filter((p) => !linked.has(p))

  const drop = (identity: UserIdentity) => {
    // The last identity is the only way back in; removing it would lock the account.
    if (identities.length < 2) { setNote(t('This is the only way you can sign in.')); return }
    void unlinkProvider(identity)
      .then(() => listIdentities().then(setIdentities))
      .catch((e: Error) => setNote(e.message))
  }

  return (
    <>
      <div className="px-2.5 pb-1.5 text-xs font-semibold text-muted">{t('Sign-in methods')}</div>

      {identities.map((identity) => (
        <div key={identity.identity_id} className="flex items-center gap-2 px-2.5 py-1">
          <span className="min-w-0 flex-1 truncate text-sm text-ink">
            {NAMES[identity.provider as Provider] ?? t('Email')}
          </span>
          <button
            type="button"
            onClick={() => drop(identity)}
            className="shrink-0 rounded-md px-1.5 py-0.5 text-xs text-muted hover:bg-pigment-wash hover:text-pigment-deep"
          >
            {t('Disconnect')}
          </button>
        </div>
      ))}

      {missing.map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => { void linkProvider(provider).catch((e: Error) => setNote(e.message)) }}
          className="mx-1 mt-1 w-[calc(100%-8px)] rounded-lg border border-hairline px-2 py-1.5 text-sm font-semibold text-ink hover:border-pigment hover:text-pigment"
        >
          {t('Connect {name}', { name: NAMES[provider] })}
        </button>
      ))}

      {note && <p className="px-2.5 pt-1.5 text-[11px] leading-snug text-pigment-deep">{note}</p>}
    </>
  )
}
