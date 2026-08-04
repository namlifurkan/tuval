import { Check, Link2, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { getMeta, room } from '../board/doc'
import {
  invite, listInvites, listMembers, myRole, removeMember, revokeInvite, setMemberRole,
} from '../board/cloud'
import type { Invite, Member } from '../board/cloud'
import { boardIsOpen, openBoardToWorld } from '../board/publicProfile'
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
  const [copied, setCopied] = useState(false)
  const [open, setOpen] = useState(false)

  const refresh = useCallback(() => {
    if (!user) return
    void listMembers(room).then(setMembers)
    void listInvites(room).then(setInvites)
    void myRole(room).then(setRole)
    void boardIsOpen(room).then(setOpen)
  }, [user])

  useEffect(() => { if (pop.open) refresh() }, [pop.open, refresh])

  const boardLink = () => `${location.origin}/b/${encodeURIComponent(room)}`

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
        className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-shade"
      >
        {copied ? t('Copied') : t('Copy link')}
      </button>
    )
  }

  const owner = role === 'owner'

  // Access lands with the row, and the row is the whole of it: claim_invites turns it into
  // membership the next time that address signs in, from any link, on any day.
  //
  // What used to go out here was a magic link, because auth mail is the only mail Supabase
  // sends. Somebody who already had an account got "Your sign-in link" — no board, no sender, no
  // sign that it was an invitation — and clicking it while signed in as somebody else switched
  // their account without saying so. A draft they send themselves says what happened.
  const send = async () => {
    const to = email.trim()
    if (!to) return
    setNote(t('Granting…'))
    const problem = await invite(room, to, newRole)
    if (problem) { setNote(problem); return }
    setEmail('')
    refresh()
    navigator.clipboard?.writeText(boardLink())
    setNote(t('{email} can open it now. Link copied — send it to them.', { email: to }))
    draft(to)
  }

  return (
    <div className="relative" data-ada="share">
      <button
        type="button"
        onClick={pop.toggle}
        className="rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink transition-colors hover:bg-shade"
      >
        {t('Share')}
      </button>

      <Popover open={pop.open} onClose={pop.close} anchor="bottomRight" className="w-[320px]">
        <button
          type="button"
          onClick={copyLink}
          className="mb-1 flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm hover:bg-tint"
        >
          {copied ? <Check size={15} className="text-ok" /> : <Link2 size={15} />}
          {copied ? t('Copied') : t('Copy link')}
        </button>

        {!user && (
          <p className="px-2.5 pb-1 pt-1 text-[11px] leading-snug text-muted">
            {t('Sign in to invite people. Right now this board only exists in your browser.')}
          </p>
        )}

        {user && owner && (
          <>
            <div className="my-1 h-px bg-shade" />
            <div className="px-2.5 pb-1.5 pt-1 text-xs font-semibold text-muted">{t('Invite')}</div>
            <div className="flex gap-1 px-1">
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') void send() }}
                type="email"
                placeholder="teammate@company.com"
                spellCheck={false}
                className="min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-2 py-1.5 text-sm outline-none focus:border-pigment"
              />
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as Role)}
                className="shrink-0 rounded-lg border border-hairline bg-surface px-1 py-1.5 text-xs outline-none"
              >
                {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
              </select>
            </div>
            <button
              type="button"
              onClick={() => void send()}
              disabled={!email.trim()}
              className="mx-1 mt-1 w-[calc(100%-8px)] rounded-lg bg-pigment px-2 py-1.5 text-sm font-semibold text-on-pigment disabled:opacity-40"
            >
              {t('Send invite')}
            </button>
            {note && (
              <p className={`px-2.5 pt-1.5 text-[11px] leading-snug ${
                /failed|error|rate/i.test(note) ? 'text-pigment-deep' : 'text-muted'
              }`}>{note}</p>
            )}
          </>
        )}

        {user && owner && (
          <>
            {/* Its own switch, not a role on the list above. Sharing answers who else may work
                on this; this answers whether a stranger may read it, and running the two through
                one setting is how somebody publishes a board they meant to send to a colleague. */}
            <div className="my-1 h-px bg-shade" />
            <div className="flex items-center gap-2 px-2.5 pb-1 pt-1">
              <span className="min-w-0 flex-1 text-xs font-semibold text-muted">
                {t('Anybody with the link')}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={open}
                onClick={() => {
                  const next = !open
                  setOpen(next)
                  void openBoardToWorld(room, next)
                }}
                className={`relative h-5 w-9 shrink-0 rounded-full transition-colors
                  ${open ? 'bg-pigment' : 'bg-dim'}`}
              >
                <span
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-on-pigment transition-[left]
                    ${open ? 'left-[18px]' : 'left-0.5'}`}
                />
              </button>
            </div>
            <p className="px-2.5 pb-1 text-[11px] leading-snug text-muted">
              {open
                ? t('Open to the world, read only, no account needed. It shows on your page and the brief can be copied off it.')
                : t('Off: opening this needs an account and a place on the list.')}
            </p>
          </>
        )}

        {user && (members.length > 0 || invites.length > 0) && (
          <>
            <div className="my-1 h-px bg-shade" />
            <div className="px-2.5 pb-1 pt-1 text-xs font-semibold text-muted">{t('People')}</div>
            {members.map((m) => (
              <div key={m.userId} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-ink">
                  {m.email || t('Member')}
                </span>
                {m.owner ? (
                  <span className="shrink-0 text-xs text-muted">{t('owner')}</span>
                ) : owner ? (
                  <>
                    <select
                      value={m.role}
                      onChange={(e) => {
                        void setMemberRole(room, m.userId, e.target.value as Role).then(refresh)
                      }}
                      className="shrink-0 rounded-md border border-hairline bg-surface px-1 py-0.5 text-xs outline-none"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                    </select>
                    <button
                      type="button"
                      title={t('Remove')}
                      onClick={() => void removeMember(room, m.userId).then(refresh)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-pigment-wash hover:text-pigment-deep"
                    >
                      <Trash2 size={13} />
                    </button>
                  </>
                ) : (
                  <span className="shrink-0 text-xs text-muted">{t(m.role)}</span>
                )}
              </div>
            ))}
            {invites.map((i) => (
              <div key={i.email} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5">
                <span className="min-w-0 flex-1 truncate text-sm text-muted">{i.email}</span>
                {owner && (
                  <button
                    type="button"
                    onClick={() => draft(i.email)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-xs font-semibold text-pigment hover:bg-pigment-wash"
                  >
                    {t('Email again')}
                  </button>
                )}
                <span className="shrink-0 text-xs text-muted">{t('pending')}</span>
                {owner && (
                  <button
                    type="button"
                    title={t('Remove')}
                    onClick={() => void revokeInvite(room, i.email).then(refresh)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-pigment-wash hover:text-pigment-deep"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </>
        )}

        {user && owner && (
          <p className="px-2.5 pb-1 pt-2 text-[11px] leading-snug text-muted">
            {t('Access is granted the moment that address signs in. Tuval does not send mail: your mail app opens with the invite ready, you press send.')}
          </p>
        )}
      </Popover>
    </div>
  )
}
