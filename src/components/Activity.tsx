import { useEffect, useState, useSyncExternalStore } from 'react'
import { CircleDot, FileText, Table2 } from 'lucide-react'
import { go } from '../board/boards'
import { supabase, displayName } from '../board/supabase'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { getLang, t } from '../i18n'

// What changed in the workspace, read off the records themselves: the last change to each one,
// which is the question this screen is asking. Every change to a record is kept beside it —
// record_revisions, shown on the record — so this stays the short answer rather than the long one.
const KEEP = 40

interface Change {
  id: string
  kind: string
  title: string
  updated_at: string
  updated_by: string | null
  // The name of the key that wrote it, when something outside did. A person leaves this empty.
  updated_via: string | null
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
      .select('id, kind, title, updated_at, updated_by, updated_via, created_at')
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
    return <p className="text-sm text-muted">{t('Nothing has changed yet.')}</p>
  }

  return (
    <div className="divide-y divide-shade rounded-xl border border-hairline bg-surface">
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
            <Icon size={13} className="shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-sm text-ink group-hover:text-pigment">
              {change.title || t('Untitled page')}
            </span>
            <span className="shrink-0 text-[11px] text-muted">
              {fresh ? t('made by') : t('changed by')}{' '}
              {change.updated_via
                ? <span className="text-pigment">{change.updated_via} · {t('agent')}</span>
                : displayName(who?.email) || t('Somebody')}
            </span>
            <span className="shrink-0 text-[11px] text-faint">{when(change.updated_at)}</span>
          </button>
        )
      })}
    </div>
  )
}
