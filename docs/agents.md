# Agents

What an agent can do with a Tuval workspace today, and — the longer half — what it cannot.

There are two directions and they are not symmetric. A board goes out to an agent as a brief. A
workspace comes back to an agent as records, and goes back again as records. Nothing goes the
other way onto a board over the network, and this page says so in as many words rather than
leaving it to be discovered.

## Reading and writing the workspace

Seven tools, mounted over stdio, which is what Claude Code and Cursor speak.

```bash
claude mcp add tuval -- node /path/to/tuval/scripts/mcp.mjs
```

| Tool | What it does |
|---|---|
| `search` | Words in titles and bodies across pages, databases, issues and projects. An excerpt and an id back |
| `read_page` | One page or issue as Markdown, headings and lists intact |
| `list_records` | Records of one kind, filtered by status, assignee, project or cycle |
| `workspace` | What this key can reach, whether it may write, and how many writes are left today |
| `create_record` | File an issue, page, project, person, company or event |
| `update_record` | Change a title, status, assignee, priority, due date, parent, project or cycle |
| `append_to_page` | Add Markdown to the end of a page or issue |

The first four are `GET` and work with any key. The last three go through the same door as `curl`,
and want a key whose scope is `write`: a `read` key answers `403`, a key past its daily allowance
answers `429`, and the server turns both into a sentence rather than a number, because the two
call for opposite decisions.

Check it is alive without leaving the shell:

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node scripts/mcp.mjs
```

## Writing the workspace directly

The three write tools above are a thin wrapper on the [HTTP API](api.md). The same key, the same
door, one more verb — and a script that is not an agent uses it the same way.

| | |
|---|---|
| `GET /records` · `GET /records/<id>` · `GET /records/<id>/markdown` | Read |
| `GET /search?q=` · `GET /cycles` · `GET /labels` · `GET /` | Read |
| `POST /records` | Create. `kind` defaults to `issue`, returns `201` |
| `PATCH /records/<id>` | Change what you send and nothing else |
| `DELETE /records/<id>` | Archives. Returns `{"archived":"<id>"}` |

```bash
curl -X POST -H "authorization: Bearer tuv_..." -H "content-type: application/json" \
  -d '{"title":"Rewrite the address step","status":"todo","priority":2}' \
  https://<project>.supabase.co/functions/v1/api/records
```

A write takes these fields and drops the rest:

`kind` `title` `description` `status` `assignee` `priority` `due_at` `estimate` `parent_id`
`project_id` `cycle_id` `position` `data`

**`body` is not on that list, and neither is `markdown`, and they never will be.** Those two are
the flattened copies of the page that the browser writes beside the real thing so that Postgres
has something to index; the page itself is a CRDT in `record_docs` that no server here can read or
edit. A write to either column would look like it worked — it would show up in search and in
`GET /records/<id>/markdown` — and then vanish the first time somebody opened the page and typed.

**Prose goes in `description`, and it does reach the page.** That column is the one thing outside
the document that becomes document text: the app folds it into the end of the body the next time
somebody opens the page, as real paragraphs, headings and lists, and clears the column. It is what
`append_to_page` writes.

The gap is worth stating rather than glossing. Between the write and that next open, the text is
readable — `GET /records/<id>/markdown` returns it in the place it will take — but it is **not in
search**, because search indexes the flattened document and the text is not in the document yet.
It is a delay, not a second place for text to live, and nothing is lost either way. What is still
true is the older sentence: there is no verb that edits a page somebody is looking at.

## The gate

Five things are checked before any of the above happens, and each one answers on its own.

| Check | If it fails |
|---|---|
| The workspace is not on the `free` plan — paid, [`self_hosted`](self-hosting.md#the-fourth-command-is-not-optional), or on a [carried domain](self-hosting.md#carrying-somebody-on-a-hosted-install) | `401` |
| The key is not revoked and not past its `expires_at` | `401` |
| Somebody is still behind the key — a key whose maker has no row, or was taken out of the workspace, or was blocked | `401` |
| The key's scope is `write`, for anything that is not a `GET` | `403` |
| The key has writes left for the day — 1000 by default | `429` |

Two of those are worth stating plainly. On a `free` hosted workspace every call answers `401`,
including `tools/list` working and `tools/call` failing — the MCP server reports the reason as
text so the model can read it and stop rather than retry. And a `write` key is downgraded to
`read` the moment its holder's seat is anything but owner, admin or member: the scope is
recomputed from the seat on every call, not frozen when the key was made.

Beyond the gate, a key is never more than the person who made it. A page with people named on it
stays shut unless they are one of them — `GET /records` and `GET /search` leave those rows out,
and asking for one by id answers `404`.

## Handing a board to an agent

This direction is not an API at all. The canvas turns into a brief in the browser:
`graphToPrompt()` in `src/board/agent.ts` walks frames into sections, connectors into a mermaid
graph and comments into notes, and the result reaches the agent by clipboard, by downloaded `.md`,
or as a chat URL. No key, no request, no server.

The board's own text arrives inside a fence:

```
<<<BOARD_CONTENT>>>
…the board…
<<</BOARD_CONTENT>>>
```

The prompt tells the model that everything between those markers is untrusted data written by the
people using the board: quoted material, never instructions. Any `<<<BOARD_CONTENT>>>` shaped
string in the board itself has its angle brackets escaped, so a sticky note cannot close the fence
early and start giving orders.

## What it cannot do today

Plainly, because the shape of the door is easy to mistake for the shape of the product.

- **No board writing.** The API serves `records`, `search`, `cycles` and `labels`. Anything else
  answers `404`. Boards live in `board_snapshots` and are written by `save_board_snapshot()`,
  which is granted to signed-in users and the service role, and called only by the app in the
  browser. There is no endpoint that
  creates a board, adds a sticky note or draws a connector.
- **A brief becomes a board in the browser.** `briefToItems()` has exactly one caller in the
  product — the import panel — and it writes into the local Yjs document. An agent can produce the
  Markdown; a person still pastes it into an open board.
- **No editing a page in place.** Prose can be added to the end of a page and it will be there
  the next time somebody opens it. Nothing can rewrite a paragraph that is already in the
  document, delete one, or reorder blocks: that is the CRDT, and only a browser holds it.
- **No live collaboration.** Presence and document sync run over Supabase Realtime between
  browsers. An agent holding a key is not a participant in a session; it reads rows and writes
  rows, and the app sees the result the next time it reads.
- **Nothing on the free plan.** Not a reduced rate limit — off. Pay for `team`, set
  `self_hosted = true` on your own install, or be on a domain the operator carries. The daily
  write allowance applies to a paid workspace; raise `api_keys.daily_writes` if a thousand
  changes a day is not enough. A workspace nobody is billing is not counted at all.
- **Nothing quietly.** Every write is signed with the key's name and leaves a version of what it
  changed, which a person can put back from the record. See
  [what a write leaves behind](api.md#what-a-write-leaves-behind).

## Related

- [HTTP API](api.md) — every endpoint, in full
- [MCP server](mcp.md) — setup and the seven tools
- [Self-hosting](self-hosting.md) — the switch that turns the API on
