import { Check, Link2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { room } from '../board/doc'
import {
  invite, listInvites, listMembers, myRole, removeMember, revokeInvite, setMemberRole,
} from '../board/cloud'
import type { Invite, Member } from '../board/cloud'
import { cloudEnabled, getUser, subscribeAuth } from '../board/supabase'
import { t } from '../i18n'
import { Popover, usePopover } from './ui'

type Role = 'editor' | 'viewer'

const ROLES: Role[] = ['editor', 'viewer']

export function Share() {
  const user = useSyncExternalStore(subscribeAuth, getUser, getUser)
  const pop = usePopover()
  const [members, setMembers] = useState<Member[]>([])
  const [invites, setInvites] = useState<Invite[]>([])
  const [role, setRole] = useState<'owner' | Role | null>(null)
  const [email, setEmail] = useState('')
  const [newRole, setNewRole] = useState<Role>('editor')
  const [note, setNote] = useState('')
  const [copied, setCopied] = useState(false)

  const refresh = useCallback(() => {
    if (!user) return
    void listMembers(room).then(setMembers)
    void listInvites(room).then(setInvites)
    void myRole(room).then(setRole)
  }, [user])

  useEffect(() => { if (pop.open) refresh() }, [pop.open, refresh])

  const copyLink = () => {
    navigator.clipboard?.writeText(`${location.origin}${location.pathname}#${room}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
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
    if (!email.trim()) return
    const problem = await invite(room, email, newRole)
    setNote(problem ?? '')
    if (!problem) { setEmail(''); refresh() }
  }

  return (
    <div className="relative">
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
            {note && <p className="px-2.5 pt-1.5 text-[11px] text-[#DC2626]">{note}</p>}
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
            {t('An invited address gets access the moment it signs in. Send them the link too.')}
          </p>
        )}
      </Popover>
    </div>
  )
}
