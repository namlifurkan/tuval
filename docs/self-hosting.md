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
select public.is_self_hosted(), * from public.plan_limits('free', 1);
-- t | 2147483647 | 9223372036854775807 | t
```

`is_self_hosted()` is read by the API door, the seat trigger, the storage trigger and the usage
screen, so one answer changes all four rather than four places agreeing by luck.

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
