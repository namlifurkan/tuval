#!/usr/bin/env node
// Tuval as something an agent can read ------------------------------------------------------------
// The other half of handing a board to an agent. That direction turns a canvas into a brief; this
// one lets the agent go and look: search the workspace, read a page as markdown, list what is open.
//
// Obsidian works as a second brain for agents because the notes are files and the agent can open
// them. Ours are rows in a database, so this is the door. It speaks MCP over stdin and stdout,
// which is what Claude Code and Cursor mount.
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

const KEY = read('TUVAL_API_KEY')
const BASE = read('TUVAL_API_URL')
  || `${read('VITE_SUPABASE_URL').replace(/\/+$/, '')}/functions/v1/api`

async function ask(path, { markdown = false } = {}) {
  const answer = await fetch(`${BASE}${path}`, {
    headers: { authorization: `Bearer ${KEY}` },
  })
  const body = await answer.text()
  if (!answer.ok) throw new Error(`${answer.status}: ${body.slice(0, 300)}`)
  return markdown ? body : JSON.parse(body)
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
    description: 'What this key can reach, and the addresses inside it.',
    inputSchema: { type: 'object', properties: {} },
    run: () => ask(''),
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
