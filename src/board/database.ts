import { nanoid } from 'nanoid'
import { getRecords, patchRecord } from './records'
import type { Record as Row } from './records'

export type FieldType = 'text' | 'number' | 'select' | 'date' | 'checkbox' | 'person' | 'url'

export const FIELD_TYPES: FieldType[] = ['text', 'number', 'select', 'date', 'checkbox', 'person', 'url']

export interface Choice { id: string; name: string; tone: string }
export interface Field { id: string; name: string; type: FieldType; choices?: Choice[] }
export interface View { id: string; name: string; kind: 'table' | 'board'; groupBy?: string }

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

export function addView(db: Row, kind: View['kind'], name: string) {
  const held = schemaOf(db)
  const groupBy = kind === 'board'
    ? held.fields.find((f) => f.type === 'select')?.id
    : undefined
  writeSchema(db.id, { ...held, views: [...held.views, { id: nanoid(8), name, kind, groupBy }] })
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
