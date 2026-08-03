import { useState, useSyncExternalStore } from 'react'
import { Plus, X } from 'lucide-react'
import { issueKey, isClosed, STATUS_TONE } from '../board/issues'
import { createRecord, getRecords, patchRecord } from '../board/records'
import type { Record as Issue } from '../board/records'
import {
  blockedBy, blocking, childrenOf, link, relatedIssues, relationsVersion, subscribeRelations,
  unlink,
} from '../board/relations'
import { t } from '../i18n'
import { Popover } from './Popover'

function Line({ issue, prefix, onDrop }: { issue: Issue; prefix: string; onDrop: () => void }) {
  return (
    <div className="group/line flex items-center gap-2 rounded-md px-1 py-0.5 hover:bg-tint">
      <span
        aria-hidden
        className="h-2 w-2 shrink-0 rounded-[2px]"
        style={{ background: issue.status ? STATUS_TONE[issue.status] : '#D6D1C6' }}
      />
      <a
        href={`/i/${issue.id}`}
        className={`min-w-0 flex-1 truncate text-[12px] hover:text-pigment
          ${isClosed(issue) ? 'text-faint line-through' : 'text-ink'}`}
      >
        <span className="mr-1.5 font-mono text-[10px] text-faint">
          {issueKey(issue, prefix)}
        </span>
        {issue.title || t('Untitled')}
      </a>
      <button
        type="button"
        aria-label={t('Remove')}
        onClick={onDrop}
        className="shrink-0 text-faint opacity-0 hover:text-pigment-deep group-hover/line:opacity-100"
      >
        <X size={11} />
      </button>
    </div>
  )
}

// One picker for every way an issue can point at another. What differs between them is what the
// pick does, so that is the only thing passed in.
function Pick({ issue, onPick, label }: {
  issue: Issue; onPick: (other: Issue) => void; label: string
}) {
  const [typed, setTyped] = useState('')

  return (
    <Popover
      width={240}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[11px] font-semibold text-muted hover:text-pigment"
        >
          <Plus size={11} /> {label}
        </button>
      )}
    >
      {(close) => (
        <>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('Find an issue')}
            className="mb-1 w-full rounded-md border border-hairline bg-paper px-2 py-1 text-[13px] outline-none focus:border-pigment"
          />
          {getRecords('issue')
            .filter((r) => r.id !== issue.id
              && r.title.toLowerCase().includes(typed.trim().toLowerCase()))
            .slice(0, 10)
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => { onPick(r); close() }}
                className="w-full truncate rounded-md px-2 py-1 text-left text-[12px] hover:bg-shade"
              >{r.title || t('Untitled')}</button>
            ))}
        </>
      )}
    </Popover>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-muted">
        {title}
      </span>
      <div className="mt-1">{children}</div>
    </div>
  )
}

// Everything an issue is attached to: what is inside it, what it is waiting on, what is waiting
// on it, and what it merely has something to do with.
export function IssueLinks({ issue, prefix }: { issue: Issue; prefix: string }) {
  useSyncExternalStore(subscribeRelations, relationsVersion, relationsVersion)
  const [adding, setAdding] = useState('')

  const kids = childrenOf(issue.id)
  const ahead = blockedBy(issue.id)
  const behind = blocking(issue.id)
  const beside = relatedIssues(issue.id)
  const done = kids.filter(isClosed).length

  const addChild = async () => {
    const text = adding.trim()
    if (!text) return
    setAdding('')
    const id = await createRecord(text)
    // Made first and adopted second: a new issue has no parent until it has an id.
    if (id) patchRecord(id, { parent_id: issue.id })
  }

  return (
    <>
      <Section title={kids.length ? t('Sub-issues {done}/{total}', { done, total: kids.length }) : t('Sub-issues')}>
        {kids.map((kid) => (
          <Line
            key={kid.id}
            issue={kid}
            prefix={prefix}
            onDrop={() => patchRecord(kid.id, { parent_id: null })}
          />
        ))}
        <input
          value={adding}
          onChange={(e) => setAdding(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void addChild() }}
          placeholder={t('Write one and press enter')}
          className="mt-1 w-full rounded-md border border-hairline bg-surface px-2 py-1 text-[12px] outline-none focus:border-pigment"
        />
      </Section>

      <Section title={t('Blocked by')}>
        {ahead.map((other) => (
          <Line
            key={other.id}
            issue={other}
            prefix={prefix}
            onDrop={() => void unlink(other.id, issue.id, 'blocks')}
          />
        ))}
        <Pick
          issue={issue}
          label={t('Add')}
          onPick={(other) => void link(other.id, issue.id, 'blocks')}
        />
      </Section>

      <Section title={t('Blocking')}>
        {behind.map((other) => (
          <Line
            key={other.id}
            issue={other}
            prefix={prefix}
            onDrop={() => void unlink(issue.id, other.id, 'blocks')}
          />
        ))}
        <Pick
          issue={issue}
          label={t('Add')}
          onPick={(other) => void link(issue.id, other.id, 'blocks')}
        />
      </Section>

      <Section title={t('Related')}>
        {beside.map((other) => (
          <Line
            key={other.id}
            issue={other}
            prefix={prefix}
            onDrop={() => {
              void unlink(issue.id, other.id, 'relates_to')
              void unlink(other.id, issue.id, 'relates_to')
            }}
          />
        ))}
        <Pick
          issue={issue}
          label={t('Add')}
          onPick={(other) => void link(issue.id, other.id, 'relates_to')}
        />
      </Section>
    </>
  )
}
