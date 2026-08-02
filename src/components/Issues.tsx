import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { PanelRight, Trash2 } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { today } from '../board/database'
import {
  bandsOf, burnOf, currentCycle, getCycles, getLabels, issueKey, labelsOn, loadCycles, loadLabels,
  isClosed, loadWorn, STATUS_TONE, subscribeIssues,
} from '../board/issues'
import type { GroupBy } from '../board/issues'
import { plain } from '../board/keys'
import { loadTime } from '../board/time'
import { initials } from '../board/me'
import { loadRelations, progressOf } from '../board/relations'
import {
  archiveRecord, createRecord, getRecords, loadRecords, patchRecord, STATUSES, subscribeRecords,
} from '../board/records'
import type { Status } from '../board/records'
import { getScope, subscribeScope } from '../board/scope'
import { getUser } from '../board/supabase'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { changedSince, lastLooked, loadSeen, markSeen, subscribeSeen, writtenByAgent } from '../board/seen'
import { CycleBar } from './CycleBar'
import { IssueBoard } from './IssueBoard'
import { IssueDetail } from './IssueDetail'
import { LabelChips } from './LabelChips'
import { Shell } from './Shell'

const issues = () => getRecords('issue')
const cycles = getCycles
const labels = getLabels

const GROUPS: GroupBy[] = ['status', 'assignee', 'priority', 'cycle', 'project', 'none']

// The state, as a dot you can also press. It used to be a dot beside a full select box on every
// line, which said the same thing twice and left the title about a hundred pixels to be read in:
// half the list showed "Pricing p" where it meant "Pricing page".
const pill = 'shrink-0 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-1 text-xs outline-none'

function Dot({ status, onPick }: { status: Status | null; onPick?: (next: Status) => void }) {
  const tone = status ? STATUS_TONE[status] : '#D6D1C6'
  if (!onPick) {
    return <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: tone }} />
  }
  return (
    <span className="relative grid h-4 w-4 shrink-0 place-items-center">
      <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: tone }} />
      <select
        aria-label={t('Status')}
        value={status ?? 'todo'}
        onChange={(e) => onPick(e.target.value as Status)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
      </select>
    </span>
  )
}

const CHIP: { [key: string]: string } = {
  mine: 'Mine',
  new: 'Since you looked',
  agent: 'By an agent',
}

export function Issues() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const records = useSyncExternalStore(subscribeRecords, issues, issues)
  const scope = useSyncExternalStore(subscribeScope, getScope, getScope)
  useSyncExternalStore(subscribeIssues, cycles, cycles)
  const known = useSyncExternalStore(subscribeIssues, labels, labels)
  const [team, setTeam] = useState<Teammate[]>([])
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Status | 'all' | 'mine' | 'new' | 'agent'>('all')
  const [view, setView] = useState<'list' | 'board'>('list')
  const [group, setGroup] = useState<GroupBy>('status')
  const [cycleOnly, setCycleOnly] = useState('')
  const [at, setAt] = useState(-1)
  const looked = useSyncExternalStore(subscribeSeen, lastLooked, lastLooked)
  const [picked, setPicked] = useState<string[]>([])
  const box = useRef<HTMLInputElement>(null)

  // The open issue is the address, not a piece of state beside it. That is what makes it
  // something you can send to somebody, and what makes the back button close the panel.
  const route = readRoute()
  const openId = route.kind === 'issue' ? route.id : null
  const setOpenId = (id: string | null) => go(id ? `/i/${id}` : '/issues')

  useEffect(() => {
    if (!workspace) return
    void loadRecords('issue')
    void loadRecords('project')
    void loadCycles()
    void loadLabels()
    void loadWorn()
    void loadRelations()
    void loadTime()
    void listTeam().then(setTeam)
    void loadSeen()
  }, [workspace])

  const prefix = workspace?.prefix ?? ''
  const mine = getUser()?.id ?? ''

  const nameOf = (id: string | null) => {
    if (!id) return ''
    const mate = team.find((m) => m.userId === id)
    return mate?.email?.split('@')[0] ?? ''
  }

  const cycleName = (id: string | null) => {
    const held = getCycles().find((c) => c.id === id)
    return held ? held.name || t('Cycle {n}', { n: held.number }) : ''
  }

  // A sub-issue is shown inside its parent, not again beside it, or a list of ten becomes a list
  // of thirty saying the same thing twice. The counts on the chips are of the same set, so the
  // number beside a state and the number of rows under it are the same number.
  // Narrowed to the project on the left before anything else, so the chips count what the list
  // shows and both are about the piece of work somebody is actually in.
  const top = useMemo(
    () => records
      .filter((r) => !scope || r.project_id === scope)
      .filter((r) => !r.parent_id || !records.some((p) => p.id === r.parent_id)),
    [records, scope],
  )

  const shown = useMemo(() => {
    let held = cycleOnly ? top.filter((r) => r.cycle_id === cycleOnly) : top
    if (filter === 'mine') held = held.filter((r) => r.assignee === mine)
    else if (filter === 'new') held = held.filter((r) => changedSince(r.updated_at, looked))
    else if (filter === 'agent') held = held.filter((r) => writtenByAgent(r.updated_via))
    else if (filter !== 'all') held = held.filter((r) => r.status === filter)
    return held
  }, [top, filter, cycleOnly, mine, looked])

  const counted = cycleOnly ? top.filter((r) => r.cycle_id === cycleOnly) : top
  const fresh = counted.filter((r) => changedSince(r.updated_at, looked)).length

  const bands = useMemo(
    () => bandsOf(shown, group, { person: nameOf, cycle: cycleName }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [shown, group, team],
  )

  const add = async () => {
    const text = title.trim()
    if (!text) return
    setTitle('')
    const id = await createRecord(text)
    // Typed while looking at a cycle means it belongs to that cycle. Anything else is a step
    // somebody has to remember, and forgets.
    if (id && cycleOnly) patchRecord(id, { cycle_id: cycleOnly })
    if (id && scope) patchRecord(id, { project_id: scope })
  }

  // The rows as the eye reads them: bands in order, and every row inside them, so j and k walk
  // the list rather than a band at a time.
  const walk = useMemo(() => bands.flatMap((b) => b.rows), [bands])

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openId) { setOpenId(null); return }
      if (!plain(e)) return
      const step = (by: number) =>
        setAt((was) => Math.max(0, Math.min(walk.length - 1, (was < 0 ? -1 : was) + by)))

      if (e.key === 'Escape' && picked.length) { setPicked([]); return }
      if (e.key === 'j' || e.key === 'ArrowDown') { e.preventDefault(); step(1) }
      else if (e.key === 'k' || e.key === 'ArrowUp') { e.preventDefault(); step(-1) }
      else if (e.key === 'c') { e.preventDefault(); box.current?.focus() }
      else if (e.key === 'Enter' && walk[at]) { e.preventDefault(); setOpenId(walk[at].id) }
      else if (e.key === 'x' && walk[at]) {
        e.preventDefault()
        const id = walk[at].id
        setPicked((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]))
      } else if ((e.key === 'Backspace' || e.key === 'Delete')) {
        e.preventDefault()
        const doomed = picked.length ? picked : walk[at] ? [walk[at].id] : []
        doomed.forEach((id) => void archiveRecord(id))
        setPicked([])
      } else if (/^[1-7]$/.test(e.key)) {
        e.preventDefault()
        const status = STATUSES[Number(e.key) - 1]
        const held = picked.length ? picked : walk[at] ? [walk[at].id] : []
        held.forEach((id) => patchRecord(id, { status }))
      }
    }
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walk, at, openId, picked])

  const now = currentCycle(today())

  return (
    <Shell title={t('Issues')} wide={view === 'board'}>
      <CycleBar
        rows={records}
        only={cycleOnly}
        onPick={setCycleOnly}
        burn={now ? burnOf(now, records, today()) : null}
        current={now}
      />

      <div className="mb-3 mt-4 flex flex-wrap items-center gap-1">
        {(['list', 'board'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors
              ${view === v ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
          >{t(v)}</button>
        ))}

        {view === 'list' && (
          <select
            value={group}
            onChange={(e) => setGroup(e.target.value as GroupBy)}
            className="ml-auto rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-1 text-xs outline-none"
          >
            {GROUPS.map((g) => (
              <option key={g} value={g}>{t('Group by {what}', { what: t(g) })}</option>
            ))}
          </select>
        )}
      </div>

      <div className={`flex flex-wrap items-center gap-1.5 ${view === 'board' ? 'hidden' : ''}`}>
        {(['all', 'mine', 'new', 'agent', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors
              ${filter === s ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
          >
            {t(CHIP[s as keyof typeof CHIP] ?? s)}
            {s !== 'all' && (
              <span className="ml-1.5 text-[#B6B1A6]">
                {s === 'mine' ? counted.filter((r) => r.assignee === mine).length
                  : s === 'new' ? fresh
                  : s === 'agent' ? counted.filter((r) => writtenByAgent(r.updated_via)).length
                  : counted.filter((r) => r.status === s).length}
              </span>
            )}
          </button>
        ))}
        {!!fresh && (
          <button
            type="button"
            onClick={() => void markSeen()}
            className="ml-auto rounded-lg px-2.5 py-1 text-xs font-semibold text-[#4A463E]
              transition-colors hover:bg-[#EAE6DD]"
          >
            {t('Mark all as seen')}
          </button>
        )}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
        ref={box}
        placeholder={t('Write an issue and press enter — or press c')}
        className="mt-5 w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#C8452D]"
      />

      {view === 'board' && (
        <IssueBoard issues={shown} nameOf={nameOf} onOpen={(i) => setOpenId(i.id)} />
      )}

      <div className={view === 'board' ? 'hidden' : 'mt-5'}>
        {bands.map((band) => (
          <section key={band.key} className="mb-5">
            {group !== 'none' && (
              <h2 className="flex items-center gap-2 pb-1 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
                {group === 'status' && <Dot status={band.key as Status} />}
                {t(band.label)}
                <span className="text-[#B6B1A6]">{band.rows.length}</span>
              </h2>
            )}

            <div className="divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
              {band.rows.map((issue) => (
                <div
                  key={issue.id}
                  onMouseEnter={() => setAt(walk.indexOf(issue))}
                  className={`group flex items-center gap-2.5 py-2.5
                    ${picked.includes(issue.id) ? 'bg-[#F7E9E4]' : walk[at]?.id === issue.id ? 'bg-[#EFEBE2]' : ''}`}
                >
                  <button
                    type="button"
                    aria-pressed={picked.includes(issue.id)}
                    aria-label={t('Select')}
                    onClick={() => setPicked((was) =>
                      was.includes(issue.id) ? was.filter((x) => x !== issue.id) : [...was, issue.id])}
                    className={`grid h-4 w-4 shrink-0 place-items-center rounded-[3px] border text-[9px] transition-opacity
                      ${picked.includes(issue.id)
                        ? 'border-[#C8452D] bg-[#C8452D] text-white opacity-100'
                        : 'border-[#D8D5CD] opacity-0 group-hover:opacity-100'}`}
                  >{picked.includes(issue.id) ? '✓' : ''}</button>

                  <Dot
                    status={issue.status}
                    onPick={(next) => void patchRecord(issue.id, { status: next })}
                  />

                  <span
                    aria-label={changedSince(issue.updated_at, looked)
                      ? t(writtenByAgent(issue.updated_via) ? 'By an agent' : 'Since you looked')
                      : undefined}
                    title={changedSince(issue.updated_at, looked)
                      ? t(writtenByAgent(issue.updated_via) ? 'By an agent' : 'Since you looked')
                      : undefined}
                    className={`h-1.5 w-1.5 shrink-0 rounded-full
                      ${!changedSince(issue.updated_at, looked) ? 'bg-transparent'
                        : writtenByAgent(issue.updated_via) ? 'bg-[#C8452D]' : 'bg-[#141310]'}`}
                  />

                  <span className="w-[62px] shrink-0 font-mono text-[11px] tabular-nums text-[#B6B1A6]">
                    {issueKey(issue, prefix)}
                  </span>

                  <input
                    value={issue.title}
                    onChange={(e) => void patchRecord(issue.id, { title: e.target.value })}
                    className="min-w-0 flex-[1_1_18rem] bg-transparent text-[14.5px] font-medium text-[#141310] outline-none focus:underline focus:decoration-[#C8452D] focus:underline-offset-4"
                  />

                  <LabelChips known={known} worn={labelsOn(issue.id)} />

                  {(() => {
                    const kids = progressOf(issue.id, isClosed)
                    return kids && (
                      <span className="shrink-0 font-mono text-[10px] text-[#B6B1A6]">
                        {kids.done}/{kids.total}
                      </span>
                    )
                  })()}

                  {issue.estimate !== null && (
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-[#EFEBE2] text-[10px] font-bold text-[#4A463E]">
                      {issue.estimate}
                    </span>
                  )}

                  {issue.assignee && (
                    <span
                      title={nameOf(issue.assignee)}
                      className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#3E5C93] text-[10px] font-bold text-white"
                    >
                      {initials(nameOf(issue.assignee) || '?')}
                    </span>
                  )}

                  <button
                    type="button"
                    title={t('Open')}
                    onClick={() => setOpenId(issue.id)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] opacity-0 transition-opacity hover:bg-[#EFEBE2] hover:text-[#141310] group-hover:opacity-100"
                  >
                    <PanelRight size={13} />
                  </button>

                  <button
                    type="button"
                    title={t('Archive')}
                    onClick={() => void archiveRecord(issue.id)}
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] opacity-0 transition-opacity hover:bg-[#FEF2F2] hover:text-[#DC2626] group-hover:opacity-100"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      {openId && records.some((r) => r.id === openId) && (
        <IssueDetail
          issue={records.find((r) => r.id === openId)!}
          team={team}
          nameOf={nameOf}
          prefix={prefix}
          onClose={() => setOpenId(null)}
        />
      )}

      {!!picked.length && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex flex-wrap items-center gap-2 border-t border-[#E2DED5] bg-[#FCFBF8] px-6 py-2.5 shadow-[0_-3px_0_rgba(20,19,16,0.06)]">
          <span className="text-[12px] font-semibold text-[#141310]">
            {t('{n} chosen', { n: picked.length })}
          </span>
          <select
            value=""
            onChange={(e) => {
              picked.forEach((id) => patchRecord(id, { status: e.target.value as Status }))
              setPicked([])
            }}
            className={pill}
          >
            <option value="">{t('Status')}</option>
            {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
          </select>
          <select
            value=""
            onChange={(e) => {
              picked.forEach((id) => patchRecord(id, { assignee: e.target.value || null }))
              setPicked([])
            }}
            className={pill}
          >
            <option value="">{t('Assignee')}</option>
            {team.map((m) => (
              <option key={m.userId} value={m.userId}>{m.email.split('@')[0] || t('Member')}</option>
            ))}
          </select>
          <select
            value=""
            onChange={(e) => {
              picked.forEach((id) => patchRecord(id, { cycle_id: e.target.value || null }))
              setPicked([])
            }}
            className={pill}
          >
            <option value="">{t('Cycle')}</option>
            {getCycles().map((c) => (
              <option key={c.id} value={c.id}>{c.name || t('Cycle {n}', { n: c.number })}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => { picked.forEach((id) => void archiveRecord(id)); setPicked([]) }}
            className="rounded-md px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
          >{t('Archive')}</button>
          <button
            type="button"
            onClick={() => setPicked([])}
            className="ml-auto rounded-md px-2 py-1 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EAE6DD]"
          >{t('Clear')}</button>
        </div>
      )}

      {view === 'list' && !!shown.length && (
        <p className="mt-4 text-[11px] text-[#B6B1A6]">
          {t('j k move · enter opens · c writes · x chooses · delete archives · 1–7 set the state · g then i p d b n s')}
        </p>
      )}

      {view === 'list' && !shown.length && (
        <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
          {records.length
            ? t('Nothing with that status.')
            : t('No issues yet. They live in the workspace, not on a board, so they are here whichever board you were last in.')}
        </p>
      )}
    </Shell>
  )
}
