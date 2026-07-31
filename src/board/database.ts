import { nanoid } from 'nanoid'
import { getRecords, patchRecord } from './records'
import type { Record as Row } from './records'

export type FieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'person' | 'url' | 'relation'

export const FIELD_TYPES: FieldType[] =
  ['text', 'number', 'select', 'date', 'checkbox', 'person', 'url', 'relation']

export interface Choice { id: string; name: string; tone: string }
// `db` is the database a relation points at. A relation with none yet is a column waiting to
// be told what it relates to, not a broken one.
export interface Field {
  id: string
  name: string
  type: FieldType
  choices?: Choice[]
  db?: string
}

export type Op =
  | 'contains' | 'is' | 'isNot' | 'empty' | 'notEmpty'
  | 'gt' | 'lt' | 'before' | 'after' | 'checked' | 'unchecked'

export interface Filter { id: string; field: string; op: Op; value?: string }
export interface Sort { field: string; dir: 'asc' | 'desc' }

export type ViewKind = 'table' | 'board' | 'gallery' | 'calendar'

export interface View {
  id: string
  name: string
  kind: ViewKind
  groupBy?: string
  dateBy?: string
  filters?: Filter[]
  sorts?: Sort[]
}

// The name column is not one of the user's fields but it is the one everybody filters and sorts
// by first, so it answers to a reserved id rather than being a special case at every call site.
export const TITLE = '__title__'

const OPS: { [K in FieldType | 'title']: Op[] } = {
  title: ['contains', 'is', 'empty', 'notEmpty'],
  text: ['contains', 'is', 'empty', 'notEmpty'],
  url: ['contains', 'is', 'empty', 'notEmpty'],
  number: ['is', 'gt', 'lt', 'empty', 'notEmpty'],
  select: ['is', 'isNot', 'empty', 'notEmpty'],
  date: ['is', 'before', 'after', 'empty', 'notEmpty'],
  checkbox: ['checked', 'unchecked'],
  person: ['is', 'empty', 'notEmpty'],
  relation: ['is', 'empty', 'notEmpty'],
}

export const opsFor = (field: Field | null) => OPS[field?.type ?? 'title']

export const NO_VALUE: Op[] = ['empty', 'notEmpty', 'checked', 'unchecked']

// The key is short because it is stored; the label is a sentence because it is read.
export const OP_LABEL: { [K in Op]: string } = {
  contains: 'contains',
  is: 'is',
  isNot: 'is not',
  empty: 'is empty',
  notEmpty: 'is not empty',
  gt: 'is more than',
  lt: 'is less than',
  before: 'is before',
  after: 'is after',
  checked: 'is checked',
  unchecked: 'is not checked',
}

export interface Schema { fields: Field[]; views: View[] }

// The gouache palette, so a tag in a database and a sticky on a board are the same colour.
export const TONES = [
  '#F0E3B0', '#E8C55A', '#DE9A4E', '#C8664A', '#E7B7B4', '#B9718A',
  '#CBD79A', '#8FA96B', '#5E9A8A', '#7FA5BE', '#3E5C93', '#8A7FB0',
]

const EMPTY: Schema = { fields: [], views: [] }

// data is untyped as far as the database is concerned, and a row written by an older build is a
// row this one still has to draw. Everything is read defensively and nothing throws.
export function schemaOf(record: Row | undefined): Schema {
  const raw = (record as unknown as { data?: unknown })?.data
  if (!raw || typeof raw !== 'object') return EMPTY
  const held = raw as { fields?: unknown; views?: unknown }
  const fields = Array.isArray(held.fields) ? (held.fields as Field[]).filter((f) => f?.id && f?.type) : []
  const views = Array.isArray(held.views) ? (held.views as View[]).filter((v) => v?.id && v?.kind) : []
  return { fields, views: views.length ? views : [{ id: 'table', name: 'Table', kind: 'table' }] }
}

export const cellsOf = (record: Row | undefined): Record<string, unknown> => {
  const raw = (record as unknown as { data?: unknown })?.data
  return raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
}

export const rowsOf = (id: string) => getRecords('doc').filter((r) => r.parent_id === id)

const writeSchema = (id: string, next: Schema) =>
  patchRecord(id, { data: next } as unknown as Partial<Row>)

export function addField(db: Row, type: FieldType = 'text', name = 'Field') {
  const held = schemaOf(db)
  const field: Field = { id: nanoid(8), name, type }
  if (type === 'select') field.choices = []
  writeSchema(db.id, { ...held, fields: [...held.fields, field] })
}

export function editField(db: Row, fieldId: string, changes: Partial<Field>) {
  const held = schemaOf(db)
  writeSchema(db.id, {
    ...held,
    fields: held.fields.map((f) => (f.id === fieldId ? { ...f, ...changes } : f)),
  })
}

// The values stay on the rows. Leaving them there means undoing the removal by adding the
// column back, and means a column removed by mistake costs nothing.
export function removeField(db: Row, fieldId: string) {
  const held = schemaOf(db)
  writeSchema(db.id, {
    ...held,
    fields: held.fields.filter((f) => f.id !== fieldId),
    views: held.views.map((v) => (v.groupBy === fieldId ? { ...v, groupBy: undefined } : v)),
  })
}

export function addChoice(db: Row, fieldId: string, name: string): Choice {
  const held = schemaOf(db)
  const field = held.fields.find((f) => f.id === fieldId)
  const made: Choice = {
    id: nanoid(8),
    name,
    tone: TONES[(field?.choices?.length ?? 0) % TONES.length],
  }
  editField(db, fieldId, { choices: [...(field?.choices ?? []), made] })
  return made
}

// A board needs something to group by and a calendar needs something to place by. Both pick the
// first column that can answer, so a new view shows the rows rather than an empty frame with a
// note telling you to configure it.
export function addView(db: Row, kind: ViewKind, name: string) {
  const held = schemaOf(db)
  const groupBy = kind === 'board' ? held.fields.find((f) => f.type === 'select')?.id : undefined
  const dateBy = kind === 'calendar' ? held.fields.find((f) => f.type === 'date')?.id : undefined
  writeSchema(db.id, {
    ...held,
    views: [...held.views, { id: nanoid(8), name, kind, groupBy, dateBy }],
  })
}

// Dates are kept the way a date input hands them over, as YYYY-MM-DD, so a day is compared by
// string and no clock or timezone gets a say in which day a row lands on.
// A relation is a list of record ids. Read through a helper because a column that used to be
// text and was changed to a relation still has a string in some rows.
export const linksOf = (row: Row, fieldId: string): string[] => {
  const value = cellsOf(row)[fieldId]
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

export function toggleLink(row: Row, fieldId: string, id: string) {
  const now = linksOf(row, fieldId)
  setCell(row, fieldId, now.includes(id) ? now.filter((x) => x !== id) : [...now, id])
}

// What points here. Read from the other side rather than written on both, so the two can never
// disagree: there is one list, and this is it seen backwards.
export interface Backlink { row: Row; field: Field; db: Row }

export function relatedTo(row: Row, databases: Row[], rows: Row[]): Backlink[] {
  const mine = row.parent_id
  if (!mine) return []
  const found: Backlink[] = []
  for (const db of databases) {
    for (const field of schemaOf(db).fields) {
      if (field.type !== 'relation' || field.db !== mine) continue
      for (const other of rows) {
        if (other.parent_id === db.id && linksOf(other, field.id).includes(row.id)) {
          found.push({ row: other, field, db })
        }
      }
    }
  }
  return found
}

export const dayOf = (row: Row, fieldId: string | undefined): string =>
  (fieldId && typeof cellsOf(row)[fieldId] === 'string' ? String(cellsOf(row)[fieldId]) : '').slice(0, 10)

export const monthKey = (iso: string) => iso.slice(0, 7)

export const shiftMonth = (key: string, by: number) => {
  const [year, month] = key.split('-').map(Number)
  const at = new Date(Date.UTC(year, month - 1 + by, 1))
  return `${at.getUTCFullYear()}-${String(at.getUTCMonth() + 1).padStart(2, '0')}`
}

// Six weeks from the Monday on or before the first, which is every layout a month can need and
// keeps the grid from changing height as you page through the year.
export function monthGrid(key: string): string[] {
  const [year, month] = key.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1, 1))
  const back = (first.getUTCDay() + 6) % 7
  const start = new Date(Date.UTC(year, month - 1, 1 - back))
  return Array.from({ length: 42 }, (_, i) => {
    const at = new Date(start.getTime() + i * 86400000)
    return at.toISOString().slice(0, 10)
  })
}

// Rows split by a select column. A value naming a choice that has since been deleted is not a
// group of its own; it falls in with the rows that never had one.
export interface Group { choice: Choice | null; rows: Row[] }

export function groupsOf(rows: Row[], field: Field | undefined): Group[] {
  if (!field) return [{ choice: null, rows }]
  const choices = field.choices ?? []
  const of = (row: Row) => choices.find((c) => c.id === cellsOf(row)[field.id]) ?? null
  return [
    ...choices.map((choice) => ({ choice, rows: rows.filter((r) => of(r) === choice) })),
    { choice: null, rows: rows.filter((r) => !of(r)) },
  ]
}

export function editView(db: Row, viewId: string, changes: Partial<View>) {
  const held = schemaOf(db)
  writeSchema(db.id, {
    ...held,
    views: held.views.map((v) => (v.id === viewId ? { ...v, ...changes } : v)),
  })
}

export function removeView(db: Row, viewId: string) {
  const held = schemaOf(db)
  if (held.views.length < 2) return
  writeSchema(db.id, { ...held, views: held.views.filter((v) => v.id !== viewId) })
}

// shortcut: the whole data object is rewritten for one cell, so two people editing different
// cells of the same row at the same second lose one of the two. Per-cell writes need a table of
// values, which is the upgrade path if rows ever get edited by more than one person at once.
export function setCell(row: Row, fieldId: string, value: unknown) {
  const next = { ...cellsOf(row) }
  if (value === '' || value === null || value === undefined) delete next[fieldId]
  else next[fieldId] = value
  patchRecord(row.id, { data: next } as unknown as Partial<Row>)
}

export const cellText = (row: Row, field: Field): string => {
  const value = cellsOf(row)[field.id]
  return value === undefined || value === null ? '' : String(value)
}

const held = (row: Row, fieldId: string) =>
  fieldId === TITLE ? row.title : cellsOf(row)[fieldId]

const same = (a: unknown, b: string) => String(a ?? '').toLowerCase() === b.toLowerCase()

function passes(row: Row, filter: Filter): boolean {
  const value = held(row, filter.field)
  const want = filter.value ?? ''
  // A relation holds a list, so "is" asks whether the list names it and "empty" asks whether
  // the list is there at all.
  if (Array.isArray(value)) {
    switch (filter.op) {
      case 'empty': return !value.length
      case 'notEmpty': return value.length > 0
      case 'is': return value.includes(want)
      default: return true
    }
  }
  switch (filter.op) {
    case 'empty': return value === undefined || value === null || value === ''
    case 'notEmpty': return !(value === undefined || value === null || value === '')
    case 'checked': return value === true
    case 'unchecked': return value !== true
    case 'is': return same(value, want)
    case 'isNot': return !same(value, want)
    case 'contains': return String(value ?? '').toLowerCase().includes(want.toLowerCase())
    case 'gt': return Number(value) > Number(want)
    case 'lt': return Number(value) < Number(want)
    case 'before': return String(value ?? '') !== '' && String(value) < want
    case 'after': return String(value ?? '') !== '' && String(value) > want
    default: return true
  }
}

// shortcut: filtering and sorting happen in memory over the whole set, which is right while a
// workspace holds hundreds of rows. Past a few thousand this belongs in the query, and the
// filters are already the shape of one.
export function applyView(rows: Row[], view: View | undefined): Row[] {
  const filters = view?.filters ?? []
  const sorts = view?.sorts ?? []
  const kept = filters.length ? rows.filter((r) => filters.every((f) => passes(r, f))) : rows
  if (!sorts.length) return kept

  return [...kept].sort((a, b) => {
    for (const sort of sorts) {
      const [left, right] = [held(a, sort.field), held(b, sort.field)]
      // An empty cell sorts last whichever way the column is pointing, because a row with no
      // value is not the smallest value, it is a row with no value.
      const [emptyL, emptyR] = [left === undefined || left === '', right === undefined || right === '']
      if (emptyL !== emptyR) return emptyL ? 1 : -1
      if (emptyL) continue
      const step = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left).localeCompare(String(right), undefined, { numeric: true })
      if (step) return sort.dir === 'desc' ? -step : step
    }
    return a.position - b.position
  })
}

export function addFilter(db: Row, viewId: string, field: string, type: FieldType | 'title') {
  const view = schemaOf(db).views.find((v) => v.id === viewId)
  const op = OPS[type][0]
  editView(db, viewId, {
    filters: [...(view?.filters ?? []), { id: nanoid(8), field, op, value: '' }],
  })
}

export function editFilter(db: Row, viewId: string, filterId: string, changes: Partial<Filter>) {
  const view = schemaOf(db).views.find((v) => v.id === viewId)
  editView(db, viewId, {
    filters: (view?.filters ?? []).map((f) => (f.id === filterId ? { ...f, ...changes } : f)),
  })
}

export function removeFilter(db: Row, viewId: string, filterId: string) {
  const view = schemaOf(db).views.find((v) => v.id === viewId)
  editView(db, viewId, { filters: (view?.filters ?? []).filter((f) => f.id !== filterId) })
}

// One sort at a time is what a person uses; the list keeps the shape for the day it is more.
export function setSort(db: Row, viewId: string, field: string | null, dir: Sort['dir'] = 'asc') {
  editView(db, viewId, { sorts: field ? [{ field, dir }] : [] })
}
