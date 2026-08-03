import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import {
  getWorkspace, inviteToWorkspace, listTeam, listWorkspaceInvites, removeFromWorkspace,
  renameWorkspace, revokeWorkspaceInvite, ROLES, setTeamRole, subscribeWorkspace,
} from '../board/workspace'
import type { Teammate, WorkspaceRole } from '../board/workspace'
import { getUser } from '../board/supabase'
import { t } from '../i18n'
import { Trash2 } from 'lucide-react'

const field = 'w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm outline-none focus:border-pigment'

export function Team() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const [team, setTeam] = useState<Teammate[]>([])
  const [invites, setInvites] = useState<{ email: string; role: string }[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')
  const [note, setNote] = useState('')

  const refresh = useCallback(() => {
    void listTeam().then(setTeam)
    void listWorkspaceInvites().then(setInvites)
  }, [])

  useEffect(() => {
    if (!workspace) return
    setName(workspace.name)
    refresh()
  }, [workspace, refresh])

  if (!workspace) return null

  const admin = workspace.owner === getUser()?.id
    || team.some((m) => m.userId === getUser()?.id && m.role === 'admin')

  const invite = async () => {
    const to = email.trim()
    if (!to) return
    const problem = await inviteToWorkspace(to, role)
    setNote(problem ?? t('Invited {email}. They join when they sign in with that address.', { email: to }))
    if (!problem) { setEmail(''); refresh() }
  }

  return (
    <>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => { if (name.trim() && name !== workspace.name) void renameWorkspace(name.trim()) }}
        disabled={!admin}
        placeholder={t('Workspace name')}
        className={`${field} disabled:opacity-60`}
      />

      <div className="mt-4 divide-y divide-shade border-y border-shade">
        {team.map((mate) => (
          <div key={mate.userId} className="flex items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-ink">
              {mate.email || t('Member')}
            </span>
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
          <div key={waiting.email} className="flex items-center gap-2 py-2.5">
            <span className="min-w-0 flex-1 truncate text-sm text-muted">{waiting.email}</span>
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
    </>
  )
}
