import { useEffect, useState, useSyncExternalStore } from 'react'
import { Plus } from 'lucide-react'
import { go } from '../board/boards'
import { addDays, daysApart, today } from '../board/database'
import { loadCycles } from '../board/issues'
import {
  addProject, isLate, listProjects, PHASE_TONE, phaseOf, progressOf, setSpan, startOf, targetOf,
} from '../board/projects'
import type { Record as Row } from '../board/records'
import { archiveRecord, getRecords, loadRecords, patchRecord, subscribeRecords } from '../board/records'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { getLang, t } from '../i18n'
import { Shell } from './Shell'

const projects = listProjects

const DAY = 12
const NAMES = 240
const MARGIN = 7
const LEAST = 60

function Bar({ project, from }: { project: Row; from: string }) {
  const starts = startOf(project) || today()
  const ends = targetOf(project) || addDays(starts, 1)
  const left = daysApart(from, starts) * DAY
  const width = Math.max(DAY, (daysApart(starts, ends) + 1) * DAY)
  const phase = phaseOf(project.id)
  const held = progressOf(project.id)
  const share = held.total ? held.done / held.total : 0

  return (
    <div
      style={{ left, width }}
      className="absolute top-1 h-6 overflow-hidden rounded-md"
      title={`${held.done}/${held.total}`}
    >
      <div className="h-full w-full" style={{ background: PHASE_TONE[phase], opacity: 0.35 }} />
      {/* The filled part is what is finished, so a bar reads as progress rather than as a plan. */}
      <div
        className="absolute inset-y-0 left-0 rounded-md"
        style={{ width: `${Math.round(share * 100)}%`, background: PHASE_TONE[phase] }}
      />
      <span className="absolute inset-y-0 left-2 flex items-center text-[11px] font-semibold text-[#141310]">
        {project.title || t('Untitled')}
      </span>
    </div>
  )
}

// Projects on a day axis. The same shape as the timeline a database gets, drawn separately
// because a project is not a row of one and pretending otherwise would mean a schema to fake.
function Roadmap({ rows }: { rows: Row[] }) {
  const spans = rows.map((r) => ({ starts: startOf(r) || today(), ends: targetOf(r) || today() }))
  const first = spans.map((s) => s.starts).concat(today()).reduce((a, b) => (a < b ? a : b))
  const last = spans.map((s) => s.ends).concat(today()).reduce((a, b) => (a > b ? a : b))
  const from = addDays(first, -MARGIN)
  const days = Math.max(LEAST, daysApart(from, last) + MARGIN)
  const locale = getLang() === 'tr' ? 'tr-TR' : 'en-GB'

  return (
    <div className="mt-4 overflow-x-auto rounded-xl border border-[#E2DED5] bg-[#FCFBF8]">
      <div style={{ width: NAMES + days * DAY }}>
        <div className="flex border-b border-[#E2DED5] bg-[#F7F5F0]">
          <div className="shrink-0" style={{ width: NAMES }} />
          <div className="flex">
            {Array.from({ length: days }, (_, i) => addDays(from, i)).map((iso) => {
              const first = iso.slice(8) === '01'
              const now = iso === today()
              return (
                <div
                  key={iso}
                  style={{ width: DAY }}
                  className={`shrink-0 py-1.5 text-center text-[9px] leading-tight
                    ${first ? 'border-l border-[#D8D5CD] font-bold text-[#141310]' : 'text-[#C6C2B6]'}`}
                >
                  {first
                    ? new Date(`${iso}T00:00:00Z`)
                      .toLocaleDateString(locale, { month: 'short', timeZone: 'UTC' })
                    : now ? <span className="font-bold text-[#C8452D]">•</span> : ''}
                </div>
              )
            })}
          </div>
        </div>

        {rows.map((project) => (
          <div key={project.id} className="flex items-center border-b border-[#EAE6DD] last:border-0">
            <button
              type="button"
              onClick={() => go(`/projects/${project.id}`)}
              style={{ width: NAMES }}
              className="shrink-0 truncate px-2.5 py-2 text-left text-[13px] text-[#141310] hover:text-[#C8452D]"
            >
              {project.title || t('Untitled')}
            </button>
            <div className="relative h-8 flex-1">
              <Bar project={project} from={from} />
            </div>
          </div>
        ))}

        {!rows.length && (
          <p className="px-2.5 py-4 text-[13px] text-[#8A867C]">{t('No projects yet.')}</p>
        )}
      </div>
    </div>
  )
}

const field = 'rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-1 text-xs outline-none'

export function Projects() {
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, projects, projects)
  useSyncExternalStore(subscribeRecords, () => getRecords('issue'), () => getRecords('issue'))
  const [team, setTeam] = useState<Teammate[]>([])
  const [title, setTitle] = useState('')
  const [view, setView] = useState<'list' | 'roadmap'>('list')

  useEffect(() => {
    if (!workspace) return
    void loadRecords('project')
    void loadRecords('issue')
    void loadCycles()
    void listTeam().then(setTeam)
  }, [workspace])

  const add = async () => {
    const text = title.trim()
    if (!text) return
    setTitle('')
    await addProject(text)
  }

  return (
    <Shell title={t('Projects')} wide={view === 'roadmap'}>
      <div className="mb-3 flex gap-1">
        {(['list', 'roadmap'] as const).map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors
              ${view === v ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
          >{t(v)}</button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void add() }}
          placeholder={t('Name a project and press enter')}
          className="flex-1 rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-3 py-2.5 text-sm outline-none focus:border-[#C8452D]"
        />
        <button
          type="button"
          onClick={() => void add()}
          className="grid h-9 w-9 place-items-center rounded-lg bg-[#C8452D] text-white hover:bg-[#A83621]"
          aria-label={t('Add')}
        >
          <Plus size={16} />
        </button>
      </div>

      {view === 'roadmap' && <Roadmap rows={rows} />}

      {view === 'list' && (
        <div className="mt-5 divide-y divide-[#EAE6DD] border-y border-[#EAE6DD]">
          {rows.map((project) => {
            const held = progressOf(project.id)
            const phase = phaseOf(project.id)
            return (
              <div key={project.id} className="group py-3">
                <div className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 shrink-0 rounded-[3px]"
                    style={{ background: PHASE_TONE[phase] }}
                  />
                  <input
                    value={project.title}
                    onChange={(e) => patchRecord(project.id, { title: e.target.value })}
                    className="min-w-0 flex-1 bg-transparent text-sm font-medium text-[#141310] outline-none"
                  />
                  {isLate(project) && (
                    <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold text-[#DC2626]">
                      {t('late')}
                    </span>
                  )}
                  <span className="shrink-0 text-[11px] text-[#8A867C]">
                    {held.done}/{held.total} · {held.closed}/{held.points} {t('points')}
                  </span>
                  <button
                    type="button"
                    onClick={() => go(`/issues?project=${project.id}`)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#8A867C] opacity-0 hover:text-[#C8452D] group-hover:opacity-100"
                  >{t('Issues')}</button>
                  <button
                    type="button"
                    onClick={() => void archiveRecord(project.id)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] text-[#8A867C] opacity-0 hover:text-[#DC2626] group-hover:opacity-100"
                  >{t('Archive')}</button>
                </div>

                <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-5">
                  <span className="text-[11px] text-[#8A867C]">{t(phase)}</span>
                  <input
                    type="date"
                    value={startOf(project)}
                    onChange={(e) => setSpan(project, e.target.value, targetOf(project))}
                    className={field}
                  />
                  <span className="text-[11px] text-[#C6C2B6]">→</span>
                  <input
                    type="date"
                    value={targetOf(project)}
                    onChange={(e) => setSpan(project, startOf(project), e.target.value)}
                    className={field}
                  />
                  <select
                    value={project.assignee ?? ''}
                    onChange={(e) => patchRecord(project.id, { assignee: e.target.value || null })}
                    className={field}
                  >
                    <option value="">{t('No lead')}</option>
                    {team.map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.email.split('@')[0] || t('Member')}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )
          })}

          {!rows.length && (
            <p className="py-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
              {t('A project is a run of issues with a target date. It has no status of its own: it is planned until something under it starts, and finished when nothing under it is open.')}
            </p>
          )}
        </div>
      )}
    </Shell>
  )
}
