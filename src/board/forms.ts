import { nanoid } from 'nanoid'
import { TITLE } from './database'
import type { Field } from './database'
import { getUser, supabase } from './supabase'
import { getWorkspace } from './workspace'

// A form is a database with one side turned outwards. It collects nothing of its own: an answer
// is a row in the database it points at, so it turns up in the table, the board and the calendar
// the moment it arrives.
export interface Form {
  id: string
  database_id: string
  slug: string
  title: string
  intro: string
  asks: string[]
  thanks: string
  active: boolean
}

const COLUMNS = 'id, database_id, slug, title, intro, asks, thanks, active'

// What a form can ask for. A formula cannot be answered, a relation needs a picker nobody
// outside the workspace can use, and a stamp is written by the database.
const ASKABLE = ['text', 'number', 'select', 'date', 'checkbox', 'url', 'email', 'phone']

export const askable = (fields: Field[]) => fields.filter((f) => ASKABLE.includes(f.type))

const slugFor = (title: string) =>
  `${title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'form'}-${nanoid(6)}`

export const formUrl = (form: Form) => `${location.origin}/f/${form.slug}`

export async function formFor(database: string): Promise<Form | null> {
  if (!supabase || !getUser()) return null
  const { data } = await supabase
    .from('forms').select(COLUMNS).eq('database_id', database).maybeSingle()
  return (data as Form) ?? null
}

// The title is always asked for: a row with no name is a row nobody can find again.
export async function makeForm(database: string, title: string): Promise<Form | null> {
  const ws = getWorkspace()
  if (!supabase || !ws) return null
  const { data } = await supabase.from('forms').insert({
    workspace_id: ws.id,
    database_id: database,
    slug: slugFor(title),
    title,
    asks: [TITLE],
  }).select(COLUMNS).single()
  return (data as Form) ?? null
}

export async function setForm(id: string, changes: Partial<Form>) {
  if (!supabase) return
  await supabase.from('forms').update(changes).eq('id', id)
}

export async function removeForm(id: string) {
  if (!supabase) return
  await supabase.from('forms').delete().eq('id', id)
}

// Read without an account, because that is the whole point of it.
export async function readForm(slug: string): Promise<{ form: Form; fields: Field[] } | null> {
  if (!supabase) return null
  // Public visitors get one addressed form and its questions, never a table they can enumerate.
  const { data, error } = await supabase.rpc('public_form', { form_slug: slug })
  if (error || !data || typeof data !== 'object' || Array.isArray(data)) return null
  const result = data as { form?: Form; fields?: Field[] }
  if (!result.form || !Array.isArray(result.fields)) return null
  return { form: result.form, fields: result.fields }
}

export async function sendForm(
  slug: string,
  answers: { [key: string]: string },
  trap: string,
): Promise<boolean> {
  if (!supabase) return false
  const { data, error } = await supabase.rpc('submit_form', {
    form_slug: slug,
    answers,
    trap,
  })
  return !error && !!data
}
