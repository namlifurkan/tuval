# HTTP API

One door for everything outside the app: a script, a bot, n8n, somebody's spreadsheet.

It is deliberately small. Not a mirror of the app — records in and records out.

## Authentication

Make a key in **Settings → API and webhooks**. It is shown once and stored hashed.

```bash
curl -H "authorization: Bearer tuv_..." \
  https://<project>.supabase.co/functions/v1/api/records?kind=issue
```

The key decides which workspace the call reads and writes. The caller never chooses it, and there
is no parameter that can move a call into another workspace.

A key is made with a **scope** and an **expiry**. A `read` key is refused every method that is not
a `GET`, with `403`. An expired key is refused everything, with `401`.

A key is also never more than the person who made it. It opens the pages that person can open, so
a page with people named on it stays shut unless they are one of them — `GET /records` simply
leaves those rows out, and asking for one by id answers `404`. Taking that person out of the
workspace closes their key with them.

Available on the `team` plan, and on any install where
[`self_hosted`](self-hosting.md#the-fourth-command-is-not-optional) is true. On a `free` hosted
workspace every call answers `401`.

## Records

A record is one row of work: an issue, a page, a database, a project. `kind` says which.

`issue` · `doc` · `database` · `project` · `person` · `company` · `event` · `file`

### `GET /records`

| Query | Meaning |
|---|---|
| `kind` | One of the kinds above |
| `status` | `backlog` `todo` `doing` `review` `blocked` `done` `cancelled` |
| `assignee` | A user id |
| `project` · `cycle` | A record id |
| `limit` · `offset` | Page through. Archived rows are left out |

### `GET /records/<id>`

One record.

### `GET /records/<id>/markdown`

The same record with its body rendered as Markdown — headings, lists and code intact. This is the
endpoint to read a page with, not the JSON one.

### `POST /records`

```bash
curl -X POST -H "authorization: Bearer tuv_..." -H "content-type: application/json" \
  -d '{"title":"Ship the API reference","status":"todo","priority":2}' \
  https://<project>.supabase.co/functions/v1/api/records
```

`kind` defaults to `issue`. Returns `201` and the created row.

### `PATCH /records/<id>`

Send only what changes.

```bash
curl -X PATCH -H "authorization: Bearer tuv_..." -H "content-type: application/json" \
  -d '{"status":"done"}' \
  https://<project>.supabase.co/functions/v1/api/records/<id>
```

### `DELETE /records/<id>`

Archives rather than deletes — an integration having a bad day cannot take work away for good.
Returns `{"archived":"<id>"}`.

## Writable fields

`kind` `title` `description` `status` `assignee` `priority` `due_at` `estimate` `parent_id`
`project_id` `cycle_id` `position` `data`

Anything else you send is dropped rather than refused, so a client that grew a field this version
does not have keeps working.

`data` is a free JSON object for fields that are yours, not ours.

## Everything else

| | |
|---|---|
| `GET /search?q=<words>&limit=` | Titles and bodies, across every kind. Returns an excerpt and an id |
| `GET /cycles` | The two-week cycles |
| `GET /labels` | The workspace's labels |
| `GET /` | What this key can reach |

## Errors

`401` no key, or a key that is not valid, expired or revoked, or the API is off for this plan ·
`403` a `read` key asked to write · `400` malformed body or a rejected write · `404` no such
record in this workspace, or one the key's holder is not on · `405` a method this door does not do.

## Related

- [MCP server](mcp.md) — the same data, mounted in an agent
- [Agents](agents.md) — what an agent can and cannot do with this key
- [Self-hosting](self-hosting.md)
