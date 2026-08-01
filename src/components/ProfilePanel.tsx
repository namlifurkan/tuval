import { useEffect, useState, useSyncExternalStore } from 'react'
import { Check, Copy, Plus, X } from 'lucide-react'
import {
  HANDLE, LINKABLE, linkable, myProfile, profileUrl, saveProfile,
} from '../board/publicProfile'
import type { Profile, ProfileLink } from '../board/publicProfile'
import { avatarUrl, profileName } from '../board/profile'
import { getUser, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'

const EMPTY: Profile = { user_id: '', handle: '', name: '', bio: '', avatar: '', links: [] }

// Turning on a page of your own. Off by default and off until a name is chosen: nobody gets a
// public address as a side effect of signing in.
export function ProfilePanel() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const [held, setHeld] = useState<Profile | null>(null)
  const [draft, setDraft] = useState<Profile>(EMPTY)
  const [said, setSaid] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!user) return
    void myProfile().then((found) => {
      setHeld(found)
      setDraft(found ?? {
        ...EMPTY,
        name: profileName() || (user.email ?? '').split('@')[0],
        avatar: avatarUrl(),
      })
    })
  }, [user])

  if (!user) return null

  const bad = !HANDLE.test(draft.handle)
  const links = draft.links ?? []

  const save = () => {
    setSaid('')
    void saveProfile({
      handle: draft.handle, name: draft.name, bio: draft.bio,
      avatar: draft.avatar, links,
    }).then((wrong) => {
      setSaid(wrong ? t(wrong) : t('Saved.'))
      if (!wrong) void myProfile().then(setHeld)
    })
  }

  const setLink = (at: number, patch: Partial<ProfileLink>) =>
    setDraft((d) => ({ ...d, links: links.map((l, i) => (i === at ? { ...l, ...patch } : l)) }))

  // No width in the shared class: a w-full here beat every w-[…] set beside it, which is how the
  // label field came to take the whole row and leave the address a sliver.
  const field = 'rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2.5 py-1.5 text-sm text-[#141310] outline-none placeholder:text-[#B6B1A6] focus:border-[#C8452D]'
  const label = 'text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]'

  return (
    <div className="space-y-3">
      <div>
        <span className={label}>{t('Address')}</span>
        <div className="mt-1 flex items-center gap-1.5">
          <span className="shrink-0 text-sm text-[#8A867C]">{location.host}/u/</span>
          <input
            value={draft.handle}
            onChange={(e) => setDraft({ ...draft, handle: e.target.value.toLowerCase().trim() })}
            placeholder="furkan"
            spellCheck={false}
            className={`min-w-0 flex-1 ${field}`}
          />
        </div>
        {draft.handle && bad && (
          <p className="mt-1 text-[11px] text-[#C8452D]">
            {t('Lower case letters, numbers, dashes and underscores, two to thirty of them.')}
          </p>
        )}
      </div>

      <div>
        <span className={label}>{t('Name')}</span>
        <input
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          className={`mt-1 w-full ${field}`}
        />
      </div>

      <div>
        <span className={label}>{t('One line about you')}</span>
        <input
          value={draft.bio}
          onChange={(e) => setDraft({ ...draft, bio: e.target.value.slice(0, 160) })}
          placeholder={t('Builds things with agents and writes down how')}
          className={`mt-1 w-full ${field}`}
        />
      </div>

      <div>
        <span className={label}>{t('Links')}</span>
        <div className="mt-1 space-y-1.5">
          {links.map((link, at) => (
            <div key={at} className="flex items-center gap-1.5">
              <input
                value={link.label}
                onChange={(e) => setLink(at, { label: e.target.value })}
                placeholder={t('Label')}
                className={`w-[92px] shrink-0 ${field}`}
              />
              <input
                value={link.url}
                onChange={(e) => setLink(at, { url: e.target.value.trim() })}
                placeholder="https://buymeacoffee.com/…"
                spellCheck={false}
                className={`min-w-0 flex-1 ${field} ${link.url && !linkable(link.url) ? 'border-[#C8452D]' : ''}`}
              />
              <button
                type="button"
                onClick={() => setDraft({ ...draft, links: links.filter((_, i) => i !== at) })}
                className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#EFEBE2] hover:text-[#C8452D]"
              ><X size={14} /></button>
            </div>
          ))}
          {links.length < 8 && (
            <button
              type="button"
              onClick={() => setDraft({ ...draft, links: [...links, { label: '', url: '' }] })}
              className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EFEBE2] hover:text-[#C8452D]"
            ><Plus size={13} /> {t('Add a link')}</button>
          )}
        </div>
        <p className="mt-1.5 max-w-[62ch] text-[11px] leading-relaxed text-[#8A867C]">
          {t('Over https, and only to: {hosts}. An allow-list rather than a warning — a page that takes any address is a place to host the link in somebody else\'s scam.', { hosts: LINKABLE.join(', ') })}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="button"
          disabled={bad}
          onClick={save}
          className="rounded-lg bg-[#C8452D] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#A83621] disabled:opacity-40"
        >{t('Save')}</button>

        {held?.handle && (
          <>
            <a
              href={`/u/${held.handle}`}
              className="rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2 text-sm font-semibold text-[#141310] transition-colors hover:border-[#C8452D] hover:text-[#C8452D]"
            >{t('See it')}</a>
            <button
              type="button"
              onClick={() => {
                void navigator.clipboard.writeText(profileUrl(held.handle))
                setCopied(true)
                setTimeout(() => setCopied(false), 1600)
              }}
              className="flex items-center gap-1.5 rounded-lg px-2 py-2 text-sm font-semibold text-[#8A867C] hover:text-[#141310]"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />} {t('Copy link')}
            </button>
          </>
        )}
        {said && <span className="text-[12px] text-[#4A463E]">{said}</span>}
      </div>
    </div>
  )
}
