import { useState } from 'react'
import { ArrowUpRight, Bookmark, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { go } from '../board/boards'
import {
  addChoice, cellsOf, cellText, COMPUTED, editField, FIELD_TYPES, groupsOf, linksOf, removeField,
  ROLLS, rowsOf, schemaOf, setCell, TITLE, toggleLink,
} from '../board/database'
import type { Choice, Field, FieldType, Roll } from '../board/database'
import { ERROR } from '../board/formula'
import { isTemplate, rowTemplates, setTemplate, fromTemplate } from '../board/pageTemplates'
import { archiveRecord, createRecord, getRecords, patchRecord } from '../board/records'
import type { Record as Row } from '../board/records'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { Popover } from './Popover'

const cell = 'w-full bg-transparent px-2.5 py-1.5 text-sm text-[#141310] outline-none focus:bg-[#F7E9E4]'

const UNGROUPED = '__none__'

function Tag({ choice }: { choice: Choice }) {
  return (
    <span
      className="rounded-md px-1.5 py-0.5 text-[12px] font-medium text-[#141310]"
      style={{ background: choice.tone }}
    >
      {choice.name}
    </span>
  )
}

function SelectCell({ db, row, field }: { db: Row; row: Row; field: Field }) {
  const [typed, setTyped] = useState('')
  const choices = field.choices ?? []
  const held = choices.find((c) => c.id === cellsOf(row)[field.id])

  return (
    <Popover
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex w-full items-center px-2.5 py-1.5 text-left text-sm hover:bg-[#F2EFE9]"
        >
          {held ? <Tag choice={held} /> : <span className="text-[#C6C2B6]">—</span>}
        </button>
      )}
    >
      {(close) => {
        const pick = (choice: Choice | null) => {
          setCell(row, field.id, choice?.id ?? '')
          setTyped('')
          close()
        }
        return (
          <>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== 'Enter' || !typed.trim()) return
                const match = choices.find((c) => c.name.toLowerCase() === typed.trim().toLowerCase())
                pick(match ?? addChoice(db, field.id, typed.trim()))
              }}
              placeholder={t('Find or create')}
              className="mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none focus:border-[#C8452D]"
            />
            {held && (
              <button
                type="button"
                onClick={() => pick(null)}
                className="w-full rounded-md px-2 py-1 text-left text-[12px] text-[#8A867C] hover:bg-[#EAE6DD]"
              >{t('Clear')}</button>
            )}
            {choices
              .filter((c) => c.name.toLowerCase().includes(typed.trim().toLowerCase()))
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => pick(c)}
                  className="flex w-full rounded-md px-2 py-1 text-left hover:bg-[#EAE6DD]"
                ><Tag choice={c} /></button>
              ))}
          </>
        )
      }}
    </Popover>
  )
}

function Chip({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <span
      role={onClick ? 'button' : undefined}
      onClick={onClick}
      className="max-w-[130px] truncate rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-1.5 py-0.5 text-[12px] text-[#141310] hover:border-[#C8452D]"
    >{children}</span>
  )
}

// A row of one database pointing at rows of another. Notion's most useful column and the reason
// several databases are one workspace rather than several lists.
function RelationCell({ row, field }: { row: Row; field: Field }) {
  const [typed, setTyped] = useState('')
  const linked = linksOf(row, field.id)
  const target = field.db ? rowsOf(field.db) : []
  const named = (id: string) =>
    getRecords('doc').find((r) => r.id === id)?.title || t('Untitled')

  if (!field.db) {
    return <span className="block px-2.5 py-1.5 text-[12px] text-[#C6C2B6]">{t('Pick a database')}</span>
  }

  return (
    <Popover
      width={220}
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          className="flex w-full flex-wrap items-center gap-1 px-2.5 py-1.5 text-left hover:bg-[#F2EFE9]"
        >
          {linked.length
            ? linked.map((id) => <Chip key={id}>{named(id)}</Chip>)
            : <span className="text-sm text-[#C6C2B6]">—</span>}
        </button>
      )}
    >
      {() => (
        <>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={t('Find a row')}
            className="mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none focus:border-[#C8452D]"
          />
          {target
            .filter((r) => (r.title || t('Untitled')).toLowerCase().includes(typed.trim().toLowerCase()))
            .slice(0, 12)
            .map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => toggleLink(row, field.id, r.id)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-[12px] hover:bg-[#EAE6DD]"
              >
                <span className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px]
                  ${linked.includes(r.id) ? 'border-[#C8452D] bg-[#C8452D] text-white' : 'border-[#D8D5CD]'}`}
                >{linked.includes(r.id) ? '✓' : ''}</span>
                <span className="min-w-0 flex-1 truncate">{r.title || t('Untitled')}</span>
              </button>
            ))}
          {!target.length && (
            <p className="px-2 py-1 text-[12px] text-[#8A867C]">{t('That database has no rows yet.')}</p>
          )}
        </>
      )}
    </Popover>
  )
}

function Cell({ db, row, field, fields, team }: {
  db: Row; row: Row; field: Field; fields: Field[]; team: Teammate[]
}) {
  const held = cellsOf(row)[field.id]

  // Worked out, not typed in, so there is nothing here to click into.
  if (COMPUTED.includes(field.type)) {
    const shown = cellText(row, field, fields)
    return (
      <span className={`block truncate px-2.5 py-1.5 text-sm ${shown === ERROR ? 'text-[#DC2626]' : 'text-[#4A463E]'}`}>
        {shown || <span className="text-[#C6C2B6]">—</span>}
      </span>
    )
  }

  if (field.type === 'select') return <SelectCell db={db} row={row} field={field} />
  if (field.type === 'relation') return <RelationCell row={row} field={field} />

  if (field.type === 'checkbox') {
    return (
      <div className="px-2.5 py-1.5">
        <input
          type="checkbox"
          checked={held === true}
          onChange={(e) => setCell(row, field.id, e.target.checked || '')}
          className="h-4 w-4 accent-[#C8452D]"
        />
      </div>
    )
  }

  if (field.type === 'person') {
    return (
      <select
        value={typeof held === 'string' ? held : ''}
        onChange={(e) => setCell(row, field.id, e.target.value)}
        className={cell}
      >
        <option value="">{t('Nobody')}</option>
        {team.map((m) => (
          <option key={m.userId} value={m.userId}>{m.email.split('@')[0] || t('Member')}</option>
        ))}
      </select>
    )
  }

  const kind = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'
  return (
    <input
      type={kind}
      value={held === undefined || held === null ? '' : String(held)}
      onChange={(e) => setCell(
        row,
        field.id,
        field.type === 'number' && e.target.value !== '' ? Number(e.target.value) : e.target.value,
      )}
      className={cell}
    />
  )
}

const pick = 'mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none'

// Three questions in the order they can be answered: which relation, which column on the far
// side, what to do with the values. The second is unanswerable until the first has an answer.
function Rollup({ db, field, fields }: { db: Row; field: Field; fields: Field[] }) {
  const via = fields.find((f) => f.id === field.via && f.type === 'relation')
  const far = via?.db ? schemaOf(getRecords('database').find((d) => d.id === via.db)).fields : []

  return (
    <>
      <select
        value={field.via ?? ''}
        onChange={(e) => editField(db, field.id, { via: e.target.value || undefined, then: TITLE })}
        className={pick}
      >
        <option value="">{t('Through which relation?')}</option>
        {fields.filter((f) => f.type === 'relation' && f.db).map((f) => (
          <option key={f.id} value={f.id}>{f.name}</option>
        ))}
      </select>
      {!!via?.db && (
        <select
          value={field.then ?? TITLE}
          onChange={(e) => editField(db, field.id, { then: e.target.value })}
          className={pick}
        >
          <option value={TITLE}>{t('Name')}</option>
          {far.filter((f) => !COMPUTED.includes(f.type) || f.type === 'formula').map((f) => (
            <option key={f.id} value={f.id}>{f.name}</option>
          ))}
        </select>
      )}
      <select
        value={field.roll ?? 'count'}
        onChange={(e) => editField(db, field.id, { roll: e.target.value as Roll })}
        className={pick}
      >
        {ROLLS.map((r) => <option key={r} value={r}>{t(r)}</option>)}
      </select>
    </>
  )
}

function Head({ db, field, fields }: { db: Row; field: Field; fields: Field[] }) {
  return (
    <th scope="col" className="min-w-[120px] border-b border-[#E2DED5] p-0 text-left font-normal">
      <Popover
        width={190}
        trigger={({ toggle }) => (
          <button
            type="button"
            onClick={toggle}
            className="flex w-full items-center gap-1 px-2.5 py-2 text-[12px] font-bold uppercase tracking-[0.1em] text-[#8A867C] hover:bg-[#EAE6DD]"
          >
            <span className="min-w-0 flex-1 truncate text-left">{field.name}</span>
            <ChevronDown size={12} className="shrink-0" />
          </button>
        )}
      >
        {(close) => (
          <>
            <input
              value={field.name}
              onChange={(e) => editField(db, field.id, { name: e.target.value })}
              className="mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none focus:border-[#C8452D]"
            />
            <select
              value={field.type}
              onChange={(e) => editField(db, field.id, {
                type: e.target.value as FieldType,
                choices: e.target.value === 'select' ? field.choices ?? [] : undefined,
              })}
              className="mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none"
            >
              {FIELD_TYPES.map((type) => <option key={type} value={type}>{t(type)}</option>)}
            </select>
            {field.type === 'relation' && (
              <select
                value={field.db ?? ''}
                onChange={(e) => editField(db, field.id, { db: e.target.value || undefined })}
                className="mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 text-[13px] outline-none"
              >
                <option value="">{t('Pick a database')}</option>
                {getRecords('database').filter((d) => d.id !== db.id).map((d) => (
                  <option key={d.id} value={d.id}>{d.title || t('Untitled database')}</option>
                ))}
              </select>
            )}
            {field.type === 'formula' && (
              <>
                <input
                  value={field.formula ?? ''}
                  onChange={(e) => editField(db, field.id, { formula: e.target.value })}
                  placeholder='prop("Price") * 1.2'
                  spellCheck={false}
                  className="mb-1 w-full rounded-md border border-[#E2DED5] bg-[#F2EFE9] px-2 py-1 font-mono text-[12px] outline-none focus:border-[#C8452D]"
                />
                <p className="mb-1 px-0.5 text-[11px] leading-snug text-[#8A867C]">
                  {t('prop("Name") reads a column. || joins text, ? : chooses. Also empty, text, number, today, days, round, abs, min, max.')}
                </p>
              </>
            )}
            {field.type === 'rollup' && <Rollup db={db} field={field} fields={fields} />}
            <button
              type="button"
              onClick={() => { removeField(db, field.id); close() }}
              className="w-full rounded-md px-2 py-1 text-left text-[12px] text-[#8A867C] hover:bg-[#FEF2F2] hover:text-[#DC2626]"
            >{t('Delete column')}</button>
          </>
        )}
      </Popover>
    </th>
  )
}

function Line({ db, row, fields, team }: { db: Row; row: Row; fields: Field[]; team: Teammate[] }) {
  return (
    <tr className="group border-b border-[#EAE6DD]">
      <th scope="row" className="p-0 text-left font-normal">
        <div className="flex items-center">
          <input
            value={row.title}
            onChange={(e) => patchRecord(row.id, { title: e.target.value })}
            placeholder={t('Untitled')}
            className={`${cell} font-medium placeholder:text-[#C6C2B6]`}
          />
          {/* Icons rather than words: the title is what the column is for, and three labels beside
              it left the name a sliver once a database had a few columns. */}
          <button
            type="button"
            aria-label={t('Open')}
            title={t('Open')}
            onClick={() => go(`/d/${row.id}`)}
            className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] opacity-0 transition-opacity hover:text-[#C8452D] group-hover:opacity-100"
          >
            <ArrowUpRight size={13} />
          </button>
          <button
            type="button"
            aria-label={isTemplate(row) ? t('A template') : t('Make a template')}
            title={isTemplate(row) ? t('A template') : t('Make a template')}
            onClick={() => setTemplate(row, !isTemplate(row))}
            className={`grid h-6 w-6 shrink-0 place-items-center rounded-md transition-opacity
              ${isTemplate(row) ? 'text-[#C8452D] opacity-100' : 'text-[#8A867C] opacity-0 hover:text-[#141310] group-hover:opacity-100'}`}
          >
            <Bookmark size={13} fill={isTemplate(row) ? 'currentColor' : 'none'} />
          </button>
          <button
            type="button"
            aria-label={t('Archive')}
            title={t('Archive')}
            onClick={() => void archiveRecord(row.id)}
            className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] opacity-0 transition-opacity hover:bg-[#FEF2F2] hover:text-[#DC2626] group-hover:opacity-100"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </th>
      {fields.map((field) => (
        <td key={field.id} className="p-0 align-middle">
          <Cell db={db} row={row} field={field} fields={fields} team={team} />
        </td>
      ))}
      <td />
    </tr>
  )
}

// A hundred rows in a workspace, not a hundred thousand, so this is a table element with the
// sorting done in memory. Virtual scrolling and server-side paging are what the next order of
// magnitude needs, and this one does not have it.
export function DatabaseTable({ db, rows, fields, group, team, onAddField }: {
  db: Row
  rows: Row[]
  fields: Field[]
  group: Field | undefined
  team: Teammate[]
  onAddField: () => void
}) {
  const [shut, setShut] = useState<string[]>([])
  const groups = groupsOf(rows, group)
  const span = fields.length + 2

  const newRow = async (choice: Choice | null) => {
    const id = await createRecord('', 'doc', db.id)
    const made = getRecords('doc').find((r) => r.id === id)
    if (made && group && choice) setCell(made, group.id, choice.id)
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{db.title || t('Untitled database')}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[36%] min-w-[220px] border-b border-[#E2DED5] px-2.5 py-2 text-left text-[12px] font-bold uppercase tracking-[0.1em] text-[#8A867C]">
              {t('Name')}
            </th>
            {fields.map((field) => <Head key={field.id} db={db} field={field} fields={fields} />)}
            <th scope="col" className="w-9 border-b border-[#E2DED5] p-0">
              <button
                type="button"
                aria-label={t('Add a column')}
                onClick={onAddField}
                className="grid h-full w-9 place-items-center text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#141310]"
              >
                <Plus size={14} />
              </button>
            </th>
          </tr>
        </thead>

        {groups.map(({ choice, rows: held }) => {
          const key = choice?.id ?? UNGROUPED
          // Without a grouping column there is one group holding everything, and a heading over
          // the whole table saying "No value" would be a heading over nothing.
          if (!group) {
            return (
              <tbody key={key}>
                {held.map((row) => <Line key={row.id} db={db} row={row} fields={fields} team={team} />)}
              </tbody>
            )
          }
          // An empty group still shows: it is where you put the first row of that kind, and a
          // column that vanishes when you empty it is one you cannot fill again.
          const open = !shut.includes(key)
          return (
            <tbody key={key}>
              <tr className="border-b border-[#EAE6DD] bg-[#F7F5F0]">
                <th scope="colgroup" colSpan={span} className="p-0 text-left font-normal">
                  <div className="flex items-center">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setShut((was) =>
                        was.includes(key) ? was.filter((k) => k !== key) : [...was, key])}
                      className="flex flex-1 items-center gap-1.5 px-2 py-1.5 text-left hover:bg-[#EAE6DD]"
                    >
                      {open ? <ChevronDown size={12} className="text-[#8A867C]" />
                        : <ChevronRight size={12} className="text-[#8A867C]" />}
                      {choice
                        ? <Tag choice={choice} />
                        : <span className="text-[12px] font-semibold text-[#8A867C]">{t('No value')}</span>}
                      <span className="text-[11px] text-[#B6B1A6]">{held.length}</span>
                    </button>
                    <button
                      type="button"
                      aria-label={t('New row')}
                      onClick={() => void newRow(choice)}
                      className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                </th>
              </tr>
              {open && held.map((row) => (
                <Line key={row.id} db={db} row={row} fields={fields} team={team} />
              ))}
            </tbody>
          )
        })}
      </table>

      <div className="flex items-center border-b border-[#EAE6DD]">
        <button
          type="button"
          onClick={() => void createRecord('', 'doc', db.id)}
          className="flex flex-1 items-center gap-2 px-2.5 py-2 text-left text-sm font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
        >
          <Plus size={14} /> {t('New row')}
        </button>

        {!!rowTemplates(db.id).length && (
          <Popover
            width={200}
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                className="px-2.5 py-2 text-[12px] font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
              >{t('From a template')}</button>
            )}
          >
            {(close) => (
              <>
                {rowTemplates(db.id).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => { close(); void fromTemplate(tpl.id, db.id) }}
                    className="w-full truncate rounded-md px-2 py-1 text-left text-[12px] hover:bg-[#EAE6DD]"
                  >{tpl.title || t('Untitled')}</button>
                ))}
              </>
            )}
          </Popover>
        )}
      </div>
    </div>
  )
}
