import { useEffect, useState, useSyncExternalStore } from 'react'
import { CircleDot, FileText, Table2 } from 'lucide-react'
import { go } from '../board/boards'
import { supabase, displayName } from '../board/supabase'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { getLang, t } from '../i18n'

// What changed in the workspace, read off the records themselves rather than kept in a log of
// its own. Every record already carries when it was last touched and by whom, so a second table
// would be the same facts written twice and a chance for the two to disagree.
//
// shortcut: this is the last change to each record, not every change to it. A real audit trail —
// who read what, who was given access when — is a row per event, which is the upgrade path if
// this is ever needed for an answer somebody has to defend.
const KEEP = 40

interface Change {
  id: string
  kind: string
  title: string
  updated_at: string
  updated_by: string | null
  created_at: string
}

const ICON: { [k: string]: typeof FileText } = {
  doc: FileText,
  database: Table2,
  issue: CircleDot,
}

export function Activity() {
  const [changes, setChanges] = useState<Change[]>([])
  const [team, setTeam] = useState<Teammate[]>([])
  // Waited for rather than read once: this screen is mounted before the workspace has arrived,
  // and asking then means asking about nothing.
  const ws = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)

  useEffect(() => {
    if (!supabase || !ws) return
    let live = true
    void supabase
      .from('records')
      .select('id, kind, title, updated_at, updated_by, created_at')
      .eq('workspace_id', ws.id)
      .is('archived_at', null)
      .order('updated_at', { ascending: false })
      .limit(KEEP)
      .then(({ data }) => { if (live) setChanges((data ?? []) as Change[]) })
    void listTeam().then((mates) => { if (live) setTeam(mates) })
    return () => { live = false }
  }, [ws])

  const when = (iso: string) =>
    new Date(iso).toLocaleString(getLang() === 'tr' ? 'tr-TR' : 'en-GB', {
      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
    })

  if (!changes.length) {
    return <p className="text-sm text-[#8A867C]">{t('Nothing has changed yet.')}</p>
  }

  return (
    <div className="divide-y divide-[#EAE6DD] rounded-xl border border-[#E2DED5] bg-[#FCFBF8]">
      {changes.map((change) => {
        const Icon = ICON[change.kind] ?? FileText
        const who = team.find((m) => m.userId === change.updated_by)
        // A record whose two stamps are the same second has been made and not touched since.
        const fresh = change.created_at === change.updated_at
        return (
          <button
            key={change.id}
            type="button"
            onClick={() => go(change.kind === 'issue' ? `/i/${change.id}` : `/d/${change.id}`)}
            className="group flex w-full items-center gap-2.5 px-3 py-2 text-left"
          >
            <Icon size={13} className="shrink-0 text-[#8A867C]" />
            <span className="min-w-0 flex-1 truncate text-sm text-[#141310] group-hover:text-[#C8452D]">
              {change.title || t('Untitled page')}
            </span>
            <span className="shrink-0 text-[11px] text-[#8A867C]">
              {fresh ? t('made by') : t('changed by')} {displayName(who?.email) || t('Somebody')}
            </span>
            <span className="shrink-0 text-[11px] text-[#B6B1A6]">{when(change.updated_at)}</span>
          </button>
        )
      })}
    </div>
  )
}
