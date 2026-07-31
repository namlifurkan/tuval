import { useState } from 'react'
import { ChevronDown, Plus, Trash2 } from 'lucide-react'
import { go } from '../board/boards'
import {
  addChoice, cellsOf, editField, FIELD_TYPES, removeField, setCell,
} from '../board/database'
import type { Choice, Field, FieldType } from '../board/database'
import { archiveRecord, createRecord, patchRecord } from '../board/records'
import type { Record as Row } from '../board/records'
import type { Teammate } from '../board/workspace'
import { t } from '../i18n'
import { Popover } from './Popover'

const cell = 'w-full bg-transparent px-2.5 py-1.5 text-sm text-[#141310] outline-none focus:bg-[#F7E9E4]'

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

function Cell({ db, row, field, team }: { db: Row; row: Row; field: Field; team: Teammate[] }) {
  const held = cellsOf(row)[field.id]

  if (field.type === 'select') return <SelectCell db={db} row={row} field={field} />

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

function Head({ db, field }: { db: Row; field: Field }) {
  return (
    <th scope="col" className="border-b border-[#E2DED5] p-0 text-left font-normal">
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

// A hundred rows in a workspace, not a hundred thousand, so this is a table element with the
// sorting done in memory. Virtual scrolling and server-side paging are what the next order of
// magnitude needs, and this one does not have it.
export function DatabaseTable({ db, rows, fields, team, onAddField }: {
  db: Row
  rows: Row[]
  fields: Field[]
  team: Teammate[]
  onAddField: () => void
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <caption className="sr-only">{db.title || t('Untitled database')}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-[36%] border-b border-[#E2DED5] px-2.5 py-2 text-left text-[12px] font-bold uppercase tracking-[0.1em] text-[#8A867C]">
              {t('Name')}
            </th>
            {fields.map((field) => <Head key={field.id} db={db} field={field} />)}
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

        <tbody>
          {rows.map((row) => (
            <tr key={row.id} className="group border-b border-[#EAE6DD]">
              <th scope="row" className="p-0 text-left font-normal">
                <div className="flex items-center">
                  <input
                    value={row.title}
                    onChange={(e) => patchRecord(row.id, { title: e.target.value })}
                    placeholder={t('Untitled')}
                    className={`${cell} font-medium placeholder:text-[#C6C2B6]`}
                  />
                  <button
                    type="button"
                    onClick={() => go(`/d/${row.id}`)}
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[#8A867C] opacity-0 transition-opacity hover:text-[#C8452D] group-hover:opacity-100"
                  >{t('Open')}</button>
                  <button
                    type="button"
                    aria-label={t('Archive')}
                    onClick={() => void archiveRecord(row.id)}
                    className="mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#8A867C] opacity-0 transition-opacity hover:bg-[#FEF2F2] hover:text-[#DC2626] group-hover:opacity-100"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </th>
              {fields.map((field) => (
                <td key={field.id} className="p-0 align-middle">
                  <Cell db={db} row={row} field={field} team={team} />
                </td>
              ))}
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      <button
        type="button"
        onClick={() => void createRecord('', 'doc', db.id)}
        className="flex w-full items-center gap-2 border-b border-[#EAE6DD] px-2.5 py-2 text-left text-sm font-semibold text-[#8A867C] hover:bg-[#EAE6DD] hover:text-[#C8452D]"
      >
        <Plus size={14} /> {t('New row')}
      </button>
    </div>
  )
}
