import { Check, Link2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getMeta, room } from '../board/doc'
import {
  getDomainAccess, invite, listInvites, listMembers, mailInvite, myDomain, myRole, removeMember,
  revokeInvite, setDomainAccess, setMemberRole,
} from '../board/cloud'
import type { DomainAccess, Invite, Member } from '../board/cloud'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'
import { Popover, usePopover } from './ui'

type Role = 'editor' | 'viewer'

const ROLES: Role[] = ['editor', 'viewer']

const boardName = () => (getMeta().name as string) ?? ''

export function Share() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const pop = usePopover()
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [role, setRole] = useState<'owner' | Role | null>(null)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('editor')
  const [note, setNote] = useState('')
  const [domain, setDomain] = useState<DomainAccess>({ domain: null, role: 'editor' })
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    if (!user) return
    void listMembers(room).then(setMembers)
    void listInvites(room).then(setInvites)
    void myRole(room).then(setRole)
    void getDomainAccess(room).then(setDomain)
  }, [user])

  useEffect(() => { if (pop.open) refresh() }, [pop.open, refresh])

  const boardLink = () => `${location.origin}${location.pathname}#${room}`

  const copyLink = () => {
    navigator.clipboard?.writeText(boardLink())
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  // Tuval has no mail server. Access is granted the moment the row lands; this only opens a
  // prepared draft so the invite actually reaches a human, and you send it yourself.
  const draft = (to: string) => {
    const subject = t('Tuval board: {name}', { name: boardName() || t('Untitled board') })
    const body = [
      t('I have given you access to a board on Tuval.'),
      '',
      boardLink(),
      '',
      t('Open the link and sign in with this address to see it.'),
    ].join('\n')
    location.href = `mailto:${encodeURIComponent(to)}`
      + `?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  }

  if (!cloudEnabled) {
    return (
      <button
        type="button"
        onClick={copyLink}
        className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#141310] transition-colors hover:bg-[#EAE6DD]"
      >
        {copied ? t('Copied') : t('Copy link')}
      </button>
    )
  }

  const owner = role === 'owner'

  const send = async () => {
    const to = email.trim()
    if (!to) return
    setNote(t('Sending…'))
    const problem = await invite(room, to, newRole)
    if (problem) { setNote(problem); return }
    setEmail('')
    refresh()
    const mail = await mailInvite(to, boardLink())
    setNote(mail
      ? t('Access granted, but the email failed: {reason}', { reason: mail })
      : t('Invite emailed to {email}.', { email: to }))
  }

  return (
    <div className="relative" data-ada="share">
      <button
        type="button"
        onClick={pop.toggle}
        className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-[#141310] transition-colors hover:bg-[#EAE6DD]"
      >
        {t('Share')}
      </button>

      <Popover open={pop.open} onClose={pop.close} anchor="bottomRight" className="w-[320px]">
        <button
          type="button"
          onClick={copyLink}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-[#EFEBE2]"
        >
          {copied ? <Check size={15} className="text-[#5E9A8A]" /> : <Link2 size={15} />}
          {copied ? t('Copied') : t('Copy link')}
        </button>

        {!user && (
          <p className="px-2.5 pb-1 pt-1 text-[11px] leading-snug text-[#8A867C]">
            {t('Sign in to invite people. Right now this board only exists in your browser.')}
          </p>
        )}

        {user && owner && (
          <>
            <div className="my-1 h-px bg-[#EAE6DD]" />
            <div className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-[#8A867C]">{t('Invite')}</div>
            <div className="flex gap-1 px-1">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void send() }}
                type="email"
                placeholder="teammate@company.com"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-sm outline-none focus:border-[#C8452D]"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="shrink-0 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-1 py-1.5 text-xs outline-none"
              >
                {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!email.trim()}
              className="mx-1 mt-1 w-[calc(100%-8px)] rounded-lg bg-[#C8452D] px-2 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
            >
              {t('Send invite')}
            </button>
            {note && (
              <p className={`px-2.5 pt-1.5 text-[11px] leading-snug ${
                /failed|error|rate/i.test(note) ? 'text-[#DC2626]' : 'text-[#8A867C]'
              }`}>{note}</p>
            )}
          </>
        )}

        {user && owner && (
          <>
            <div className="my-1 h-px bg-[#EAE6DD]" />
            <div className="flex items-center gap-2 px-2.5 pb-1 pt-1">
              <span className="min-w-0 flex-1 text-xs font-semibold text-[#8A867C]">
                {t('Everyone at {domain}', { domain: myDomain() || '—' })}
              </span>
              {domain.domain && (
                <select
                  value={domain.role}
                  onChange={(e) => {
                    const next: DomainAccess = { ...domain, role: e.target.value as Role }
                    setDomain(next)
                    void setDomainAccess(room, next).then((p) => p && setNote(p))
                  }}
                  className="shrink-0 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1 py-0.5 text-xs outline-none"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                </select>
              )}
              <button
                type="button"
                role="switch"
                aria-checked={!!domain.domain}
                onClick={() => {
                  const next: DomainAccess = {
                    ...domain,
                    domain: domain.domain ? null : myDomain(),
                  }
                  setDomain(next)
                  void setDomainAccess(room, next).then((problem) => {
                    if (problem) { setNote(problem); void getDomainAccess(room).then(setDomain) }
                    else setNote('')
                  })
                }}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors
                  ${domain.domain ? 'bg-[#C8452D]' : 'bg-[#D8D5CD]'}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-[left]
                    ${domain.domain ? 'left-[18px]' : 'left-0.5'}`}
                />
              </button>
            </div>
            <p className="px-2.5 pb-1 text-[11px] leading-snug text-[#8A867C]">
              {domain.domain
                ? t('Anyone signing in with that domain can open this board, no invite needed.')
                : t('Off: only the people listed below can open this board.')}
            </p>
          </>
        )}

        {user && (members.length > 0 || invites.length > 0) && (
          <>
            <div className="my-1 h-px bg-[#EAE6DD]" />
            <div className="px-2.5 pb-1 pt-1 text-xs font-semibold text-[#8A867C]">{t('People')}</div>
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-[#141310]">
                  {m.email || t('Member')}
                </span>
                {m.owner ? (
                  <span className="shrink-0 text-xs text-[#8A867C]">{t('owner')}</span>
                ) : owner ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => {
                        void setMemberRole(room, m.userId, e.target.value as Role).then(refresh)
                      }}
                      className="shrink-0 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1 py-0.5 text-xs outline-none"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                    </select>
                    <button
                      type="button"
                      title={t('Remove')}
                      onClick={() => void removeMember(room, m.userId).then(refresh)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                ) : (
                  <span className="shrink-0 text-xs text-[#8A867C]">{t(m.role)}</span>
                )}
              </div>
            ))}
            {invites.map((i) => (
              <div key={i.email} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-[#8A867C]">{i.email}</span>
                {owner && (
                  <button
                    type="button"
                    onClick={() => { void mailInvite(i.email, boardLink()); draft(i.email) }}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-[#C8452D] hover:bg-[#F7E9E4]"
                  >
                    {t('Email again')}
                  </button>
                )}
                <span className="shrink-0 text-xs text-[#8A867C]">{t('pending')}</span>
                {owner && (
                  <button
                    type="button"
                    title={t('Remove')}
                    onClick={() => void revokeInvite(room, i.email).then(refresh)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {user && owner && (
          <p className="px-2.5 pb-1 pt-2 text-[11px] leading-snug text-[#8A867C]">
            {t('The invite goes out as a sign-in link from your Supabase SMTP. Configure it under Authentication → SMTP Settings, or the built-in sender will throttle after a few messages.')}
          </p>
        )}
      </Popover>
    </div>
  )
}
