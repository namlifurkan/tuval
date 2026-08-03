import { useState } from 'react'
import { between, patchRecord, STATUSES } from '../board/records'
import type { Record as Issue, Status } from '../board/records'
import { STATUS_TONE as TONE } from '../board/issues'
import { initials } from '../board/me'
import { t } from '../i18n'

// The same rows the list shows, grouped by the column they are in. No new data: a view is a
// question asked of the records, not a copy of them.
export function IssueBoard({ issues, nameOf, onOpen }: {
  issues: Issue[]
  nameOf: (id: string | null) => string
  onOpen: (issue: Issue) => void
}) {
  const [dragging, setDragging] = useState<string | null>(null)
  const [over, setOver] = useState<Status | null>(null)

  const column = (status: Status) => issues
    .filter((i) => (i.status ?? 'todo') === status)
    .sort((a, b) => a.position - b.position)

  // Dropped at the end of a column: one write, and the position is the midpoint of its
  // neighbours rather than a renumbering of everything after it.
  const drop = (status: Status) => {
    const id = dragging
    setDragging(null)
    setOver(null)
    if (!id) return
    const last = column(status).filter((i) => i.id !== id).at(-1) ?? null
    void patchRecord(id, { status, position: between(last, null) })
  }

  return (
    <div className="mt-5 grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
      {STATUSES.map((status) => (
        <section
          key={status}
          onDragOver={(e) => { e.preventDefault(); setOver(status) }}
          onDragLeave={() => setOver((s) => (s === status ? null : s))}
          onDrop={() => drop(status)}
          className={`min-h-[120px] rounded-xl border p-2 transition-colors
            ${over === status ? 'border-pigment bg-pigment-wash' : 'border-hairline bg-paper'}`}
        >
          <div className="mb-2 flex items-center gap-1.5 px-1">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: TONE[status] }} />
            <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted">
              {t(status)}
            </span>
            <span className="ml-auto text-[11px] text-faint">{column(status).length}</span>
          </div>

          {column(status).map((issue) => (
            <article
              key={issue.id}
              draggable
              onDragStart={() => setDragging(issue.id)}
              onDragEnd={() => { setDragging(null); setOver(null) }}
              onClick={() => onOpen(issue)}
              className={`mb-1.5 cursor-pointer rounded-lg border border-hairline bg-surface p-2.5 transition-shadow hover:shadow-[2px_2px_0_rgba(20,19,16,0.07)]
                ${dragging === issue.id ? 'opacity-40' : ''}`}
            >
              <p className="text-[13px] leading-snug text-ink">{issue.title || t('Untitled')}</p>
              {issue.assignee && (
                <span
                  title={nameOf(issue.assignee)}
                  className="mt-2 grid h-5 w-5 place-items-center rounded-md bg-avatar text-[9px] font-bold text-white"
                >
                  {initials(nameOf(issue.assignee) || '?')}
                </span>
              )}
            </article>
          ))}
        </section>
      ))}
    </div>
  )
}
