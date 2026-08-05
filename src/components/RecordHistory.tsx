import { useEffect, useState } from 'react'
import { Undo2 } from 'lucide-react'
import { go } from '../board/boards'
import { listRevisions, undoRevision } from '../board/revisions'
import type { Revision } from '../board/revisions'
import type { Record as Issue } from '../board/records'
import { t } from '../i18n'

const FIELD: { [column: string]: string } = {
  kind: 'Kind',
  title: 'Title',
  description: 'Description',
  status: 'Status',
  assignee: 'Assignee',
  priority: 'Priority',
  due_at: 'Due',
  estimate: 'Estimate',
  parent_id: 'Parent',
  project_id: 'Project',
  cycle_id: 'Cycle',
  archived_at: 'Archived',
  icon: 'Icon',
  cover: 'Cover',
  data: 'Fields',
}

function when(iso: string) {
  const mins = Math.floor((Date.now() - Date.parse(iso)) / 60000)
  if (mins < 1) return t('just now')
  if (mins < 60) return t('{n} min ago', { n: mins })
  if (mins < 1440) return t('{n} h ago', { n: Math.floor(mins / 60) })
  return t('{n} d ago', { n: Math.floor(mins / 1440) })
}

// Who changed what, and the way back. This is the answer to a question nobody asks until an
// agent has already got something wrong, which is exactly why it has to have been kept all along.
export function RecordHistory({ record, nameOf }: {
  record: Issue
  nameOf: (id: string | null) => string
}) {
  const [rows, setRows] = useState<Revision[]>([])

  // Re-read when the record is touched rather than on a timer: the stamp changes on every write,
  // including somebody else's arriving over realtime.
  useEffect(() => {
    let live = true
    void listRevisions(record.id).then((held) => { if (live) setRows(held) })
    return () => { live = false }
  }, [record.id, record.updated_at])

  if (!rows.length) return null

  return (
    <div className="mt-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted">
        {t('Changes')}
      </span>
      <div className="mt-1">
        {rows.map((revision) => (
          <div
            key={revision.id}
            className="group/rev flex items-center gap-2 rounded-md px-1 py-0.5 text-[12px] hover:bg-tint"
          >
            <span className="w-[64px] shrink-0 text-[11px] text-faint">{when(revision.at)}</span>
            {revision.run ? (
              <button
                type="button"
                title={t('See the whole run')}
                onClick={() => go(`/runs?run=${encodeURIComponent(revision.run as string)}`)}
                className="shrink-0 truncate text-[11px] text-pigment underline decoration-transparent underline-offset-2 hover:decoration-current"
              >
                {revision.via ? `${revision.via} · ${t('agent')}` : t('agent')}
              </button>
            ) : (
              <span className={`shrink-0 truncate text-[11px] ${revision.via ? 'text-pigment' : 'text-muted'}`}>
                {revision.via ? `${revision.via} · ${t('agent')}` : nameOf(revision.actor) || t('Somebody')}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-ink">
              {revision.changed.length
                ? revision.changed.map((column) => t(FIELD[column] ?? column)).join(', ')
                : t('made it')}
            </span>
            {!!revision.changed.length && (
              <button
                type="button"
                title={t('Put it back')}
                onClick={() => undoRevision(record.id, revision)}
                className="grid h-5 w-5 shrink-0 place-items-center rounded text-muted opacity-0 hover:text-pigment group-hover/rev:opacity-100"
              >
                <Undo2 size={11} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
