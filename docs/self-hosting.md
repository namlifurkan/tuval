# Self-hosting

Tuval runs on a Postgres, three services in front of it, and a folder of static files. Nothing
calls home.

Those services are Supabase's, and Supabase is open source: PostgREST answers the queries, GoTrue
issues the tokens the row policies read, storage-api holds the files. You can rent them from
supabase.com or run the same containers yourself — the application cannot tell, because from its
side the whole backend is one URL and one key. If you would rather run them, skip to
[without anybody's cloud](#without-anybodys-cloud).

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

## Without anybody's cloud

`deploy/compose.yml` is the same four services as containers, with a Caddy in front of them
because the client library expects them at fixed paths under one origin. No dashboard, no
analytics, no pooler — six containers.

```bash
cd deploy
cp .env.example .env
node keys.mjs                          # paste the three lines it prints into .env
docker compose up -d db                # wait for healthy
docker compose up -d auth storage rest proxy
cat ../supabase/migrations/*.sql | docker compose exec -T db psql -U postgres
```

Then point the app at it: `VITE_SUPABASE_URL=http://localhost:8000` and the `ANON_KEY` from
`.env`.

**The order is not decoration.** GoTrue creates `auth.users`, storage-api creates
`storage.buckets`, and the schema is written against both. Applying the migrations before those
services have started fails on columns that do not exist yet.

Two things the hosted platform provides that a hand-built stack does not, so `deploy/init/` creates
them on an empty database: passwords for the roles the three services sign in as, and
`realtime.messages`, which the private board channel's policies are written against.

Checked on 2026-08-03, end to end: the schema applies with no errors, all 261 access checks pass
against this stack, `records` reads back empty for an anonymous caller, a person signs in with a
password, and a sticky note dropped in one browser turns up in another through the private
channel. Two more things the hosted platform hides, both of which cost a broken run to find: the
gateway has to answer CORS preflights itself, because none of the four services answers them in a
way a browser accepts, and realtime works out which tenant it is serving from the Host it was
asked on — so the tenant it seeds has to be named the same thing or every socket comes back
`TenantNotFound`.

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
