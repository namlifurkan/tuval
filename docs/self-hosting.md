# Self-hosting

Tuval runs on your own Supabase project and a folder of static files. Nothing calls home.

## Five commands

```bash
git clone https://github.com/namlifurkan/tuval && cd tuval
cp .env.example .env.local            # add your Supabase URL and anon key
npx supabase db push                  # apply the schema
psql "$DATABASE_URL" -c "update public.tuval_settings set self_hosted = true where id = 1"
npm install && npm run build          # serve dist/ from anything
```

Serve `dist/` from any static host. The app is the folder; there is no Node process to keep alive.

## The fourth command is not optional

`tuval_settings.self_hosted` is the switch that turns a self-hosted install from crippled into
complete. Leave it `false` and the install behaves as if somebody were billing you for it:

| | `self_hosted = false` | `self_hosted = true` |
|---|---|---|
| Seats per workspace | 3 | unlimited |
| Storage per workspace | 1 GB | unlimited |
| HTTP API and webhooks | off | on |

The limits exist because on the hosted service somebody pays for the disks, the bandwidth and the
answering. On your install there is no somebody else, so there is nothing for a limit to protect.

Set it once, on the settings row every install already has:

```sql
update public.tuval_settings set self_hosted = true where id = 1;
```

Check it took:

```sql
select public.is_self_hosted(), public.plan_of(id) from public.workspaces limit 1;
-- t | unlimited
```

`is_self_hosted()` is read by `plan_of()`, which the API door, the seat trigger, the storage
trigger and the usage screen all ask, so one answer changes all four rather than four places
agreeing by luck.

## Carrying somebody on a hosted install

The same switch, one step smaller: an install that *is* billing can still decide it is not
billing certain people. A workspace whose owner has a confirmed address at one of these domains
has no seat limit, no storage limit and the API on — the same as self-hosting, for that
workspace.

```sql
update public.tuval_settings
set unlimited_domains = array['example.com', 'example.org'] where id = 1;
```

It reads the **owner's** address, and only a confirmed one. Being invited into somebody else's
workspace does not carry the arrangement into theirs, and does not take it away from your own. An
unconfirmed address is a claim, and this is not a claim somebody should be able to make about
themselves by typing it.

Empty by default, and it stays empty in the repository: one install's arrangement is not
another's.

## What you need

- A Postgres database — Supabase, or Postgres plus the Supabase stack if you run that yourself
- An S3-compatible bucket for images, PDFs and attachments (Supabase Storage is one)
- Any static host for `dist/`

## Migrations

`supabase/migrations` is append-only and every file is idempotent, so running one twice is
harmless. Apply them with `npx supabase db push` after linking the project, or paste the files
into the SQL editor in filename order.

Access rules are proved before they ship:

```bash
node scripts/rls-test.mjs supabase/migrations/<new-migration>.sql
```

The named migrations are applied inside the same transaction as the tests and rolled back, so a
migration that changes access is proved before `db push`, not after.

## Sign-in

Magic link works with no extra setup. GitHub, Google and Apple need their provider filled in on
the Supabase dashboard. Apple's client secret expires every six months — regenerate it with
`node scripts/apple-secret.mjs`.

## Related

- [HTTP API](api.md) — off until `self_hosted` is true
- [MCP server](mcp.md)
- [Keyboard](keyboard.md)
