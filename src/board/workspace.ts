import { claimInvites } from './cloud'
import { getUser, subscribeAuth, supabase } from './supabase'
import { t } from '../i18n'

export type WorkspaceRole = 'admin' | 'member' | 'guest'

export interface Workspace { id: string; name: string; slug: string; owner: string; prefix: string }
export interface Teammate { userId: string; email: string; role: WorkspaceRole; owner: boolean }

export const ROLES: WorkspaceRole[] = ['admin', 'member', 'guest']

let current: Workspace | null = null
const listeners = new Set<() => void>()

export const getWorkspace = () => current
export const subscribeWorkspace = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

// Called on sign in. The function it calls creates a workspace only if there is none and
// nobody has invited you into theirs, so it is safe to call every time.
export async function loadWorkspace(): Promise<Workspace | null> {
  if (!supabase || !getUser()) {
    current = null
    listeners.forEach((l) => l())
    return null
  }
  const { data: id } = await supabase.rpc('ensure_workspace')
  if (!id) return null

  const { data } = await supabase
    .from('workspaces').select('id, name, slug, owner, prefix').eq('id', id).maybeSingle()
  current = (data as Workspace) ?? null
  listeners.forEach((l) => l())
  return current
}

// Runs wherever the app starts, not only on a board: somebody invited to a team may well land
// on the board list, and an unclaimed invitation would leave them looking at nothing.
export function startWorkspace() {
  if (!supabase) return
  const settle = () => {
    if (!getUser()) { current = null; listeners.forEach((l) => l()); return }
    void claimInvites().then(() => loadWorkspace())
  }
  settle()
  subscribeAuth(settle)
}

export async function renameWorkspace(name: string) {
  if (!supabase || !current) return
  await supabase.from('workspaces').update({ name }).eq('id', current.id)
  current = { ...current, name }
  listeners.forEach((l) => l())
}

export async function listTeam(): Promise<Teammate[]> {
  if (!supabase || !current) return []
  const { data } = await supabase
    .from('workspace_members').select('user_id, email, role').eq('workspace_id', current.id)

  const team: Teammate[] = (data ?? []).map((r) => ({
    userId: r.user_id as string,
    email: (r.email as string) ?? '',
    role: r.role as WorkspaceRole,
    owner: false,
  }))

  // The owner has no membership row; the workspace itself records them.
  const me = getUser()
  if (!team.some((t) => t.userId === current!.owner)) {
    team.unshift({
      userId: current.owner,
      email: current.owner === me?.id ? (me?.email ?? '') : '',
      role: 'admin',
      owner: true,
    })
  }
  return team
}

// Inviting somebody who has never signed in is the normal case, and their user id is not known
// until they do. The invite waits by address, exactly as a board invite does.
export async function inviteToWorkspace(email: string, role: WorkspaceRole): Promise<string | null> {
  if (!supabase || !current) return 'No workspace'
  const { error } = await supabase.from('workspace_invites').insert({
    workspace_id: current.id, email: email.trim().toLowerCase(), role,
  })
  if (!error) return null
  // The seat limit comes back as a database exception, which is a sentence nobody should be
  // shown. What it means is one thing, and this is that thing said once.
  if (/seat limit/i.test(`${error.message} ${error.hint ?? ''}`)) {
    return t('Every seat on this plan is taken. Free up one, or move to the paid plan.')
  }
  return error.message
}

export async function listWorkspaceInvites(): Promise<{ email: string; role: string }[]> {
  if (!supabase || !current) return []
  const { data } = await supabase
    .from('workspace_invites').select('email, role').eq('workspace_id', current.id)
  return (data ?? []) as { email: string; role: string }[]
}

export async function revokeWorkspaceInvite(email: string) {
  if (!supabase || !current) return
  await supabase.from('workspace_invites').delete()
    .eq('workspace_id', current.id).eq('email', email)
}

// Removing marks rather than deletes, for the same reason a board does: the row is what keeps
// an invite or a domain rule from letting them straight back in.
export async function removeFromWorkspace(userId: string) {
  if (!supabase || !current) return
  await supabase.from('workspace_members')
    .upsert({ workspace_id: current.id, user_id: userId, role: 'blocked' },
      { onConflict: 'workspace_id,user_id' })
}

export async function setTeamRole(userId: string, role: WorkspaceRole) {
  if (!supabase || !current) return
  await supabase.from('workspace_members').update({ role })
    .eq('workspace_id', current.id).eq('user_id', userId)
}
