import { nanoid } from 'nanoid'
import { TONES } from './database'
import type { Field, FieldType, Schema } from './database'
import { createRecord, flushRecords, loadPages, patchRecord } from './records'
import type { Record as Row } from './records'

// A trade's worth of databases, made in one go. Nothing here is a feature: a kit is a few rows
// in the same tables anybody's own databases live in, which is exactly why it is worth having —
// a CRM that is a separate product is a second thing to maintain, and this is not one.
//
// The plan for this product names the trades it is for: agency, software team, lawyer,
// consultant, freelancer. These are the shapes those people would otherwise build by hand on
// their first afternoon.

interface Ask {
  name: string
  type: FieldType
  choices?: string[]
  // Which database in the same kit this points at, by its name.
  to?: string
}

interface Table { name: string; icon: string; asks: Ask[] }

export interface Kit { id: string; name: string; blurb: string; tables: Table[] }

export const KITS: Kit[] = [
  {
    id: 'crm',
    name: 'Sales',
    blurb: 'People, companies, deals and the conversations between them.',
    tables: [
      {
        name: 'People',
        icon: '👤',
        asks: [
          { name: 'Email', type: 'email' },
          { name: 'Phone', type: 'phone' },
          { name: 'Role', type: 'text' },
          { name: 'Company', type: 'relation', to: 'Companies' },
          { name: 'Owner', type: 'person' },
        ],
      },
      {
        name: 'Companies',
        icon: '🏢',
        asks: [
          { name: 'Website', type: 'url' },
          { name: 'Sector', type: 'select', choices: ['Software', 'Retail', 'Industry', 'Services', 'Public'] },
          { name: 'Owner', type: 'person' },
          { name: 'Since', type: 'date' },
        ],
      },
      {
        name: 'Deals',
        icon: '💰',
        asks: [
          { name: 'Stage', type: 'status' },
          { name: 'Value', type: 'number' },
          { name: 'Company', type: 'relation', to: 'Companies' },
          { name: 'Contact', type: 'relation', to: 'People' },
          { name: 'Closes', type: 'date' },
          { name: 'Owner', type: 'person' },
        ],
      },
      {
        name: 'Conversations',
        icon: '💬',
        asks: [
          { name: 'On', type: 'date' },
          { name: 'With', type: 'relation', to: 'People' },
          { name: 'About', type: 'relation', to: 'Deals' },
          { name: 'Kind', type: 'select', choices: ['Call', 'Meeting', 'Email', 'Note'] },
        ],
      },
    ],
  },
  {
    id: 'agency',
    name: 'Client work',
    blurb: 'Clients, the jobs you owe them and what each one is worth.',
    tables: [
      {
        name: 'Clients',
        icon: '🤝',
        asks: [
          { name: 'Contact', type: 'email' },
          { name: 'Phone', type: 'phone' },
          { name: 'Since', type: 'date' },
          { name: 'Lead', type: 'person' },
        ],
      },
      {
        name: 'Jobs',
        icon: '📦',
        asks: [
          { name: 'Client', type: 'relation', to: 'Clients' },
          { name: 'Stage', type: 'status' },
          { name: 'Fee', type: 'number' },
          { name: 'Starts', type: 'date' },
          { name: 'Due', type: 'date' },
          { name: 'Lead', type: 'person' },
          { name: 'Brief', type: 'files' },
        ],
      },
      {
        name: 'Deliverables',
        icon: '📤',
        asks: [
          { name: 'Job', type: 'relation', to: 'Jobs' },
          { name: 'Due', type: 'date' },
          { name: 'Sent', type: 'checkbox' },
          { name: 'Files', type: 'files' },
        ],
      },
    ],
  },
  {
    id: 'hiring',
    name: 'Hiring',
    blurb: 'Roles you are filling and the people going through them.',
    tables: [
      {
        name: 'Roles',
        icon: '🪧',
        asks: [
          { name: 'Team', type: 'select', choices: ['Engineering', 'Design', 'Sales', 'Support', 'Operations'] },
          { name: 'Open since', type: 'date' },
          { name: 'Hiring manager', type: 'person' },
        ],
      },
      {
        name: 'Candidates',
        icon: '🧑‍💼',
        asks: [
          { name: 'Role', type: 'relation', to: 'Roles' },
          { name: 'Stage', type: 'status' },
          { name: 'Email', type: 'email' },
          { name: 'Phone', type: 'phone' },
          { name: 'CV', type: 'files' },
          { name: 'Applied', type: 'date' },
        ],
      },
    ],
  },
  {
    // What people build by hand in Obsidian, as four tables instead of four folders. The
    // difference that matters is not the shape: it is that an agent can search this and read a
    // page out of it, which a folder of files on somebody's laptop cannot do from anywhere else.
    id: 'brain',
    name: 'Second brain',
    blurb: 'Decisions, incidents, what a term means, and where you read it.',
    tables: [
      {
        name: 'Decisions',
        icon: '⚖️',
        asks: [
          { name: 'Decided', type: 'date' },
          { name: 'Decided by', type: 'person' },
          { name: 'Standing', type: 'select', choices: ['Holds', 'Superseded', 'Reversed'] },
          { name: 'Instead of', type: 'text' },
          { name: 'Because', type: 'text' },
          { name: 'Sources', type: 'relation', to: 'Sources' },
        ],
      },
      {
        name: 'Incidents',
        icon: '🔥',
        asks: [
          { name: 'Happened', type: 'date' },
          { name: 'Severity', type: 'select', choices: ['Noticed', 'Degraded', 'Down'] },
          { name: 'Symptom', type: 'text' },
          { name: 'Root cause', type: 'text' },
          { name: 'Decisions', type: 'relation', to: 'Decisions' },
        ],
      },
      {
        name: 'Terms',
        icon: '📖',
        asks: [
          { name: 'Means', type: 'text' },
          { name: 'Not to be confused with', type: 'text' },
          { name: 'Sources', type: 'relation', to: 'Sources' },
        ],
      },
      {
        name: 'Sources',
        icon: '🔗',
        asks: [
          { name: 'Where', type: 'url' },
          { name: 'Kind', type: 'select', choices: ['Paper', 'Post', 'Talk', 'Book', 'Thread', 'Person'] },
          { name: 'Read', type: 'date' },
          { name: 'Worth it', type: 'checkbox' },
        ],
      },
    ],
  },
]

const STAGES: { id: string; name: string; tone: string; stage: 'todo' | 'doing' | 'done' }[] = [
  { id: nanoid(8), name: 'todo', tone: '#D6D1C6', stage: 'todo' },
  { id: nanoid(8), name: 'doing', tone: '#E8C55A', stage: 'doing' },
  { id: nanoid(8), name: 'done', tone: '#8FA96B', stage: 'done' },
]

function fieldFor(ask: Ask): Field {
  const field: Field = { id: nanoid(8), name: ask.name, type: ask.type }
  if (ask.type === 'select') {
    field.choices = (ask.choices ?? []).map((name, at) => ({
      id: nanoid(8), name, tone: TONES[at % TONES.length],
    }))
  }
  if (ask.type === 'status') {
    field.choices = STAGES.map((s) => ({ ...s, id: nanoid(8) }))
  }
  return field
}

// Made in two passes, because a relation needs the id of a database that does not exist until
// the first pass has run. The second pass is what turns a pile of tables into a shape.
export async function useKit(kit: Kit, parent: string | null): Promise<string | null> {
  const made = new Map<string, string>()
  const schemas = new Map<string, Schema>()

  for (const table of kit.tables) {
    const id = await createRecord(table.name, 'database', parent)
    if (!id) continue
    made.set(table.name, id)
    schemas.set(table.name, {
      fields: table.asks.map(fieldFor),
      views: [{ id: nanoid(8), name: 'Table', kind: 'table' }],
    })
    patchRecord(id, { icon: table.icon })
  }

  for (const table of kit.tables) {
    const id = made.get(table.name)
    const schema = schemas.get(table.name)
    if (!id || !schema) continue

    table.asks.forEach((ask, at) => {
      if (ask.type === 'relation' && ask.to) schema.fields[at].db = made.get(ask.to)
    })
    patchRecord(id, { data: schema } as unknown as Partial<Row>)
  }

  // Sent before asking for them back, or the reload returns rows the patches have not reached
  // yet and quietly replaces the schemas that were just written.
  await flushRecords()
  await loadPages()
  return made.get(kit.tables[0].name) ?? null
}
