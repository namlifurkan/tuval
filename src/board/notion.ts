import { BlockNoteEditor, BlockNoteSchema } from '@blocknote/core'
import { withMultiColumn } from '@blocknote/xl-multi-column'
import { strFromU8, unzipSync } from 'fflate'
import { nanoid } from 'nanoid'
import Papa from 'papaparse'
import { prosemirrorToYXmlFragment } from 'y-prosemirror'
import * as Y from 'yjs'
import { TONES } from './database'
import type { Choice, Field, FieldType, Schema } from './database'
import { FRAGMENT, hex, textOf } from './page'
import { loadPages } from './records'
import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// A Notion export is a zip of Markdown files for pages and CSV files for databases, with the
// folder tree carrying the nesting. Nothing here is Notion-specific beyond that shape, so a
// hand-made folder of .md and .csv imports exactly as well.
const CAP = 300

export interface Haul { pages: number; databases: number; rows: number; skipped: number }

export interface Entry { path: string; text: string }

// Notion hangs a 32-character id off the end of every file and folder name.
const TAG = /\s+[0-9a-f]{32}$/i

const nameOf = (path: string) => {
  const base = (path.split('/').pop() ?? path).replace(/\.(md|csv)$/i, '')
  return base.replace(TAG, '').trim() || 'Untitled'
}

// A file with no folder in front of it is at the top, not in a folder named after itself.
const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

export async function expand(files: File[]): Promise<Entry[]> {
  const out: Entry[] = []
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) {
      const held = unzipSync(new Uint8Array(await file.arrayBuffer()))
      for (const [path, bytes] of Object.entries(held)) {
        if (bytes.length) out.push({ path, text: strFromU8(bytes) })
      }
    } else {
      out.push({ path: file.name, text: await file.text() })
    }
  }
  // The `_all` copy is the same database written twice, once per view.
  return out
    .filter((e) => /\.(md|csv)$/i.test(e.path) && !/_all\.csv$/i.test(e.path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))
}

const MONTH_DAY_YEAR = /^[A-Za-z]{3,} \d{1,2}, \d{4}$/

// Guessed from the whole column rather than the first cell, because one number in a column of
// names is a name. Anything unclear stays text, which loses nothing: text is what it already is.
export function guessType(values: string[]): FieldType {
  const held = values.map((v) => v.trim()).filter(Boolean)
  if (!held.length) return 'text'
  if (held.every((v) => /^-?\d+([.,]\d+)?$/.test(v))) return 'number'
  if (held.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v) || MONTH_DAY_YEAR.test(v))) return 'date'
  if (held.every((v) => /^(yes|no|true|false|evet|hayır)$/i.test(v))) return 'checkbox'
  const distinct = new Set(held)
  if (distinct.size <= 12 && distinct.size * 2 <= held.length) return 'select'
  return 'text'
}

export function asDay(value: string): string {
  const held = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(held)) return held.slice(0, 10)
  const at = Date.parse(`${held} 00:00:00Z`)
  return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : ''
}

const isOn = (value: string) => /^(yes|true|evet)$/i.test(value.trim())

// The first column of a Notion CSV is the page title, so it becomes the row's name rather than
// a column of its own — the same place it lives in a database made here.
function schemaFrom(header: string[], lines: string[][]): Schema {
  const fields: Field[] = header.slice(1).map((name, i) => {
    const values = lines.map((line) => line[i + 1] ?? '')
    const type = guessType(values)
    const field: Field = { id: nanoid(8), name: name.trim() || 'Field', type }
    if (type === 'select') {
      const seen = [...new Set(values.map((v) => v.trim()).filter(Boolean))]
      field.choices = seen.map((label, at): Choice => ({
        id: nanoid(8),
        name: label,
        tone: TONES[at % TONES.length],
      }))
    }
    return field
  })
  return { fields, views: [{ id: nanoid(8), name: 'Table', kind: 'table' }] }
}

function cellsFrom(fields: Field[], line: string[]): { [id: string]: unknown } {
  const out: { [id: string]: unknown } = {}
  fields.forEach((field, i) => {
    const raw = (line[i + 1] ?? '').trim()
    if (!raw) return
    if (field.type === 'number') out[field.id] = Number(raw.replace(',', '.'))
    else if (field.type === 'date') out[field.id] = asDay(raw)
    else if (field.type === 'checkbox') out[field.id] = isOn(raw)
    else if (field.type === 'select') out[field.id] = field.choices?.find((c) => c.name === raw)?.id
    else out[field.id] = raw
    if (out[field.id] === undefined || out[field.id] === '') delete out[field.id]
  })
  return out
}

// Markdown into the shared type the editor reads, without an editor being on screen. The
// document is built in a detached BlockNote and handed to Yjs as a whole.
function bodyOf(markdown: string): { update: Uint8Array; text: string } | null {
  const editor = BlockNoteEditor.create({ schema: withMultiColumn(BlockNoteSchema.create()) })
  const blocks = editor.tryParseMarkdownToBlocks(markdown)
  if (!blocks.length) return null
  editor.replaceBlocks(editor.document, blocks)

  const doc = new Y.Doc()
  prosemirrorToYXmlFragment(editor.prosemirrorState.doc, doc.getXmlFragment(FRAGMENT))
  const update = Y.encodeStateAsUpdate(doc)
  const text = textOf(doc)
  doc.destroy()
  return { update, text }
}

// A Notion page repeats its own title as the first heading. Kept out of the body so the page
// does not open with its name written twice.
function withoutTitle(markdown: string, title: string): string {
  const lines = markdown.split('\n')
  const at = lines.findIndex((line) => line.trim())
  if (at >= 0 && lines[at].trim().replace(/^#\s*/, '') === title) lines.splice(0, at + 1)
  return lines.join('\n').trim()
}

export async function importNotion(files: File[], parent: string | null): Promise<Haul> {
  const ws = getWorkspace()
  const haul: Haul = { pages: 0, databases: 0, rows: 0, skipped: 0 }
  if (!supabase || !ws) return haul

  const all = await expand(files)
  const entries = all.slice(0, CAP)
  haul.skipped = all.length - entries.length

  const made = new Map<string, string>()
  const at = () => new Date().toISOString()
  const under = (path: string) => made.get(folderOf(path)) ?? parent

  for (const entry of entries) {
    const title = nameOf(entry.path)
    const csv = /\.csv$/i.test(entry.path)

    let schema: Schema | null = null
    let lines: string[][] = []
    if (csv) {
      const parsed = Papa.parse<string[]>(entry.text.trim(), { skipEmptyLines: true })
      const [header, ...rest] = parsed.data
      if (!header?.length) continue
      lines = rest
      schema = schemaFrom(header, lines)
    }

    const { data, error } = await supabase.from('records').insert({
      workspace_id: ws.id,
      kind: csv ? 'database' : 'doc',
      title,
      parent_id: under(entry.path),
      position: haul.pages + haul.databases,
      created_by: getUser()?.id ?? null,
      ...(schema ? { data: schema } : {}),
    }).select('id').single()
    if (error || !data) continue

    const id = (data as { id: string }).id
    made.set(entry.path.replace(/\.(md|csv)$/i, ''), id)

    if (csv && schema) {
      const rows = lines.map((line, i) => ({
        workspace_id: ws.id,
        kind: 'doc',
        title: (line[0] ?? '').trim(),
        parent_id: id,
        position: i,
        created_by: getUser()?.id ?? null,
        data: cellsFrom(schema.fields, line),
      }))
      if (rows.length) {
        const { error: failed } = await supabase.from('records').insert(rows)
        if (!failed) haul.rows += rows.length
      }
      haul.databases += 1
      continue
    }

    const body = bodyOf(withoutTitle(entry.text, title))
    if (body) {
      await Promise.all([
        supabase.from('record_docs').insert({ record_id: id, doc: hex(body.update) }),
        supabase.from('records').update({ body: body.text, updated_at: at() }).eq('id', id),
      ])
    }
    haul.pages += 1
  }

  await loadPages()
  return haul
}
