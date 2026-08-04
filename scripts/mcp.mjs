#!/usr/bin/env node
// Tuval as something an agent can work in --------------------------------------------------------
// The other half of handing a board to an agent. That direction turns a canvas into a brief; this
// one lets the agent go and look — search the workspace, read a page as markdown, list what is
// open — and, on a key made to write, file what it found back.
//
// Obsidian works as a second brain for agents because the notes are files and the agent can open
// them. Ours are rows in a database, so this is the door. It speaks MCP over stdin and stdout,
// which is what Claude Code and Cursor mount.
//
// One thing the writes cannot do, and it is not an oversight: a page's text is a CRDT that only a
// browser edits. Prose written here waits on the record and the app folds it onto the end of the
// page the next time somebody opens it. `append_to_page` says so to the model in as many words.
//
// Written by hand rather than with the SDK: the protocol used here is four methods and a JSON
// envelope, and a dependency for that is a dependency to keep up to date for no reason.
//
//   claude mcp add tuval -- node /path/to/tuval/scripts/mcp.mjs
//   TUVAL_API_KEY=tuv_...  (from Settings → API and webhooks)
//   TUVAL_API_URL=https://<project>.supabase.co/functions/v1/api   (optional)

import { createInterface } from 'node:readline'
import { existsSync, readFileSync } from 'node:fs'

const fromFile = (name) => {
  if (!existsSync('.env.local')) return ''
  const line = readFileSync('.env.local', 'utf8')
    .split('\n').find((l) => l.trimStart().startsWith(`${name}=`))
  return line ? line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '') : ''
}

const read = (name) => process.env[name] || fromFile(name)

// One run is one of these processes, which is one agent session. Everything written while it
// lives carries the same name, so the person reviewing in the morning reads a run rather than
// forty unrelated changes. TUVAL_RUN overrides it, for a caller that knows better — a CI job
// naming the build, say.
const RUN = (read('TUVAL_RUN') || `run-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}-${Math.random().toString(36).slice(2, 8)}`)
  .replace(/[^A-Za-z0-9._-]/g, '').slice(0, 64)

const KEY = read('TUVAL_API_KEY')
const BASE = read('TUVAL_API_URL')
  || `${read('VITE_SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/api`

// Why a call failed, in words the model can act on rather than a number it has to guess at.
// The two that matter are the two it can do something about: a read-only key is a different
// problem from a key that has written all it may today, and only one of them is worth retrying.
const REASONS = {
  401: 'the key is not valid, or this workspace is on the free plan, where the API is off',
  403: 'this key may only read. Make one with write access in Settings → API and webhooks',
  404: 'no such record, or this key cannot see it',
  429: 'this key has spent its writes for the day. It can still read, and it can write again '
    + 'tomorrow. Raise the allowance on the key if a thousand a day is not enough',
}

async function ask(path, { markdown = false, method = 'GET', body } = {}) {
  const answer = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${KEY}`,
      'x-tuval-run': RUN,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
  const text = await answer.text()
  if (!answer.ok) {
    const why = REASONS[answer.status]
    throw new Error(`${answer.status}${why ? ` — ${why}` : ''}. ${text.slice(0, 300)}`)
  }
  return markdown ? text : JSON.parse(text)
}

// What a caller may set on a record. The page's own text is not among them and cannot be: it
// lives in a CRDT the server does not read. Prose goes through `text`, below.
const FIELDS = {
  title: { type: 'string' },
  status: {
    type: 'string',
    description: 'backlog, todo, doing, review, blocked, done or cancelled',
  },
  assignee: { type: 'string', description: 'A person id' },
  priority: { type: 'number', description: '0 none, 1 low, 2 medium, 3 high' },
  due_at: { type: 'string', description: 'An ISO date' },
  estimate: { type: 'number' },
  parent_id: { type: 'string', description: 'The page or issue this sits under' },
  project_id: { type: 'string' },
  cycle_id: { type: 'string' },
  data: {
    type: 'object',
    description: 'Whatever this record needs that has no column of its own, as keys and values '
      + '— an area, a seat, a source. Sending it replaces what is there rather than merging, so '
      + 'read the record first if you mean to keep the keys already on it.',
  },
}

const asObject = (value) => {
  let held = value
  if (typeof held === 'string') {
    try { held = JSON.parse(held) } catch { held = null }
  }
  if (!held || typeof held !== 'object' || Array.isArray(held)) {
    throw new Error('data must be an object of keys and values, like {"area": "agents"}.')
  }
  return held
}

const changes = (args) => {
  const out = {}
  for (const key of Object.keys(FIELDS)) if (args[key] !== undefined) out[key] = args[key]
  if (out.data !== undefined) out.data = asObject(out.data)
  return out
}

const TOOLS = [
  {
    name: 'search',
    description:
      'Search everything in the Tuval workspace — pages, databases, issues, projects — by words '
      + 'in their titles and bodies. Returns an excerpt and the address to read each one in full.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Two or more characters to look for' },
        limit: { type: 'number', description: 'How many results, up to 100. Default 20.' },
      },
      required: ['query'],
    },
    run: ({ query, limit }) =>
      ask(`/search?q=${encodeURIComponent(query)}${limit ? `&limit=${limit}` : ''}`),
  },
  {
    name: 'read_page',
    description:
      'Read one page or issue in full, as markdown, with its headings and lists intact. '
      + 'Take the id from a search result or from a list.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The record id' } },
      required: ['id'],
    },
    run: ({ id }) => ask(`/records/${encodeURIComponent(id)}/markdown`, { markdown: true }),
  },
  {
    name: 'read_board',
    description:
      'Read what is drawn on a board, as markdown: frames become sections, the items in them '
      + 'become a list in reading order, connectors between them become a flow, and comments are '
      + 'attached to what they were left on.\n\n'
      + 'This is a copy, written by the browser each time somebody saves. A board changed by '
      + 'somebody who has not saved since, or one nobody has opened since this door was built, '
      + 'reads as it last did or says it has no reading yet. The response header X-Tuval-Read-At '
      + 'is when the copy was written; say so if the answer depends on it.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The board id, the part after /b/' } },
      required: ['id'],
    },
    run: ({ id }) => ask(`/boards/${encodeURIComponent(id)}/markdown`, { markdown: true }),
  },
  {
    name: 'list_boards',
    description:
      'The boards in this workspace, newest first, with how many items and frames each holds and '
      + 'the address to read it in full.',
    inputSchema: { type: 'object', properties: {} },
    run: () => ask('/boards'),
  },
  {
    name: 'list_records',
    description:
      'List records of one kind: issue, doc, database, project, person, company, event or file. '
      + 'Filter by status, assignee, project or cycle. Archived rows are left out.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: { type: 'string', description: 'issue, doc, database, project, …' },
        status: { type: 'string' },
        project: { type: 'string', description: 'A project id' },
        limit: { type: 'number' },
      },
    },
    run: (args) => {
      const query = new URLSearchParams()
      for (const [key, value] of Object.entries(args ?? {})) {
        if (value !== undefined && value !== null && value !== '') query.set(key, String(value))
      }
      return ask(`/records?${query}`)
    },
  },
  {
    name: 'workspace',
    description:
      'What this key can reach, and the addresses inside it. Says whether the key may write, how '
      + 'many writes it has left today, and the name this session stamps on everything it writes '
      + 'so a person can review the whole run at once.',
    inputSchema: { type: 'object', properties: {} },
    run: async () => ({ ...await ask(''), run: RUN }),
  },
  {
    name: 'create_record',
    description:
      'File a new record: an issue, a page, a project, a person, a company, an event. '
      + 'Needs a key with write access. Text given here becomes the body of the page — see '
      + 'append_to_page for where it waits until somebody opens it. Anything the workspace keeps '
      + 'no column for goes in data, rather than into the first line of the text.',
    inputSchema: {
      type: 'object',
      properties: {
        kind: {
          type: 'string',
          description: 'issue, doc, database, project, person, company, event or file. '
            + 'Defaults to issue.',
        },
        text: { type: 'string', description: 'Markdown for the body of the new record' },
        ...FIELDS,
      },
      required: ['title'],
    },
    run: async (args) => {
      const made = await ask('/records', {
        method: 'POST',
        body: {
          kind: args.kind || 'issue',
          ...changes(args),
          ...(args.text ? { description: args.text } : {}),
        },
      })
      // Filed, but not handed to anybody. An issue with no command that proves it finished is a
      // description of a wish, and the seat that reviews agent work is one person.
      if ((args.kind || 'issue') === 'issue' && !made?.data?.check) {
        return { ...made, waiting: 'No check on this issue yet, so it will not be dispatched. Add data { "check": "…" } when you know what proves it done.' }
      }
      return made
    },
  },
  {
    name: 'update_record',
    description:
      'Change a record: its title, status, assignee, priority, due date, parent, project, '
      + 'cycle, or the data kept beside it. Only what you send is changed, though data is '
      + 'replaced whole rather than merged. Needs a key with write access. This does not '
      + 'touch the text of the page — append_to_page does that.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'The record id' }, ...FIELDS },
      required: ['id'],
    },
    run: async ({ id, ...rest }) => {
      const body = changes(rest)
      // Refused here rather than sent: an empty change still spends one of the key's writes for
      // the day, and answers with the row unchanged, which reads like it did something.
      if (!Object.keys(body).length) {
        throw new Error(`Nothing to change. Send at least one of: ${Object.keys(FIELDS).join(', ')}.`)
      }
      // Review is where a person's attention gets spent, so nothing arrives there on an agent's
      // word alone. The record has to carry a command that says it is done, and the acceptance
      // criterion is written when the work is described — written afterwards it only describes
      // whatever the agent happened to do.
      if (body.status === 'review') {
        const held = body.data ?? (await ask(`/records/${encodeURIComponent(id)}`)).data
        if (!held?.check) {
          throw new Error(
            'This record carries no check, so it cannot go to review. Give it one first: '
            + 'update_record with data { "check": "<a command that passes when the work is done>" }.',
          )
        }
      }
      return ask(`/records/${encodeURIComponent(id)}`, { method: 'PATCH', body })
    },
  },
  {
    name: 'append_to_page',
    description:
      'Add Markdown to the end of a page or issue. Needs a key with write access.\n\n'
      + 'Be aware of when it lands. A page is a shared document that only a browser can edit, so '
      + 'the text is left waiting on the record and becomes real paragraphs at the end of the '
      + 'page the next time somebody opens it in Tuval. Until then read_page reads it back in the '
      + 'place it will take, but search does not index it and nobody scrolling past the page in a '
      + 'list will see it. Say so if it matters to what you were asked.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'The record id' },
        text: { type: 'string', description: 'Markdown to add' },
      },
      required: ['id', 'text'],
    },
    run: async ({ id, text }) => {
      const at = `/records/${encodeURIComponent(id)}`
      // Read then write, because the column holds whatever has not been folded in yet and
      // replacing it would throw away somebody else's waiting paragraph.
      const held = ((await ask(at)).description ?? '').trimEnd()
      return ask(at, {
        method: 'PATCH',
        body: { description: held ? `${held}\n\n${text}` : text },
      })
    },
  },
  {
    name: 'create_board',
    description:
      'Draw a flow on an infinite canvas, for somebody who would rather look at a board than '
      + 'read a list. Needs a key with write access.\n\n'
      + 'The brief is Markdown with a shape. The first heading names the board. Every "## " '
      + 'heading becomes a frame, and the bullets under it become notes inside that frame. A '
      + 'section headed "## Flow" holding a mermaid flowchart becomes the arrows: name a node '
      + 'with the same words as a bullet and the arrow lands on that note.\n\n'
      + 'Be aware of when it lands. A canvas is a shared document that only a browser can draw, '
      + 'so the brief waits on the board and becomes real frames, notes and arrows the first '
      + 'time somebody opens it in Tuval. Say so rather than reporting a board full of work.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'What the board is called' },
        brief: { type: 'string', description: 'The Markdown the board is drawn from' },
      },
      required: ['title', 'brief'],
    },
    run: ({ title, brief }) => ask('/boards', { method: 'POST', body: { title, brief } }),
  },
]

const reply = (id, result) => ({ jsonrpc: '2.0', id, result })
const fail = (id, message) => ({ jsonrpc: '2.0', id, error: { code: -32000, message } })

async function handle(message) {
  const { id, method, params } = message

  if (method === 'initialize') {
    return reply(id, {
      protocolVersion: '2024-11-05',
      capabilities: { tools: {} },
      serverInfo: { name: 'tuval', version: '1' },
    })
  }

  if (method === 'tools/list') {
    return reply(id, {
      tools: TOOLS.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })),
    })
  }

  if (method === 'tools/call') {
    const tool = TOOLS.find((t) => t.name === params?.name)
    if (!tool) return fail(id, `No tool called ${params?.name}.`)
    if (!KEY) return fail(id, 'Set TUVAL_API_KEY. Make one in Settings → API and webhooks.')
    try {
      const answer = await tool.run(params.arguments ?? {})
      const text = typeof answer === 'string' ? answer : JSON.stringify(answer, null, 2)
      return reply(id, { content: [{ type: 'text', text }] })
    } catch (e) {
      // Reported as a result rather than as a protocol error: the model can read this one and
      // decide what to do, where a transport error just stops it.
      return reply(id, { content: [{ type: 'text', text: `Could not: ${e.message}` }], isError: true })
    }
  }

  // Notifications carry no id and want no answer.
  if (id === undefined) return null

  return fail(id, `This server does not do ${method}.`)
}

const lines = createInterface({ input: process.stdin })

lines.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let message
  try { message = JSON.parse(trimmed) } catch { return }
  void handle(message).then((answer) => {
    if (answer) process.stdout.write(`${JSON.stringify(answer)}\n`)
  })
})
