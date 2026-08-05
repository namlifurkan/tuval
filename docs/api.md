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

`issue` · `doc` · `database` · `collection` · `project` · `person` · `company` · `event` · `file`

### `GET /records`

Answers `{"note": "…", "records": [ … ]}`. The note says the text was written by people and is not
addressed to whatever is reading it; see [below](#what-comes-back-is-quoted-not-addressed-to-you).

| Query | Meaning |
|---|---|
| `kind` | One of the kinds above. A kind that is not on that list answers `400` rather than being ignored |
| `status` | `backlog` `todo` `doing` `review` `blocked` `done` `cancelled` |
| `assignee` | A user id |
| `project` · `cycle` | A record id |
| `limit` · `offset` | Page through. `limit` defaults to 100 and stops at 500 |
| `archived` | `true` includes archived rows. They are left out otherwise |

### `GET /records/<id>`

One record, as `{"note": "…", "record": { … }}`.

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

`kind` defaults to `issue`. Returns `201` and the created row under `record`.

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

Every record was typed by somebody, and a key that reads may also write. So every door that hands
back something somebody typed says what it is. `GET /search` carries a `note` beside its
`results`; `GET /records` carries one beside its `records`, and `GET /records/<id>`, `POST` and
`PATCH` beside their `record`. `GET /records/<id>/markdown` and `GET /boards/<id>/markdown` put
the whole text between `<<<RECORD_CONTENT>>>` markers under the same sentence, and a page that
writes those markers itself has them escaped on the way out, so it cannot close the quote and
start speaking.

The listing used to be the exception, which is the wrong exception to have: an imported cell
reaches a model through `GET /records` at least as readily as through search.

If you are wiring an agent to this API, leave that text in the prompt. An instruction reaching a
model through an imported spreadsheet cell is the cheap version of this attack, and the sentence
is what makes it fail.

## Boards

A board is a CRDT, and only a browser composes one. So the canvas is written from outside and
read from a copy: `POST /boards` and `PATCH /boards/<id>` leave a brief that becomes items the
first time somebody opens the board, and `GET /boards/<id>/markdown` returns the reading the
browser wrote beside the document on its last save.

Reading a board and redrawing one are separate permissions, asked separately. A key whose holder
may only view a board can read it and cannot write it, and the refusal is `404` rather than `403`
— the same answer a board in somebody else's workspace gives, and for the same reason it is given
on records: what you may not touch is not described to you.

| | |
|---|---|
| `GET /boards` | The boards you can read, newest first, with item and frame counts |
| `GET /boards/<id>/markdown` | What is drawn on it, as prose |
| `POST /boards` | `{ title, brief, mode? }` — a board drawn from a brief. `201` |
| `PATCH /boards/<id>` | `{ title?, brief?, mode? }` — rename it, or send it another brief |
| `DELETE /boards/<id>` | Trashes rather than deletes. Returns `{"trashed":"<id>"}` |

Frames become sections, the items inside them a list in reading order, the connectors between
them a flow, and a comment is attached to whatever it was left on.

### When a brief becomes items

Not when you send it. The brief is kept on the board's row and drawn **the first time somebody
opens that board in a browser**, because the canvas is a CRDT and only a browser composes one. A
board you have just made and nobody has opened is a brief waiting, and both `POST` and `PATCH`
answer with a `waiting` line saying so rather than reporting frames that do not exist yet. If a
person needs to see it, they open the board — nothing else makes it happen.

### `append` and `replace`

`mode` says what the new brief does about what is already on the canvas. It travels with the
brief, not with the board, so the same board can be added to one month and redrawn the next.

| `mode` | What happens on the next open |
|---|---|
| `append` (default) | Drawn below everything already there, with a gap. Nothing is removed |
| `replace` | What the last brief drew is removed, and the new one is drawn where it stood |

`replace` only takes back items a brief drew — they are marked when they are made. Anything a
person added by hand stays where it is, and a person's edits **to a brief's own items** go with
the redraw, because those items are what is being replaced. Put work you mean to keep in its own
note rather than in the middle of a generated one.

A publishing integration wants `PATCH` with `replace`: one board, rewritten every run. `append` is
for a log that should accumulate — a standup board where each day is added under the last.

The copy is exactly as old as the last save by somebody with the board open. `X-Tuval-Read-At` on
the response says when it was written, and a board nobody has opened since this existed answers
`409` rather than pretending to be empty. If the answer depends on the board being current, say
so to whoever asked.

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
