import { BlockNoteEditor, BlockNoteSchema } from '@blocknote/core'
import { withMultiColumn } from '@blocknote/xl-multi-column'
import { unzipSync } from 'fflate'
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
import { t } from '../i18n'

// A Notion export is a zip of Markdown files for pages and CSV files for databases, with the
// folder tree carrying the nesting. Nothing here is Notion-specific beyond that shape, so a
// hand-made folder of .md and .csv imports exactly as well.
const CAP = 300

// How many rows go in one request.
const BATCH = 250

// `skipped` is what was left out on purpose, `lost` is what was meant to go in and did not. They
// are counted apart because they need different sentences: one is a limit, the other is a fault,
// and a screen that adds them together is the screen that says success over half a file.
export interface Haul { pages: number; databases: number; rows: number; skipped: number; lost: number }

export interface Entry { path: string; text: string }

// Notion hangs a 32-character id off the end of every file and folder name.
const TAG = /\s+[0-9a-f]{32}$/i

const nameOf = (path: string) => {
  const base = (path.split('/').pop() ?? path).replace(/\.(md|csv)$/i, '')
  return base.replace(TAG, '').trim() || 'Untitled'
}

// A file with no folder in front of it is at the top, not in a folder named after itself.
const folderOf = (path: string) => (path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '')

// A byte order mark is invisible until it is the first character of the first column name, and
// then the column is called "\uFEFFName" and nothing matches it.
const clean = (text: string) => text.replace(/^\uFEFF/, '')

// "Save as CSV" in a Turkish Excel writes windows-1254, not UTF-8, and reading those bytes as
// UTF-8 does not fail \u2014 it produces mojibake, quietly, in every name with a Turkish letter in it.
// Strict UTF-8 refuses them instead, and refusal is the signal.
function decode(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(bytes) }
  catch { return new TextDecoder('windows-1254').decode(bytes) }
}

// An .xlsx is a zip of XML, and it is opened here rather than on a server on purpose: the file
// comes from outside, the parsing is the dangerous part, and a browser tab is the one place where
// it cannot reach the service key. Everything below is the price of that — a zip bomb is cheap to
// make and a spreadsheet is a normal thing to be sent.
const ZIP_BYTES = 15 * 1024 * 1024
const OPENED_BYTES = 150 * 1024 * 1024
const ZIP_ENTRIES = 500
const BLOWUP = 100
// Past this a sheet is refused whole. Half a spreadsheet is worse than none: the half that is
// there looks complete, and anything summed over it is wrong.
const SHEET_ROWS = 2000

// Excel counts days from the 30th of December 1899, which is a day earlier than it should be
// because it believes 1900 was a leap year. Nobody has ever fixed it and nobody can.
const EXCEL_EPOCH = Date.UTC(1899, 11, 30)

// The formats Excel ships that mean a date, and any custom one written out of days and months.
const BUILT_IN_DATES = new Set([14, 15, 16, 17, 22, 45, 46, 47])

const parse = (xml: string) => new DOMParser().parseFromString(xml, 'application/xml')

const flatten = (node: Element | null) =>
  node ? [...node.getElementsByTagName('t')].map((t) => t.textContent ?? '').join('') : ''

function stringsIn(xml: string): string[] {
  return [...parse(xml).getElementsByTagName('si')].map(flatten)
}

// A cell says which format it wears by index, and the format says whether it is a date. Without
// this a column of dates arrives as a column of five-digit numbers, which sorts and sums and is
// wrong in every one of those.
function dateStylesIn(xml: string): Set<number> {
  const doc = parse(xml)
  const custom = new Set<number>()
  for (const fmt of [...doc.getElementsByTagName('numFmt')]) {
    const code = fmt.getAttribute('formatCode') ?? ''
    const id = Number(fmt.getAttribute('numFmtId'))
    if (/[dy]/.test(code.replace(/\[[^\]]*\]/g, '').replace(/"[^"]*"/g, ''))) custom.add(id)
  }
  const xfs = doc.getElementsByTagName('cellXfs')[0]
  const out = new Set<number>()
  ;[...(xfs?.getElementsByTagName('xf') ?? [])].forEach((xf, at) => {
    const id = Number(xf.getAttribute('numFmtId') ?? 0)
    if (BUILT_IN_DATES.has(id) || custom.has(id)) out.add(at)
  })
  return out
}

const columnOf = (ref: string) => {
  const letters = /^[A-Z]+/.exec(ref)?.[0] ?? 'A'
  return [...letters].reduce((at, ch) => at * 26 + (ch.charCodeAt(0) - 64), 0) - 1
}

const dayOfSerial = (serial: number) =>
  new Date(EXCEL_EPOCH + Math.round(serial) * 86400000).toISOString().slice(0, 10)

function rowsOfSheet(xml: string, strings: string[], dated: Set<number>): string[][] {
  const rows: string[][] = []
  for (const row of [...parse(xml).getElementsByTagName('row')]) {
    const line: string[] = []
    for (const cell of [...row.getElementsByTagName('c')]) {
      const at = columnOf(cell.getAttribute('r') ?? 'A')
      const kind = cell.getAttribute('t')
      const value = cell.getElementsByTagName('v')[0]?.textContent ?? ''
      let held = value
      if (kind === 's') held = strings[Number(value)] ?? ''
      else if (kind === 'inlineStr') held = flatten(cell.getElementsByTagName('is')[0])
      else if (kind === 'b') held = value === '1' ? 'true' : 'false'
      else if (!kind || kind === 'n') {
        // A formula cell keeps the answer beside the formula. The answer is what we take: our own
        // formula type speaks a different language and Excel's would not survive the trip.
        const style = Number(cell.getAttribute('s') ?? -1)
        if (value && dated.has(style)) held = dayOfSerial(Number(value))
      }
      while (line.length < at) line.push('')
      line[at] = held
    }
    if (line.some((v) => v.trim())) rows.push(line)
  }
  const width = Math.max(0, ...rows.map((r) => r.length))
  return rows.map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
}

// Every sheet becomes its own table, named the way the tab is named.
export function sheetsIn(bytes: Uint8Array): { name: string; rows: string[][] }[] {
  if (bytes.length > ZIP_BYTES) throw new Error(t('That spreadsheet is too large to open here.'))

  const held = unzipSync(bytes)
  const names = Object.keys(held)
  if (names.length > ZIP_ENTRIES) throw new Error(t('That file is not a spreadsheet.'))
  const opened = names.reduce((sum, name) => sum + held[name].length, 0)
  if (opened > OPENED_BYTES || opened > bytes.length * BLOWUP) {
    throw new Error(t('That spreadsheet is too large to open here.'))
  }

  const read = (path: string) => (held[path] ? decode(held[path]) : '')
  const strings = held['xl/sharedStrings.xml'] ? stringsIn(read('xl/sharedStrings.xml')) : []
  const dated = held['xl/styles.xml'] ? dateStylesIn(read('xl/styles.xml')) : new Set<number>()

  // Which file is which tab is written in the relationships, and a relationship may point out of
  // the file entirely. Those are dropped: a spreadsheet has no business fetching anything.
  const rels = new Map<string, string>()
  for (const rel of [...parse(read('xl/_rels/workbook.xml.rels')).getElementsByTagName('Relationship')]) {
    const target = rel.getAttribute('Target') ?? ''
    if (rel.getAttribute('TargetMode') === 'External' || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue
    rels.set(rel.getAttribute('Id') ?? '', `xl/${target.replace(/^\/?xl\//, '')}`)
  }

  const out: { name: string; rows: string[][] }[] = []
  for (const sheet of [...parse(read('xl/workbook.xml')).getElementsByTagName('sheet')]) {
    const id = sheet.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
      ?? sheet.getAttribute('r:id') ?? ''
    const path = rels.get(id)
    if (!path || !held[path]) continue
    const rows = rowsOfSheet(read(path), strings, dated)
    if (!rows.length) continue
    if (rows.length > SHEET_ROWS) {
      throw new Error(t('“{sheet}” holds more than {n} rows. Nothing was imported.',
        { sheet: sheet.getAttribute('name') ?? 'Sheet', n: SHEET_ROWS }))
    }
    out.push({ name: sheet.getAttribute('name') || 'Sheet', rows })
  }
  return out
}

// A large Notion export arrives as a zip of zips — Part-1.zip, Part-2.zip — so unpacking has to
// be willing to go round again. Twice is enough: Notion does not nest further, and a zip that
// contains itself should stop rather than spin.
function unpack(bytes: Uint8Array, depth = 0): Entry[] {
  const out: Entry[] = []
  for (const [path, held] of Object.entries(unzipSync(bytes))) {
    if (!held.length) continue
    if (/\.zip$/i.test(path) && depth < 2) out.push(...unpack(held, depth + 1))
    else if (/\.(md|csv)$/i.test(path)) out.push({ path, text: clean(decode(held)) })
  }
  return out
}

export async function expand(files: File[]): Promise<Entry[]> {
  const out: Entry[] = []
  for (const file of files) {
    if (/\.zip$/i.test(file.name)) out.push(...unpack(new Uint8Array(await file.arrayBuffer())))
    // A sheet is a table with a name on a tab, which is a CSV with a name on a file. Turning it
    // into one means the reading below — where the headings are, which mark is the decimal point,
    // what a column holds — happens once, for both kinds of file.
    else if (/\.xlsx$/i.test(file.name)) {
      const sheets = sheetsIn(new Uint8Array(await file.arrayBuffer()))
      const book = file.name.replace(/\.xlsx$/i, '')
      for (const sheet of sheets) {
        out.push({
          path: `${sheets.length === 1 ? book : sheet.name}.csv`,
          text: Papa.unparse(sheet.rows),
        })
      }
    }
    else out.push({ path: file.name, text: clean(decode(new Uint8Array(await file.arrayBuffer()))) })
  }
  // The `_all` copy is the same database written twice, once per view.
  return out
    .filter((e) => /\.(md|csv)$/i.test(e.path) && !/_all\.csv$/i.test(e.path))
    .sort((a, b) => a.path.split('/').length - b.path.split('/').length || a.path.localeCompare(b.path))
}

const MONTH_DAY_YEAR = /^[A-Za-z]{3,} \d{1,2}, \d{4}$/
const DAY_MONTH_YEAR = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/

// `1.234` is a thousand and a bit in one country and one and a bit in another, and the cell does
// not say which. The column does: three digits after a dot, more than once or beside a comma, is
// a grouping mark and nothing else. A leading zero rules grouping out, so `0.500` stays a half.
//
// Deciding per column rather than per cell is the whole point. Read one cell at a time, `1.234`
// silently becomes 1.234 and the sum over it is wrong by a factor of a thousand while looking
// perfectly reasonable, which is the worst kind of wrong a spreadsheet can be.
const GROUPED_BY_DOT = /^-?[1-9]\d{0,2}(\.\d{3})+(,\d+)?$/
const GROUPED_BY_COMMA = /^-?[1-9]\d{0,2}(,\d{3})+(\.\d+)?$/
const DECIMAL_COMMA = /^-?\d+,\d+$/
const DECIMAL_DOT = /^-?\d+(\.\d+)?$/

export interface Numbers { decimal: ',' | '.' }

export function numbersIn(values: string[]): Numbers | null {
  const held = values.map((v) => v.trim()).filter(Boolean)
  if (!held.length) return null
  const number = (v: string) =>
    GROUPED_BY_DOT.test(v) || GROUPED_BY_COMMA.test(v) || DECIMAL_COMMA.test(v) || DECIMAL_DOT.test(v)
  if (!held.every(number)) return null
  const turkish = held.some((v) => GROUPED_BY_DOT.test(v) || DECIMAL_COMMA.test(v))
  return { decimal: turkish ? ',' : '.' }
}

export function asNumber(raw: string, style: Numbers): number {
  const held = raw.trim()
  // Every separator that is not the decimal one is a grouping mark, and all of them go. The
  // old reading swapped the first comma alone, so `1,234,56` came back as 1.234 and the rest
  // of the number was dropped without a word.
  return Number(style.decimal === ','
    ? held.replace(/\./g, '').replace(',', '.')
    : held.replace(/,/g, ''))
}

// Guessed from the whole column rather than the first cell, because one number in a column of
// names is a name. Anything unclear stays text, which loses nothing: text is what it already is.
export function guessType(values: string[]): FieldType {
  const held = values.map((v) => v.trim()).filter(Boolean)
  if (!held.length) return 'text'
  if (numbersIn(held)) return 'number'
  if (held.every((v) => /^\d{4}-\d{2}-\d{2}/.test(v) || MONTH_DAY_YEAR.test(v) || DAY_MONTH_YEAR.test(v))) return 'date'
  if (held.every((v) => /^(yes|no|true|false|evet|hayır)$/i.test(v))) return 'checkbox'
  const distinct = new Set(held)
  if (distinct.size <= 12 && distinct.size * 2 <= held.length) return 'select'
  return 'text'
}

export function asDay(value: string): string {
  const held = value.trim()
  if (/^\d{4}-\d{2}-\d{2}/.test(held)) return held.slice(0, 10)
  // `03.08.2026` is the third of August everywhere it is written with dots, and Date.parse reads
  // it as nothing at all.
  const parts = DAY_MONTH_YEAR.exec(held)
  if (parts) return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`
  const at = Date.parse(`${held} 00:00:00Z`)
  return Number.isFinite(at) ? new Date(at).toISOString().slice(0, 10) : ''
}

const isOn = (value: string) => /^(yes|true|evet)$/i.test(value.trim())

// A spreadsheet kept by hand rarely starts with its headings. It starts with what the file is —
// "2026 Müşteri Listesi" in A1, a blank line, then the headings. Taking row one on faith makes a
// one-column database named after that sentence, with the real headings sitting in it as data,
// and nothing about it looks like an error.
//
// The heading row is the first one carrying more than a single value that is also as wide as the
// row beneath it. Nobody is asked: a person who does not know what a column type is cannot answer
// a question about one, and the answer is visible in the file.
export function headerAt(rows: string[][]): number {
  const filled = (row: string[]) => row.filter((cell) => (cell ?? '').trim()).length
  for (let at = 0; at < rows.length - 1; at += 1) {
    if (filled(rows[at]) < 2) continue
    if (rows[at].length === rows[at + 1].length) return at
  }
  return 0
}

// The first column of a Notion CSV is the page title, so it becomes the row's name rather than
// a column of its own — the same place it lives in a database made here.
function schemaFrom(header: string[], lines: string[][]): { schema: Schema; numbers: (Numbers | null)[] } {
  // Two columns of the same name is a table nobody can read, and Notion allows it.
  const seenNames = new Map<string, number>()
  const numbers: (Numbers | null)[] = []
  const fields: Field[] = header.slice(1).map((name, i) => {
    const values = lines.map((line) => line[i + 1] ?? '')
    const type = guessType(values)
    numbers.push(type === 'number' ? numbersIn(values) : null)
    const wanted = name.trim() || 'Field'
    const taken = seenNames.get(wanted) ?? 0
    seenNames.set(wanted, taken + 1)
    const field: Field = { id: nanoid(8), name: taken ? `${wanted} ${taken + 1}` : wanted, type }
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
  return { schema: { fields, views: [{ id: nanoid(8), name: 'Table', kind: 'table' }] }, numbers }
}

function cellsFrom(fields: Field[], line: string[], numbers: (Numbers | null)[]): { [id: string]: unknown } {
  const out: { [id: string]: unknown } = {}
  fields.forEach((field, i) => {
    const raw = (line[i + 1] ?? '').trim()
    if (!raw) return
    if (field.type === 'number') out[field.id] = asNumber(raw, numbers[i] ?? { decimal: '.' })
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
export function bodyOf(markdown: string): { update: Uint8Array; text: string } | null {
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
  const haul: Haul = { pages: 0, databases: 0, rows: 0, skipped: 0, lost: 0 }
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
    let numbers: (Numbers | null)[] = []
    let lines: string[][] = []
    if (csv) {
      const parsed = Papa.parse<string[]>(entry.text.trim(), { skipEmptyLines: true })
      const top = headerAt(parsed.data)
      const header = parsed.data[top]
      if (!header?.length) continue
      lines = parsed.data.slice(top + 1)
      const read = schemaFrom(header, lines)
      schema = read.schema
      numbers = read.numbers
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
    if (error || !data) {
      haul.lost += 1
      console.warn('Import could not write', entry.path, error?.message)
      continue
    }

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
        data: cellsFrom(schema.fields, line, numbers),
      }))
      // Sent in handfuls: a database of a few thousand rows is one request the server refuses
      // and a person who is told nothing went in.
      for (let at = 0; at < rows.length; at += BATCH) {
        const { error: failed } = await supabase.from('records').insert(rows.slice(at, at + BATCH))
        const many = Math.min(BATCH, rows.length - at)
        if (failed) {
          haul.lost += many
          console.warn('Import could not write rows of', entry.path, failed.message)
        } else haul.rows += many
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
