// The door for everything outside: n8n, a script, a bot, somebody's spreadsheet.
//
// It holds the service key, so it can read anything in the database. Three things make that
// safe. Every query it runs is filtered by the workspace the caller's key belongs to, and the
// caller never chooses that workspace — the key does. A key that was made to read is refused
// every method that is not a read. And a page with people named on it is asked about on behalf
// of the person who made the key, so restricting a page shuts this door as well as the app.
//
// Every write it makes is signed with the person the key speaks for and with the key's own name,
// and spends one of that key's writes for the day. The database keeps the version.
//
// Deliberately small. This is not a mirror of the app: it is the handful of things an
// integration asks for, which is records in and records out.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const url = Deno.env.get('SUPABASE_URL')!
const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const db = createClient(url, service, { auth: { persistSession: false } })

const KINDS = ['issue', 'doc', 'database', 'project', 'person', 'company', 'event', 'file']

const COLUMNS =
  'id, kind, title, description, status, assignee, priority, due_at, estimate, seq, '
  + 'parent_id, project_id, cycle_id, position, created_at, updated_at, archived_at, data'

// What a caller is allowed to set. Anything else it sends is dropped rather than refused, so a
// client that grew a field we do not have keeps working.
const WRITABLE = [
  'kind', 'title', 'description', 'status', 'assignee', 'priority', 'due_at',
  'estimate', 'parent_id', 'project_id', 'cycle_id', 'position', 'data',
]

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
}

const send = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  })

const only = (source: Record<string, unknown>, keys: string[]) => {
  const out: Record<string, unknown> = {}
  for (const key of keys) if (key in source) out[key] = source[key]
  return out
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return send({ error: 'Send an API key as a bearer token.' }, 401)

  // Asked once, and told up front whether this is a write, because the allowance is spent at the
  // door rather than after the row has already moved.
  const writing = request.method !== 'GET' && request.method !== 'OPTIONS'
  const { data: keyed } = await db.rpc('workspace_for_key', { token, writing })
  const key = (Array.isArray(keyed) ? keyed[0] : keyed) as
    { workspace_id: string; acting: string; agent: string; scope: string; writes_left: number }
    | undefined
  if (!key?.workspace_id) return send({ error: 'That key is not valid.' }, 401)

  const workspace = key.workspace_id
  const acting = key.acting
  if (writing && key.scope !== 'write') {
    return send({ error: 'That key may only read.' }, 403)
  }
  if (writing && key.writes_left < 0) {
    return send({ error: 'That key has written as much as it may today.' }, 429)
  }

  // What the row is signed with. A caller cannot send these — they are not in WRITABLE — so an
  // agent cannot pass itself off as somebody, and a change made out here always says so.
  const signature = { updated_by: acting, updated_via: key.agent || 'API key' }

  // The page gate, asked once for a whole page of rows rather than once per row.
  const readable = async (ids: string[]) => {
    if (!ids.length) return new Set<string>()
    const { data } = await db.rpc('can_read_records_as', { who: acting, ids })
    return new Set<string>((data as string[] | null) ?? [])
  }

  const writable = async (rec: string | null) => {
    const { data } = await db.rpc('can_write_record_as', { who: acting, rec })
    return data === true
  }

  // Everything after /api is the path, so /api/records/<id> and /functions/v1/api/records/<id>
  // are the same request seen from two sides of a proxy.
  const path = new URL(request.url).pathname.replace(/^.*\/api/, '').replace(/\/+$/, '')
  const parts = path.split('/').filter(Boolean)
  const query = new URL(request.url).searchParams

  if (!parts.length) {
    return send({
      workspace,
      scope: key.scope,
      writes_left: key.writes_left,
      records: '/records',
      one: '/records/<id>',
      markdown: '/records/<id>/markdown',
      search: '/search?q=<words>',
      cycles: '/cycles',
      labels: '/labels',
    })
  }

  if (parts[0] === 'cycles' && request.method === 'GET') {
    const { data } = await db.from('cycles')
      .select('id, number, name, starts_on, ends_on')
      .eq('workspace_id', workspace).order('number', { ascending: false })
    return send(data ?? [])
  }

  if (parts[0] === 'labels' && request.method === 'GET') {
    const { data } = await db.from('labels')
      .select('id, name, tone').eq('workspace_id', workspace).order('name')
    return send(data ?? [])
  }

  // What an agent asks first. Titles and bodies together, ranked by the database rather than by
  // us, with a line of context so an answer can be judged without opening it.
  if (parts[0] === 'search' && request.method === 'GET') {
    const asked = (query.get('q') ?? '').trim()
    if (asked.length < 2) return send({ error: 'Ask for at least two characters.' }, 400)

    const { data, error } = await db.from('records')
      .select('id, kind, title, icon, updated_at, body')
      .eq('workspace_id', workspace).is('archived_at', null)
      .textSearch('search', asked, { type: 'websearch', config: 'simple' })
      .limit(Math.min(Number(query.get('limit') ?? 20) || 20, 100))
    if (error) return send({ error: error.message }, 400)

    const open = await readable((data ?? []).map((row) => row.id as string))
    const first = asked.split(/\s+/)[0].toLowerCase()
    return send((data ?? []).filter((row) => open.has(row.id as string)).map((row) => {
      const body = (row.body as string) ?? ''
      const at = body.toLowerCase().indexOf(first)
      const from = at < 0 ? 0 : Math.max(0, at - 40)
      return {
        id: row.id,
        kind: row.kind,
        title: row.title,
        icon: row.icon,
        updated_at: row.updated_at,
        excerpt: `${from ? '…' : ''}${body.slice(from, from + 160)}${body.length > from + 160 ? '…' : ''}`,
        markdown: `/records/${row.id as string}/markdown`,
      }
    }))
  }

  if (parts[0] !== 'records') return send({ error: 'No such collection.' }, 404)

  const id = parts[1]

  // The page as prose rather than as a row. Markdown is what an agent reads; the flattened body
  // is the fallback for a page written before this existed or never opened in the editor since.
  if (request.method === 'GET' && id && parts[2] === 'markdown') {
    const { data } = await db.from('records').select('title, markdown, body')
      .eq('workspace_id', workspace).eq('id', id).maybeSingle()
    if (!data || !(await readable([id])).has(id)) return send({ error: 'No such record.' }, 404)
    const title = (data.title as string) || 'Untitled'
    const held = (data.markdown as string) || (data.body as string) || ''
    return new Response(`# ${title}\n\n${held}\n`, {
      headers: { 'Content-Type': 'text/markdown; charset=utf-8', ...CORS },
    })
  }

  if (request.method === 'GET' && id) {
    const { data } = await db.from('records').select(COLUMNS)
      .eq('workspace_id', workspace).eq('id', id).maybeSingle()
    if (!data || !(await readable([id])).has(id)) return send({ error: 'No such record.' }, 404)
    return send(data)
  }

  if (request.method === 'GET') {
    let asking = db.from('records').select(COLUMNS).eq('workspace_id', workspace)
    const kind = query.get('kind')
    if (kind && KINDS.includes(kind)) asking = asking.eq('kind', kind)
    if (query.get('status')) asking = asking.eq('status', query.get('status'))
    if (query.get('assignee')) asking = asking.eq('assignee', query.get('assignee'))
    if (query.get('project')) asking = asking.eq('project_id', query.get('project'))
    if (query.get('cycle')) asking = asking.eq('cycle_id', query.get('cycle'))
    // Archived rows are out unless somebody says otherwise, because "everything" almost never
    // means "and the things we threw away".
    if (query.get('archived') !== 'true') asking = asking.is('archived_at', null)

    const limit = Math.min(Number(query.get('limit') ?? 100) || 100, 500)
    const { data, error } = await asking
      .order('updated_at', { ascending: false })
      .range(Number(query.get('offset') ?? 0) || 0, (Number(query.get('offset') ?? 0) || 0) + limit - 1)
    if (error) return send({ error: error.message }, 400)

    // Filtered after the page rather than inside the query, so a restricted page costs a shorter
    // page rather than a recursive join on every listing.
    const open = await readable((data ?? []).map((row) => row.id as string))
    return send((data ?? []).filter((row) => open.has(row.id as string)))
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return send({ error: 'Send a JSON object.' }, 400)
    const row = only(body as Record<string, unknown>, WRITABLE)
    if (!row.kind) row.kind = 'issue'
    if (!KINDS.includes(String(row.kind))) return send({ error: 'No such kind.' }, 400)
    // A new page under a restricted one is part of that page, so it is judged by its parent.
    if (!(await writable((row.parent_id as string | null) ?? null))) {
      return send({ error: 'No such record.' }, 404)
    }

    const { data, error } = await db.from('records')
      .insert({ ...row, ...signature, created_by: acting, workspace_id: workspace })
      .select(COLUMNS).single()
    return error ? send({ error: error.message }, 400) : send(data, 201)
  }

  if (request.method === 'PATCH' && id) {
    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') return send({ error: 'Send a JSON object.' }, 400)
    if (!(await writable(id))) return send({ error: 'No such record.' }, 404)

    const { data, error } = await db.from('records')
      .update({ ...only(body as Record<string, unknown>, WRITABLE), ...signature })
      .eq('workspace_id', workspace).eq('id', id).select(COLUMNS).maybeSingle()
    if (error) return send({ error: error.message }, 400)
    return data ? send(data) : send({ error: 'No such record.' }, 404)
  }

  // Archived rather than deleted, the same as everywhere else: an integration having a bad day
  // should not be able to take work away for good.
  if (request.method === 'DELETE' && id) {
    if (!(await writable(id))) return send({ error: 'No such record.' }, 404)
    const { data, error } = await db.from('records')
      .update({ archived_at: new Date().toISOString(), ...signature })
      .eq('workspace_id', workspace).eq('id', id).select('id').maybeSingle()
    if (error) return send({ error: error.message }, 400)
    return data ? send({ archived: id }) : send({ error: 'No such record.' }, 404)
  }

  return send({ error: 'Not something this door does.' }, 405)
})
