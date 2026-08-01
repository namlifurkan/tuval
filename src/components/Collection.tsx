import { useEffect, useState, useSyncExternalStore } from 'react'
import { CircleDot, FileText, Filter, Table2, Target, Trash2 } from 'lucide-react'
import { go, readRoute } from '../board/boards'
import {
  answer, ASKABLE, isEmptyQuestion, loadCollections, NO_RULES, rulesOf, setRules,
} from '../board/collections'
import type { Rules } from '../board/collections'
import { getLabels, loadLabels, loadWorn, subscribeIssues } from '../board/issues'
import {
  archiveRecord, getRecords, loadPages, loadRecords, patchRecord, STATUSES, subscribeRecords,
} from '../board/records'
import type { Kind, Status } from '../board/records'
import { getWorkspace, subscribeWorkspace } from '../board/workspace'
import { t } from '../i18n'
import { Shell } from './Shell'

const sets = () => getRecords('collection')
const labels = getLabels

const KIND_NAMES: { [kind: string]: string } = {
  doc: 'Pages', database: 'Databases', issue: 'Issues', project: 'Projects',
}

const ICONS: { [kind: string]: typeof FileText } = {
  doc: FileText, database: Table2, issue: CircleDot, project: Target,
}

const DUES: { id: Rules['due']; name: string }[] = [
  { id: '', name: 'Any time' },
  { id: 'overdue', name: 'Late' },
  { id: 'week', name: 'Within a week' },
]

const hrefOf = (kind: Kind, id: string) => (kind === 'issue' ? `/i/${id}` : `/d/${id}`)

// A saved question. The rules are on the screen rather than behind a dialog, because a list
// whose reason you cannot see is a list you stop trusting.
export function Collection() {
  const route = readRoute()
  const id = route.kind === 'collection' ? route.id : ''
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const rows = useSyncExternalStore(subscribeRecords, sets, sets)
  const known = useSyncExternalStore(subscribeIssues, labels, labels)
  useSyncExternalStore(subscribeRecords, () => getRecords('issue'), () => getRecords('issue'))
  const [title, setTitle] = useState('')

  useEffect(() => {
    if (!workspace) return
    void loadCollections()
    void loadPages()
    void loadRecords('issue')
    void loadRecords('project')
    void loadLabels()
    void loadWorn()
  }, [workspace])

  const here = rows.find((r) => r.id === id)
  useEffect(() => { setTitle(here?.title ?? '') }, [here?.title])

  if (!id) return null
  if (!here) {
    return (
      <Shell title={t('Collection')} bare>
        <p className="text-sm text-[#8A867C]">{t('Reading…')}</p>
      </Shell>
    )
  }

  const rules = rulesOf(here)
  const found = isEmptyQuestion(rules) ? [] : answer(rules)
  const save = (changes: Partial<Rules>) => setRules(id, { ...rules, ...changes })

  const toggle = <T,>(list: T[], value: T): T[] =>
    (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

  const chip = (on: boolean) =>
    `rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors ${
      on ? 'bg-[#C8452D] text-white' : 'bg-[#EFEBE2] text-[#4A463E] hover:bg-[#E2DED5]'}`

  const field = 'rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2 py-1.5 text-[13px] outline-none focus:border-[#C8452D]'

  return (
    <Shell title={title || t('Untitled collection')} bare>
      <div className="flex items-start gap-2">
        <Filter size={20} className="mt-1.5 shrink-0 text-[#C8452D]" />
        <input
          value={title}
          onChange={(e) => { setTitle(e.target.value); patchRecord(id, { title: e.target.value }) }}
          placeholder={t('Untitled collection')}
          className="min-w-0 flex-1 bg-transparent text-[28px] font-bold leading-tight tracking-[-0.02em] text-[#141310] outline-none placeholder:text-[#C6C2B6]"
        />
        <button
          type="button"
          onClick={() => { void archiveRecord(id); go('/pages') }}
          title={t('Delete')}
          className="mt-1.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[#8A867C] hover:bg-[#EFEBE2] hover:text-[#C8452D]"
        ><Trash2 size={15} /></button>
      </div>

      <section className="mt-4 rounded-xl border border-[#E2DED5] bg-[#FCFBF8] p-3">
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-[68px] shrink-0 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
              {t('Of')}
            </span>
            {ASKABLE.map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() => save({ kinds: toggle(rules.kinds, kind) })}
                className={chip(rules.kinds.includes(kind))}
              >{t(KIND_NAMES[kind] ?? kind)}</button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-[68px] shrink-0 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
              {t('Status')}
            </span>
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => save({ status: toggle(rules.status, s) as Status[] })}
                className={chip(rules.status.includes(s))}
              >{t(s)}</button>
            ))}
          </div>

          {!!known.length && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="w-[68px] shrink-0 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
                {t('Tags')}
              </span>
              {known.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => save({ labels: toggle(rules.labels, l.id) })}
                  className={`rounded-full px-2.5 py-1 text-[12px] font-semibold text-[#141310] transition-opacity ${
                    rules.labels.includes(l.id) ? '' : 'opacity-40 hover:opacity-70'}`}
                  style={{ background: l.tone }}
                >{l.name}</button>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-[68px] shrink-0 text-[11px] font-bold uppercase tracking-[0.13em] text-[#8A867C]">
              {t('And')}
            </span>
            <select
              value={rules.assignee}
              onChange={(e) => save({ assignee: e.target.value })}
              className={field}
            >
              <option value="">{t('Anybody')}</option>
              <option value="me">{t('Mine')}</option>
            </select>
            <select
              value={rules.due}
              onChange={(e) => save({ due: e.target.value as Rules['due'] })}
              className={field}
            >
              {DUES.map((d) => <option key={d.id} value={d.id}>{t(d.name)}</option>)}
            </select>
            <input
              value={rules.title}
              onChange={(e) => save({ title: e.target.value })}
              placeholder={t('Title contains')}
              className={`min-w-0 flex-1 ${field}`}
            />
            <button
              type="button"
              onClick={() => save(NO_RULES)}
              className="rounded-lg px-2 py-1.5 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EFEBE2] hover:text-[#141310]"
            >{t('Clear')}</button>
          </div>
        </div>
      </section>

      <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#8A867C]">
        {isEmptyQuestion(rules)
          ? t('Ask something')
          : t('{n} found', { n: found.length })}
      </p>

      {isEmptyQuestion(rules) && (
        <p className="mt-2 max-w-[62ch] text-sm leading-relaxed text-[#8A867C]">
          {t('Nothing is filed into a collection. Set a rule above and it answers itself from then on, including things made after today.')}
        </p>
      )}

      <ul className="mt-2">
        {found.map((row) => {
          const Icon = ICONS[row.kind] ?? FileText
          return (
            <li key={row.id}>
              <a
                href={hrefOf(row.kind, row.id)}
                onClick={(e) => { e.preventDefault(); go(hrefOf(row.kind, row.id)) }}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-[#141310] hover:bg-[#EAE6DD]"
              >
                {row.icon
                  ? <span className="w-[15px] shrink-0 text-center leading-none">{row.icon}</span>
                  : <Icon size={15} className="shrink-0 text-[#8A867C]" />}
                <span className="min-w-0 flex-1 truncate">{row.title || t('Untitled')}</span>
                {row.status && (
                  <span className="shrink-0 text-[11px] uppercase tracking-wide text-[#8A867C]">
                    {t(row.status)}
                  </span>
                )}
              </a>
            </li>
          )
        })}
      </ul>
    </Shell>
  )
}
