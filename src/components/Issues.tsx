import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { PanelRight, Trash2 } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import { today } from '../board/database'
import {
  bandsOf, burnOf, currentCycle, getCycles, getLabels, issueKey, labelsOn, loadCycles, loadLabels,
  isClosed, loadWorn, STATUS_TONE, subscribeIssues,
} from '../board/issues'
import type { GroupBy } from '../board/issues'
import { initials } from '../board/me'
import { loadRelations, progressOf } from '../board/relations'
import {
  archiveRecord, createRecord, getRecords, loadRecords, patchRecord, STATUSES, subscribeRecords,
} from '../board/records'
import type { Status } from '../board/records'
import { getUser } from '../board/supabase'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { CycleBar } from './CycleBar'
import { IssueBoard } from './IssueBoard'
import { IssueDetail } from './IssueDetail'
import { LabelChips } from './LabelChips'
import { Shell } from './Shell'

const issues = () => getRecords('issue')
const cycles = getCycles
const labels = getLabels

const GROUPS: GroupBy[] = ['status', 'assignee', 'priority', 'cycle', 'project', 'none']

function Dot({ status }: { status: Status | null }) {
  return (
    <span
      aria-hidden
      className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
      style={{ background: status ? STATUS_TONE[status] : '#D6D1C6' }}
    />
  )
}

const pill = 'shrink-0 rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1 py-0.5 text-xs outline-none'

export function Issues() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const records = useSyncExternalStore(subscribeRecords, issues, issues)
  useSyncExternalStore(subscribeIssues, cycles, cycles)
  const known = useSyncExternalStore(subscribeIssues, labels, labels)
  const [team, setTeam] = useState<Teammate[]>([])
  const [title, setTitle] = useState('')
  const [filter, setFilter] = useState<Status | 'all' | 'mine'>('all')
  const [view, setView] = useState<'list' | 'board'>('list')
  const [group, setGroup] = useState<GroupBy>('status')
  const [cycleOnly, setCycleOnly] = useState('')

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
    void listTeam().then(setTeam)
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
  const top = useMemo(
    () => records.filter((r) => !r.parent_id || !records.some((p) => p.id === r.parent_id)),
    [records],
  )

  const shown = useMemo(() => {
    let held = cycleOnly ? top.filter((r) => r.cycle_id === cycleOnly) : top
    if (filter === 'mine') held = held.filter((r) => r.assignee === mine)
    else if (filter !== 'all') held = held.filter((r) => r.status === filter)
    return held
  }, [top, filter, cycleOnly, mine])

  const counted = cycleOnly ? top.filter((r) => r.cycle_id === cycleOnly) : top

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
  }

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
        {(['all', 'mine', ...STATUSES] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setFilter(s)}
            className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors
              ${filter === s ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
          >
            {t(s === 'mine' ? 'Mine' : s)}
            {s !== 'all' && (
              <span className="ml-1.5 text-[#B6B1A6]">
                {s === 'mine'
                  ? counted.filter((r) => r.assignee === mine).length
                  : counted.filter((r) => r.status === s).length}
              </span>
            )}
          </button>
        ))}
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
        placeholder={t('Write an issue and press enter')}
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
                <div key={issue.id} className="group flex items-center gap-2.5 py-2.5">
                  <Dot status={issue.status} />

                  <span className="w-[68px] shrink-0 font-mono text-[11px] text-[#B6B1A6]">
                    {issueKey(issue, prefix)}
                  </span>

                  <input
                    value={issue.title}
                    onChange={(e) => void patchRecord(issue.id, { title: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm text-[#141310] outline-none focus:underline focus:decoration-[#C8452D] focus:underline-offset-4"
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

                  <select
                    value={issue.status ?? 'todo'}
                    onChange={(e) => void patchRecord(issue.id, { status: e.target.value as Status })}
                    className={pill}
                  >
                    {STATUSES.map((s) => <option key={s} value={s}>{t(s)}</option>)}
                  </select>

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
