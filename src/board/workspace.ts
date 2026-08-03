import { getUser, subscribeAuth, supabase } from './supabase'
import { t } from '../i18n'

export type WorkspaceRole = 'admin' | 'member' | 'guest'

export interface Workspace {
  id: string
  name: string
  slug: string
  owner: string
  prefix: string
  allowed_domain: string | null
  domain_role: 'member' | 'guest'
}

export interface Teammate {
  userId: string
  email: string
  name: string
  avatar: string
  role: WorkspaceRole
  owner: boolean
  viaDomain: boolean
}

export const ROLES: WorkspaceRole[] = ['admin', 'member', 'guest']

const KEY = 'tuval:workspace'
const COLUMNS = 'id, name, slug, owner, prefix, allowed_domain, domain_role'

export const myDomain = () => (getUser()?.email ?? '').split('@')[1]?.toLowerCase() ?? ''

let current: Workspace | null = null
let chosen = read()
let loading: Promise<Workspace | null> | null = null
let loadingFor = ''
let problem = ''
const listeners = new Set<() => void>()

function read(): string {
  try { return localStorage.getItem(KEY) ?? '' } catch { return '' }
}

export const getWorkspace = () => current
export const workspaceError = () => problem

function setProblem(next: string) {
  if (problem === next) return
  problem = next
  listeners.forEach((listener) => listener())
}

export const subscribeWorkspace = (fn: () => void) => {
  listeners.add(fn)
  return () => { listeners.delete(fn) }
}

export function setWorkspace(id: string) {
  if (id === chosen) return
  chosen = id
  try { localStorage.setItem(KEY, id) } catch { /* private mode */ }
  listeners.forEach((fn) => fn())
}

export async function listWorkspaces(): Promise<Workspace[]> {
  const user = getUser()
  if (!supabase || !user) return []

  const [owned, joined] = await Promise.all([
    supabase.from('workspaces').select(COLUMNS).eq('owner', user.id),
    supabase.from('workspace_members')
      .select(`workspace:workspaces(${COLUMNS})`)
      .eq('user_id', user.id)
      .neq('role', 'blocked'),
  ])

  const rows = new Map<string, Workspace>()
  for (const row of (owned.data ?? []) as Workspace[]) rows.set(row.id, row)
  for (const membership of (joined.data ?? []) as unknown as {
    workspace: Workspace | Workspace[] | null
  }[]) {
    const workspaces = Array.isArray(membership.workspace)
      ? membership.workspace
      : membership.workspace ? [membership.workspace] : []
    for (const workspace of workspaces) rows.set(workspace.id, workspace)
  }

  return [...rows.values()].sort((a, b) =>
    a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
}

async function resolveWorkspace(userId: string): Promise<Workspace | null> {
  if (!supabase) return null
  setProblem('')
  const claimed = await supabase.rpc('claim_invites')
  if (claimed.error) throw claimed.error
  if (getUser()?.id !== userId) return null

  // The stored choice is a hint, never a grant: row-level security decides whether it is still
  // reachable. Somebody removed from a workspace since they last chose it simply reads nothing
  // back here, and lands on the fallback instead of on an empty screen.
  const selected = chosen
    ? await supabase.from('workspaces').select(COLUMNS).eq('id', chosen).maybeSingle()
    : { data: null, error: null }
  if (selected.error) throw selected.error
  let row = selected.data

  if (!row) {
    const { data: id, error } = await supabase.rpc('ensure_workspace')
    if (error) throw error
    if (getUser()?.id !== userId) return null
    if (!id) {
      current = null
      listeners.forEach((l) => l())
      return null
    }
    const fallback = await supabase.from('workspaces').select(COLUMNS).eq('id', id).maybeSingle()
    if (fallback.error) throw fallback.error
    row = fallback.data
    if (row) setWorkspace((row as Workspace).id)
  }

  if (getUser()?.id !== userId) return null
  current = (row as Workspace) ?? null
  listeners.forEach((l) => l())
  return current
}

export function loadWorkspace(): Promise<Workspace | null> {
  const user = getUser()
  if (!supabase || !user) {
    current = null
    setProblem('')
    listeners.forEach((l) => l())
    return Promise.resolve(null)
  }
  if (loading && loadingFor === user.id) return loading

  loadingFor = user.id
  const pending = resolveWorkspace(user.id)
    .catch((error: unknown) => {
      setProblem(error instanceof Error ? error.message : String(error))
      return current
    })
    .finally(() => {
      if (loading === pending) { loading = null; loadingFor = '' }
    })
  loading = pending
  return pending
}

// Runs wherever the app starts, not only on a board: somebody invited to a team may well land
// on the board list, and an unclaimed invitation would leave them looking at nothing.
export function startWorkspace() {
  if (!supabase) return
  const settle = () => { void loadWorkspace() }
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
    .from('workspace_members').select('user_id, email, role, via_domain')
    .eq('workspace_id', current.id).neq('role', 'blocked')

  const team: Teammate[] = (data ?? []).map((r) => ({
    userId: r.user_id as string,
    email: (r.email as string) ?? '',
    name: '',
    avatar: '',
    role: r.role as WorkspaceRole,
    owner: false,
    viaDomain: !!r.via_domain,
  }))

  // The owner has no membership row; the workspace itself records them.
  const me = getUser()
  if (!team.some((t) => t.userId === current!.owner)) {
    team.unshift({
      userId: current.owner,
      email: current.owner === me?.id ? (me?.email ?? '') : '',
      name: '',
      avatar: '',
      role: 'admin',
      owner: true,
      viaDomain: false,
    })
  }

  // A list of addresses is a list of accounts; a list of faces is the team. Whoever has not
  // made a profile keeps their address, which is the only name they have given us.
  const { data: faces } = await supabase
    .from('profiles').select('user_id, name, avatar').in('user_id', team.map((m) => m.userId))
  const known = new Map((faces ?? []).map((p) => [p.user_id as string, p]))
  for (const mate of team) {
    const face = known.get(mate.userId)
    mate.name = (face?.name as string) ?? ''
    mate.avatar = (face?.avatar as string) ?? ''
  }
  return team
}

// Addresses too many people share for one of them to stand for a company. The instance decides
// which, so it is asked rather than assumed, and asked before the switch is offered: a switch
// that can only answer with an error is worse than one that says why it is off.
export async function personalDomains(): Promise<string[]> {
  if (!supabase) return []
  const { data } = await supabase.from('tuval_settings').select('blocked_domains').maybeSingle()
  return (data?.blocked_domains as string[]) ?? []
}

// The rule that lets a colleague in without being asked for. The domain itself is never typed:
// it is the one this account signs in with, which is the only one the database will accept.
export async function setWorkspaceDomain(open: boolean, role: 'member' | 'guest') {
  if (!supabase || !current) return 'No workspace'
  const allowed_domain = open ? myDomain() : null
  const { error } = await supabase
    .from('workspaces').update({ allowed_domain, domain_role: role }).eq('id', current.id)
  if (error) return error.message
  current = { ...current, allowed_domain, domain_role: role }
  listeners.forEach((l) => l())
  return null
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

// A role given by hand is no longer the rule's to change, and no longer the rule's to take back
// when the domain is switched off.
export async function setTeamRole(userId: string, role: WorkspaceRole) {
  if (!supabase || !current) return
  await supabase.from('workspace_members').update({ role, via_domain: false })
    .eq('workspace_id', current.id).eq('user_id', userId)
}
