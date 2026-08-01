import { useEffect, useState, useSyncExternalStore } from 'react'
import { Plus, X } from 'lucide-react'
import { go } from '../board/boards'
import {
  addField, addView, applyView, cellsOf, editView, groupsOf, removeView, rowsOf, schemaOf, setCell,
} from '../board/database'
import type { Choice, Field, View } from '../board/database'
import { between, createRecord, getPages, patchRecord, subscribeRecords } from '../board/records'
import type { Record as Row } from '../board/records'
import { getWorkspace, listTeam, subscribeWorkspace } from '../board/workspace'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { DatabaseCalendar } from './DatabaseCalendar'
import { DatabaseGallery } from './DatabaseGallery'
import { DatabaseTable } from './DatabaseTable'
import { DatabaseTimeline } from './DatabaseTimeline'
import { ViewBar } from './ViewBar'

const pages = getPages

const UNSET = '__none__'

const KIND_NAME = {
  table: 'Table', board: 'Board', gallery: 'Gallery', calendar: 'Calendar', timeline: 'Timeline',
} as const

function Column({ choice, rows, fields, onOpen, onDrop, onAdd }: {
  choice: Choice | null
  rows: Row[]
  fields: Field[]
  onOpen: (row: Row) => void
  onDrop: (id: string, after: Row | null) => void
  onAdd: () => void
}) {
  return (
    <section
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); onDrop(e.dataTransfer.getData('text/plain'), rows.at(-1) ?? null) }}
      className="flex w-[260px] shrink-0 flex-col rounded-xl border border-[#E2DED5] bg-[#F7F5F0] p-2"
    >
      <header className="mb-2 flex items-center justify-between px-1">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-[3px]"
            style={{ background: choice?.tone ?? '#D6D1C6' }}
          />
          <span className="text-[11px] font-bold uppercase tracking-[0.13em] text-[#4A463E]">
            {choice?.name ?? t('No value')}
          </span>
        </span>
        <span className="text-[11px] text-[#B6B1A6]">{rows.length}</span>
      </header>

      {rows.map((row) => (
        <button
          key={row.id}
          type="button"
          draggable
          onDragStart={(e) => e.dataTransfer.setData('text/plain', row.id)}
          onClick={() => onOpen(row)}
          className="mb-1.5 w-full rounded-lg border border-[#E2DED5] bg-[#FCFBF8] px-2.5 py-2 text-left text-sm text-[#141310] hover:border-[#C8452D]"
        >
          {row.icon && <span className="mr-1.5">{row.icon}</span>}
          {row.title || t('Untitled')}
          {fields.filter((f) => f.type !== 'select' && cellsOf(row)[f.id] !== undefined).slice(0, 2).map((f) => (
            <span key={f.id} className="mt-1 block truncate text-[11px] text-[#8A867C]">
              {f.name}: {String(cellsOf(row)[f.id])}
            </span>
          ))}
        </button>
      ))}

      <button
        type="button"
        onClick={onAdd}
        className="rounded-lg px-2 py-1.5 text-left text-[12px] font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
      >
        <Plus size={12} className="mr-1 inline" /> {t('New row')}
      </button>
    </section>
  )
}

function Board({ db, rows, view, fields }: { db: Row; rows: Row[]; view: View; fields: Field[] }) {
  const grouping = fields.find((f) => f.id === view.groupBy)

  const drop = (choiceId: string | null) => (rowId: string, after: Row | null) => {
    const row = rows.find((r) => r.id === rowId)
    if (!row || !grouping) return
    setCell(row, grouping.id, choiceId ?? '')
    patchRecord(row.id, { position: between(after, null) })
  }

  if (!grouping) {
    return (
      <p className="mt-4 max-w-[62ch] text-sm leading-relaxed text-[#4A463E]">
        {t('A board groups rows by a select column. Add one, then choose it above.')}
      </p>
    )
  }

  return (
    <div className="mt-4 flex gap-3 overflow-x-auto pb-3">
      {groupsOf(rows, grouping).map(({ choice, rows: held }) => (
        <Column
          key={choice?.id ?? UNSET}
          choice={choice}
          rows={held}
          fields={fields}
          onOpen={(row) => go(`/d/${row.id}`)}
          onDrop={drop(choice?.id ?? null)}
          onAdd={() => void createRecord('', 'doc', db.id).then((id) => {
            const made = getPages().find((r) => r.id === id)
            if (made && choice) setCell(made, grouping.id, choice.id)
          })}
        />
      ))}
    </div>
  )
}

// A database is a page whose children are its rows, and a view is a way of drawing them. Nothing
// here is a second kind of thing: the rows are records, so a row opens as a page and turns up in
// search beside everything else.
export function Database({ db }: { db: Row }) {
  useSyncExternalStore(subscribeRecords, pages, pages)
  const workspace = useSyncExternalStore(subscribeWorkspace, getWorkspace, getWorkspace)
  const [team, setTeam] = useState<Teammate[]>([])
  const [at, setAt] = useState(0)

  useEffect(() => { if (workspace) void listTeam().then(setTeam) }, [workspace])

  const schema = schemaOf(db)
  const view = schema.views[Math.min(at, schema.views.length - 1)] ?? schema.views[0]
  const all = rowsOf(db.id)
  const mine = applyView(all, view, schema.fields)

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-1 border-b border-[#EAE6DD] pb-2">
        {schema.views.map((one, i) => (
          <span key={one.id} className="group flex items-center">
            <button
              type="button"
              aria-current={i === at ? 'true' : undefined}
              onClick={() => setAt(i)}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors
                ${i === at ? 'bg-[#F7E9E4] text-[#C8452D]' : 'text-[#4A463E] hover:bg-[#EAE6DD]'}`}
            >{one.name}</button>
            {i === at && schema.views.length > 1 && (
              <button
                type="button"
                aria-label={t('Remove view')}
                onClick={() => { removeView(db, one.id); setAt(0) }}
                className="ml-0.5 grid h-5 w-5 place-items-center rounded text-[#8A867C] opacity-0 hover:text-[#DC2626] group-hover:opacity-100"
              >
                <X size={11} />
              </button>
            )}
          </span>
        ))}

        {(['table', 'board', 'gallery', 'calendar', 'timeline'] as const).map((kind) => (
          <button
            key={kind}
            type="button"
            onClick={() => { addView(db, kind, t(KIND_NAME[kind])); setAt(schema.views.length) }}
            className="rounded-lg px-2 py-1 text-xs font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
          >+ {t(KIND_NAME[kind])}</button>
        ))}

        {(view?.kind === 'board' || view?.kind === 'table') && (
          <select
            value={view.groupBy ?? ''}
            onChange={(e) => editView(db, view.id, { groupBy: e.target.value || undefined })}
            className="ml-auto rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-0.5 text-xs outline-none"
          >
            <option value="">{view.kind === 'board' ? t('Group by…') : t('No grouping')}</option>
            {schema.fields.filter((f) => f.type === 'select' || f.type === 'status').map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}

        {(view?.kind === 'calendar' || view?.kind === 'timeline') && (
          <select
            value={view.dateBy ?? ''}
            onChange={(e) => editView(db, view.id, { dateBy: e.target.value || undefined })}
            className="ml-auto rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-0.5 text-xs outline-none"
          >
            <option value="">{view.kind === 'calendar' ? t('Place by…') : t('Starts on…')}</option>
            {schema.fields.filter((f) => f.type === 'date').map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}

        {view?.kind === 'timeline' && (
          <select
            value={view.endBy ?? ''}
            onChange={(e) => editView(db, view.id, { endBy: e.target.value || undefined })}
            className="rounded-md border border-[#E2DED5] bg-[#FCFBF8] px-1.5 py-0.5 text-xs outline-none"
          >
            <option value="">{t('Ends on…')}</option>
            {schema.fields.filter((f) => f.type === 'date' && f.id !== view.dateBy).map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        )}
      </div>

      {view && <ViewBar db={db} view={view} fields={schema.fields} hidden={all.length - mine.length} />}

      {view?.kind === 'board' && <Board db={db} rows={mine} view={view} fields={schema.fields} />}
      {view?.kind === 'gallery' && (
        <DatabaseGallery dbId={db.id} rows={mine} fields={schema.fields} team={team} />
      )}
      {view?.kind === 'calendar' && (
        <DatabaseCalendar db={db} rows={mine} view={view} fields={schema.fields} />
      )}
      {view?.kind === 'timeline' && (
        <DatabaseTimeline rows={mine} view={view} fields={schema.fields} />
      )}
      {(!view || view.kind === 'table') && (
        <DatabaseTable
          db={db}
          rows={mine}
          fields={schema.fields}
          group={schema.fields.find((f) =>
            f.id === view?.groupBy && (f.type === 'select' || f.type === 'status'))}
          team={team}
          onAddField={() => addField(db, 'text', t('Field'))}
        />
      )}

      <p className="mt-3 text-[11px] text-[#B6B1A6]">
        {mine.length} {t(mine.length === 1 ? 'row' : 'rows')} · {t('a row is a page: open one to write in it')}
      </p>
    </div>
  )
}
