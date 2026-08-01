# MCP server

Tuval hands a board to an agent as a brief. This is the other direction: the agent goes and looks.

Obsidian works as a second brain for agents because the notes are files an agent can open. Ours
are rows in a database, so this is the door. It speaks MCP over stdin and stdout, which is what
Claude Code and Cursor mount.

## Setup

```bash
claude mcp add tuval -- node /path/to/tuval/scripts/mcp.mjs
```

It needs a key from **Settings → API and webhooks**, in the environment or in `.env.local`:

```bash
TUVAL_API_KEY=tuv_...
TUVAL_API_URL=https://<project>.supabase.co/functions/v1/api   # optional
```

Without `TUVAL_API_URL` it is derived from `VITE_SUPABASE_URL`, so a checkout that already runs
the app needs one line.

The key carries the same limits as the [HTTP API](api.md): `team` plan, or a `self_hosted`
install.

## Tools

| Tool | What it does |
|---|---|
| `search` | Words in titles and bodies across pages, databases, issues and projects. Returns an excerpt and the id to read in full |
| `read_page` | One page or issue as Markdown, headings and lists intact |
| `list_records` | Records of one kind, filtered by status, assignee, project or cycle |
| `workspace` | What this key can reach |

Read-only on purpose. An agent that can read the workspace is useful on the first day; an agent
that can rewrite it needs a conversation about undo first.

## Checking it works

```bash
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node scripts/mcp.mjs
```

Four tools come back. If the key is missing or the plan has the API off, `tools/call` answers with
the reason as text rather than a transport error, so the model can read it and decide what to do.

## Related

- [HTTP API](api.md)
- [Self-hosting](self-hosting.md)
