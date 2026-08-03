import { useEffect, useState, useSyncExternalStore } from 'react'
import { CircleDot, FileText, LayoutGrid, Plus, Table2, Target } from 'lucide-react'
import { go, newRoom, openBoard, readRoute, touchBoard } from '../board/boards'
import { isClosed } from '../board/issues'
import {
  boardsIn, isLate, pagesIn, PHASE_TONE, phaseOf, progressOf, projectsIn, setBoardProject,
  setSpan, startOf, targetOf,
} from '../board/projects'
import {
  createRecord, getRecords, loadPages, loadRecords, patchRecord, subscribeRecords,
} from '../board/records'
import type { Record as Row } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Shell } from './Shell'

const projects = () => getRecords('project')

// Everything one piece of work is made of, on one screen. Belonging is optional and stays that
// way: what has no project keeps having none, and this is where the things that do turn up.
export function Project() {
  const route = readRoute()
  const id = route.kind === 'project' ? route.id : ''
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, projects, projects)
  useSyncExternalStore(subscribeRecords, () => getRecords('issue'), () => getRecords('issue'))
  const [boards, setBoards] = useState<{ id: string; name: string }[]>([])
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!workspace) return
    void loadRecords('project')
    void loadRecords('issue')
    void loadPages()
  }, [workspace])

  useEffect(() => { if (id) void boardsIn(id).then(setBoards) }, [id])

  const here = rows.find((r) => r.id === id)
  useEffect(() => { setTitle(here?.title ?? '') }, [here?.title])

  if (!id) return null
  if (!here) {
    return <Shell title={t('Project')} bare><p className="text-sm text-muted">{t('Reading…')}</p></Shell>
  }

  const issues = getRecords('issue').filter((r) => r.project_id === id)
  const pages = pagesIn(id)
  const under = projectsIn(id)
  const held = progressOf(id)
  const phase = phaseOf(id)
  const share = held.total ? Math.round((held.done / held.total) * 100) : 0

  const startBoard = () => {
    const room = newRoom()
    touchBoard(room, { name: title || t('Untitled project'), opened: Date.now() })
    void setBoardProject(room, id).then(() => openBoard(room))
  }

  const line = 'flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-ink hover:bg-shade'
  const head = 'mt-8 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted'
  const add = 'flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12px] font-semibold text-muted hover:bg-shade hover:text-pigment'

  return (
    <Shell title={title || t('Untitled project')} bare>
      <div className="flex items-start gap-2">
        <Target size={20} className="mt-1.5 shrink-0" style={{ color: PHASE_TONE[phase] }} />
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); patchRecord(id, { title: e.target.value }) }}
          placeholder={t('Untitled project')}
          className="min-w-0 flex-1 bg-transparent text-[28px] font-bold leading-tight tracking-[-0.02em] text-ink outline-none placeholder:text-dim"
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.12em] text-ink"
          style={{ background: PHASE_TONE[phase] }}
        >{t(phase)}</span>
        {isLate(here) && (
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-pigment">
            {t('Late')}
          </span>
        )}
        <input
          type="date"
          value={startOf(here)}
          onChange={(e) => setSpan(here, e.target.value, targetOf(here))}
          className="rounded-md border border-transparent px-1 py-0.5 text-[13px] text-ink-soft outline-none hover:bg-shade focus:border-pigment"
        />
        <span className="text-faint">→</span>
        <input
          type="date"
          value={targetOf(here)}
          onChange={(e) => setSpan(here, startOf(here), e.target.value)}
          className="rounded-md border border-transparent px-1 py-0.5 text-[13px] text-ink-soft outline-none hover:bg-shade focus:border-pigment"
        />
      </div>

      {!!held.total && (
        <div className="mt-3 max-w-[420px]">
          <div className="flex items-baseline justify-between text-[11px] text-muted">
            <span>{t('{done} of {total} done', { done: held.done, total: held.total })}</span>
            <span>{share}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-tint">
            <div
              className="h-full rounded-full transition-[width]"
              style={{ width: `${share}%`, background: PHASE_TONE[phase] }}
            />
          </div>
        </div>
      )}

      <h2 className={head}><CircleDot size={12} /> {t('Issues')}</h2>
      <ul className="mt-1">
        {issues.map((row) => (
          <li key={row.id}>
            <a
              href={`/i/${row.id}`}
              onClick={(e) => { e.preventDefault(); go(`/i/${row.id}`) }}
              className={line}
            >
              <span className={`min-w-0 flex-1 truncate ${isClosed(row) ? 'text-faint line-through' : ''}`}>
                {row.title || t('Untitled')}
              </span>
              {row.status && (
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-muted">
                  {t(row.status)}
                </span>
              )}
            </a>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => void newIssue(id, title)} className={add}>
        <Plus size={13} /> {t('New issue')}
      </button>

      <h2 className={head}><FileText size={12} /> {t('Pages')}</h2>
      <ul className="mt-1">
        {pages.map((row: Row) => (
          <li key={row.id}>
            <a
              href={`/d/${row.id}`}
              onClick={(e) => { e.preventDefault(); go(`/d/${row.id}`) }}
              className={line}
            >
              {row.icon
                ? <span className="w-4 shrink-0 text-center leading-none">{row.icon}</span>
                : row.kind === 'database'
                  ? <Table2 size={14} className="shrink-0 text-muted" />
                  : <FileText size={14} className="shrink-0 text-muted" />}
              <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled page')}</span>
            </a>
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={() => void createRecord('', 'doc').then((made) => {
          if (made) { patchRecord(made, { project_id: id }); go(`/d/${made}`) }
        })}
        className={add}
      ><Plus size={13} /> {t('New page')}</button>

      <h2 className={head}><LayoutGrid size={12} /> {t('Boards')}</h2>
      <ul className="mt-1">
        {boards.map((board) => (
          <li key={board.id}>
            <button type="button" onClick={() => openBoard(board.id)} className={`w-full text-left ${line}`}>
              <LayoutGrid size={14} className="shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate">{board.name || t('Untitled board')}</span>
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={startBoard} className={add}>
        <Plus size={13} /> {t('New board')}
      </button>

      {!!under.length && (
        <>
          <h2 className={head}><Target size={12} /> {t('Projects')}</h2>
          <ul className="mt-1">
            {under.map((row) => (
              <li key={row.id}>
                <a
                  href={`/w/${row.id}`}
                  onClick={(e) => { e.preventDefault(); go(`/w/${row.id}`) }}
                  className={line}
                >
                  <Target size={14} className="shrink-0" style={{ color: PHASE_TONE[phaseOf(row.id)] }} />
                  <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled project')}</span>
                </a>
              </li>
            ))}
          </ul>
        </>
      )}
    </Shell>
  )
}

async function newIssue(project: string, name: string) {
  const made = await createRecord(t('New issue in {name}', { name }), 'issue')
  if (made) {
    patchRecord(made, { project_id: project, status: 'todo' })
    go(`/i/${made}`)
  }
}
