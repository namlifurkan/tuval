import { getUser, supabase } from './supabase'

// Somebody's own page. Not a feed: no follows, no likes, nothing to scroll. The audience these
// people have is already somewhere else, and this is the thing they link to from it.

export interface ProfileLink { label: string; url: string }

export interface Profile {
  user_id: string
  handle: string
  name: string
  bio: string
  avatar: string
  links: ProfileLink[]
}

export interface Shown {
  kind: 'page' | 'board'
  id: string
  title: string
  icon: string
  href: string
  at: string
}

// The same list the database enforces. Kept here so somebody is told before they save rather
// than after; the one that matters is the one in the trigger.
export const LINKABLE = [
  'buymeacoffee.com', 'ko-fi.com', 'patreon.com', 'liberapay.com', 'opencollective.com',
  'gumroad.com', 'github.com', 'github.io', 'gitlab.com', 'substack.com',
  'x.com', 'twitter.com', 'youtube.com', 'twitch.tv', 'linkedin.com',
  'bsky.app', 'mastodon.social', 'discord.gg',
]

export function linkable(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url)
    if (protocol !== 'https:') return false
    const host = hostname.toLowerCase()
    return LINKABLE.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))
  } catch {
    return false
  }
}

export const HANDLE = /^[a-z0-9][a-z0-9_-]{1,29}$/

export const profileUrl = (handle: string) => `${location.origin}/u/${handle}`

export async function myProfile(): Promise<Profile | null> {
  const user = getUser()
  if (!supabase || !user) return null
  const { data } = await supabase.from('profiles').select('*').eq('user_id', user.id).maybeSingle()
  return (data as Profile) ?? null
}

// Anybody may ask, with or without an account: that is what the page is for.
export async function readProfile(handle: string): Promise<Profile | null> {
  if (!supabase) return null
  const { data } = await supabase
    .from('profiles').select('*').ilike('handle', handle).maybeSingle()
  return (data as Profile) ?? null
}

export async function saveProfile(patch: Partial<Profile>): Promise<string | null> {
  const user = getUser()
  if (!supabase || !user) return 'Not signed in'
  const { error } = await supabase.from('profiles')
    .upsert({ ...patch, user_id: user.id }, { onConflict: 'user_id' })
  if (!error) return null
  if (/profiles_handle_idx/.test(error.message)) return 'That name is taken.'
  if (/profiles_handle_check/.test(error.message)) {
    return 'Lower case letters, numbers, dashes and underscores, two to thirty of them.'
  }
  return error.hint || error.message
}

// What that person has actually opened to the world. Pages are theirs by who made them; boards
// are theirs by who owns them.
export async function published(userId: string): Promise<Shown[]> {
  if (!supabase) return []
  const [pages, boards] = await Promise.all([
    supabase.from('records').select('id, title, icon, public_slug, published_at')
      .eq('created_by', userId).not('published_at', 'is', null),
    supabase.from('boards').select('id, name, public_at')
      .eq('owner', userId).not('public_at', 'is', null).is('deleted_at', null),
  ])

  const shown: Shown[] = [
    ...((pages.data ?? []) as { id: string; title: string; icon: string; public_slug: string; published_at: string }[])
      .map((r) => ({
        kind: 'page' as const,
        id: r.id,
        title: r.title,
        icon: r.icon ?? '',
        href: `/p/${r.public_slug}`,
        at: r.published_at,
      })),
    ...((boards.data ?? []) as { id: string; name: string; public_at: string }[])
      .map((b) => ({
        kind: 'board' as const,
        id: b.id,
        title: b.name,
        icon: '',
        href: `/b/${b.id}`,
        at: b.public_at,
      })),
  ]
  return shown.sort((a, b) => b.at.localeCompare(a.at))
}

// Opening a board -------------------------------------------------------------------------------
// A separate switch from sharing it with a person. Sharing answers "who else may work on this";
// this answers "may a stranger read it", and running the two through one setting is how somebody
// ends up publishing a board they meant to share with a colleague.

export async function openBoardToWorld(board: string, open: boolean) {
  if (!supabase) return
  await supabase.from('boards')
    .update({ public_at: open ? new Date().toISOString() : null }).eq('id', board)
}

export async function boardIsOpen(board: string): Promise<boolean> {
  if (!supabase) return false
  const { data } = await supabase.from('boards').select('public_at').eq('id', board).maybeSingle()
  return !!(data as { public_at: string | null } | null)?.public_at
}
