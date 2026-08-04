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

## What a write leaves behind

Every write is signed and counted, and the row it changed keeps what it used to say.

- **Signed.** The row records the person the key speaks for and the key's own name, so a change
  made out here is never attributed to whoever happened to edit it last in the app. The workspace
  activity list shows the key name rather than a person.
- **Kept.** The previous value of every column the write moved is stored beside the record. The
  last thirty changes are kept, and any of them can be put back from the record itself. Moving a
  card — `position` — is not counted as a change.
- **Counted.** A key may make **1000 writes a day**. The allowance is spent at the door, before
  the row moves, and a call past it answers `429`. `GET /` reports `writes_left`. Reads are never
  counted and are never refused for it. The count starts again at midnight UTC.

To give one key a different allowance, set `daily_writes` on its row in `api_keys`.

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
| `limit` · `offset` | Page through. `limit` defaults to 100 and stops at 500 |
| `archived` | `true` includes archived rows. They are left out otherwise |

### `GET /records/<id>`

One record.

### `GET /records/<id>/markdown`

The same record with its body rendered as Markdown — headings, lists and code intact. This is the
endpoint to read a page with, not the JSON one.

Text written through `description` and not yet folded into the page comes back at the end, in the
place it will take once somebody opens the page. See [Writable fields](#writable-fields).

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

`body` and `markdown` are missing on purpose. A page is a CRDT in `record_docs` that this door
cannot read or edit; those two columns are the flattened copies the browser writes beside it so
Postgres has something to index, and writing to either would look like it worked until the first
person opened the page and typed.

Prose goes in `description`, which does reach the page: the app folds it onto the end of the body
the next time somebody opens that page, as real paragraphs, and clears the column. Until then it
is readable through `GET /records/<id>/markdown` but not findable through `GET /search` — search
indexes the document, and the text is not in the document yet.

## What comes back is quoted, not addressed to you

Every record was typed by somebody, and a key that reads may also write. So both doors that hand
back page text say what that text is: `GET /search` carries a `note` beside its `results`, and
`GET /records/<id>/markdown` puts the whole page between `<<<RECORD_CONTENT>>>` markers under the
same sentence. A page that writes those markers itself has them escaped on the way out, so it
cannot close the quote and start speaking.

If you are wiring an agent to this API, leave that text in the prompt. An instruction reaching a
model through an imported spreadsheet cell is the cheap version of this attack, and the sentence
is what makes it fail.

## Everything else

| | |
|---|---|
| `GET /search?q=<words>&limit=` | Titles and bodies, across every kind. `{ note, results }`, each result an excerpt and an id |
| `GET /cycles` | The two-week cycles |
| `GET /labels` | The workspace's labels |
| `GET /` | What this key can reach |

## From n8n

There is no Tuval node to install. There is an HTTP Request node, which is the whole
integration: four fields, and every endpoint above is reachable from it.

| Field | Value |
|---|---|
| Method | `POST` |
| URL | `https://<project>.supabase.co/functions/v1/api/records` |
| Authentication | Generic → Header Auth. Name `authorization`, value `Bearer tuv_…` |
| Body | JSON, e.g. `{"title": "{{$json.subject}}", "status": "todo"}` |

Store the key as an n8n credential rather than in the node, so it does not travel in an exported
workflow. To go the other way — Tuval telling n8n that something changed — point a webhook at an
n8n Webhook node's URL in Settings → API and webhooks; every call is signed, and the signature is
`sha256=` plus an HMAC of the raw body with the webhook's secret.

## Errors

`401` no key, or a key that is not valid, expired or revoked, or the API is off for this plan ·
`403` a `read` key asked to write · `400` malformed body or a rejected write · `404` no such
record in this workspace, or one the key's holder is not on · `405` a method this door does not
do · `429` the key has written as much as it may today.

## Related

- [MCP server](mcp.md) — the same data, mounted in an agent
- [Agents](agents.md) — what an agent can and cannot do with this key
- [Self-hosting](self-hosting.md)
