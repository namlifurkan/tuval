import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  getWorkspace, inviteToWorkspace, listTeam, listWorkspaceInvites, myDomain, personalDomains,
  removeFromWorkspace, renameWorkspace, revokeWorkspaceInvite, ROLES, setTeamRole,
  setWorkspaceDomain, subscribeWorkspace,
} from '../board/workspace'
import type { Teammate, WorkspaceRole } from '../board/workspace'
import { go } from '../board/boards'
import { initials } from '../board/me'
import { getUser } from '../board/supabase'
import { t } from '../i18n'
import { Shell } from './Shell'
import { Trash2 } from 'lucide-react'

const field = 'w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-pigment'

function Face({ mate }: { mate: Teammate }) {
  const named = mate.name || mate.email
  return (
    <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-avatar text-[11px] font-bold text-white">
      {mate.avatar
        ? <img src={mate.avatar} alt="" className="h-full w-full object-cover" />
        : initials(named || '?')}
    </span>
  )
}

export function Team() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const [team, setTeam] = useState<Teammate[]>([])
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')
  const [note, setNote] = useState('')
  const [personal, setPersonal] = useState<string[]>([])

  const refresh = useCallback(() => {
    void listTeam().then(setTeam)
    void listWorkspaceInvites().then(setInvites)
  }, [])

  useEffect(() => { void personalDomains().then(setPersonal) }, [])

  useEffect(() => {
    if (!getUser()) { go('/login'); return }
    if (!workspace) return
    setName(workspace.name)
    refresh()
  }, [workspace, refresh])

  if (!workspace) return null

  const admin = workspace.owner === getUser()?.id
    || team.some((m) => m.userId === getUser()?.id && m.role === 'admin')
  const open = !!workspace.allowed_domain
  const home = workspace.allowed_domain ?? myDomain()
  // The rule is written from the address you are signed in with, so a personal one cannot set it
  // and this says so instead of leaving a switch that only errors.
  const mine = !open && personal.includes(myDomain())
  const joined = team.filter((m) => m.viaDomain).length

  const invite = async () => {
    const to = email.trim()
    if (!to) return
    const problem = await inviteToWorkspace(to, role)
    setNote(problem ?? t('Invited {email}. They join when they sign in with that address.', { email: to }))
    if (!problem) { setEmail(''); refresh() }
  }

  const rule = async (next: boolean, as: 'member' | 'guest') => {
    const problem = await setWorkspaceDomain(next, as)
    setNote(problem ?? '')
    if (!problem) refresh()
  }

  return (
    <Shell title={t('Team')}>
      <div className="max-w-[720px]">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name.trim() && name !== workspace.name) void renameWorkspace(name.trim()) }}
          disabled={!admin}
          placeholder={t('Workspace name')}
          className={`${field} disabled:opacity-60`}
        />

        {/* One rule instead of an invitation each. It is written on the workspace rather than on
            a board, because what a colleague wants on their first day is the place the work is
            kept, not one drawing in it. */}
        <div className="mt-6 rounded-xl border border-hairline p-4">
          <div className="flex items-center gap-3">
            <span className="min-w-0 flex-1 text-sm font-semibold text-ink">
              {t('Everyone at {domain}', { domain: home || '—' })}
            </span>
            {open && admin && (
              <select
                value={workspace.domain_role}
                onChange={(e) => void rule(true, e.target.value as 'member' | 'guest')}
                className="shrink-0 rounded-md border border-hairline bg-surface px-1 py-0.5 text-xs outline-none"
              >
                <option value="guest">{t('guest')}</option>
                <option value="member">{t('member')}</option>
              </select>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={open}
              aria-label={t('Everyone at {domain}', { domain: home || '—' })}
              disabled={!admin || !home || mine}
              onClick={() => void rule(!open, workspace.domain_role)}
              className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-40
                ${open ? 'bg-pigment' : 'bg-dim'}`}
            >
              <span
                className={`absolute top-0.5 h-4 w-4 rounded-full bg-on-pigment transition-[left]
                  ${open ? 'left-[18px]' : 'left-0.5'}`}
              />
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-muted">
            {mine
              ? t('{domain} is a mailbox provider, not a company. Sign in with your work address to open this workspace to it.', { domain: myDomain() })
              : open
                ? workspace.domain_role === 'guest'
                  ? t('Anyone signing in with that address joins and can read the boards, docs and projects here. They take no seat.')
                  : t('Anyone signing in with that address joins and can work on everything here. Each of them takes a seat.')
                : t('Off: only the people below are in this workspace.')}
          </p>
          {open && (
            <p className="mt-1 text-[12px] leading-snug text-faint">
              {joined
                ? t('{n} joined this way so far.', { n: joined })
                : t('Nobody at that address has an account yet. Whoever signs up joins on their first visit.')}
            </p>
          )}
        </div>

        <div className="mt-6 divide-y divide-shade border-y border-shade">
          {team.map((mate) => (
            <div key={mate.userId} className="flex items-center gap-3 py-2.5">
              <Face mate={mate} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm text-ink">
                  {mate.name || mate.email || t('Member')}
                </span>
                {mate.name && mate.email && (
                  <span className="truncate text-[11px] text-muted">{mate.email}</span>
                )}
              </span>
              {mate.viaDomain && (
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-[0.13em] text-faint">
                  {t('by domain')}
                </span>
              )}
              {mate.owner ? (
                <span className="shrink-0 text-xs text-muted">{t('owner')}</span>
              ) : admin ? (
                <>
                  <select
                    value={mate.role}
                    onChange={(e) => { void setTeamRole(mate.userId, e.target.value as WorkspaceRole).then(refresh) }}
                    className="shrink-0 rounded-md border border-hairline bg-surface px-1 py-0.5 text-xs outline-none"
                  >
                    {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
                  </select>
                  <button
                    type="button"
                    title={t('Remove from workspace')}
                    onClick={() => { void removeFromWorkspace(mate.userId).then(refresh) }}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-pigment-wash hover:text-pigment-deep"
                  >
                    <Trash2 size={13} />
                  </button>
                </>
              ) : (
                <span className="shrink-0 text-xs text-muted">{t(mate.role)}</span>
              )}
            </div>
          ))}

          {invites.map((waiting) => (
            <div key={waiting.email} className="flex items-center gap-3 py-2.5">
              <span className="min-w-0 flex-1 truncate pl-11 text-sm text-muted">{waiting.email}</span>
              <span className="shrink-0 text-xs text-muted">{t('pending')}</span>
              {admin && (
                <button
                  type="button"
                  title={t('Remove')}
                  onClick={() => { void revokeWorkspaceInvite(waiting.email).then(refresh) }}
                  className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-pigment-wash hover:text-pigment-deep"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>

        {admin && (
          <div className="mt-4 flex gap-2">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void invite() }}
              type="email"
              placeholder="teammate@company.com"
              spellCheck={false}
              className={`${field} flex-1`}
            />
            <select
              value={role}
              onChange={(e) => setRole(e.target.value as WorkspaceRole)}
              className="shrink-0 rounded-lg border border-hairline bg-surface px-2 text-sm outline-none"
            >
              {ROLES.map((r) => <option key={r} value={r}>{t(r)}</option>)}
            </select>
            <button
              type="button"
              disabled={!email.trim()}
              onClick={() => void invite()}
              className="shrink-0 rounded-lg bg-pigment px-3 py-2 text-sm font-semibold text-on-pigment disabled:opacity-40"
            >
              {t('Invite')}
            </button>
          </div>
        )}

        {note && <p className="mt-2 text-[12px] leading-snug text-muted">{note}</p>}
      </div>
    </Shell>
  )
}
