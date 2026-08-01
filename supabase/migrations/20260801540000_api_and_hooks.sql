-- A way in, and a way out ---------------------------------------------------------------------
-- The plan written down for this product is to integrate rather than clone: n8n for automation,
-- Gmail for mail, Forgejo for git. None of that is possible without something for them to talk
-- to, so this is the door.
--
-- Two halves. A key lets something outside read and write the workspace it belongs to. A webhook
-- tells something outside when a record changed, so an integration does not have to poll.

create extension if not exists pgcrypto with schema extensions;
-- Sending an HTTP request from a trigger. Supabase ships it; without it a webhook would need a
-- server of our own to sit and watch, which is the thing this whole design avoids.
create extension if not exists pg_net with schema extensions;

-- Keys ------------------------------------------------------------------------------------------
-- The token itself is never stored. What is stored is its SHA-256, so a stolen database row is
-- not a working key, and the token is shown to the person exactly once.

create table if not exists public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  name         text not null default '',
  -- The first characters, kept in the clear so a person can tell two keys apart in a list.
  hint         text not null default '',
  token_sha    text not null unique,
  created_by   uuid references auth.users on delete set null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at   timestamptz
);

create index if not exists api_keys_workspace_idx on public.api_keys (workspace_id);

-- Webhooks --------------------------------------------------------------------------------------

create table if not exists public.webhooks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces on delete cascade,
  url          text not null check (url ~ '^https://'),
  -- Signed with this, so the far end can tell our call from anybody else's.
  secret       text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  kinds        text[] not null default array['issue', 'doc', 'database', 'project'],
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  last_fired_at timestamptz,
  last_status  int
);

create index if not exists webhooks_workspace_idx on public.webhooks (workspace_id)
  where active;

-- Delivery ---------------------------------------------------------------------------------------
-- Fired after the row has actually changed, one request per hook, and never inside the caller's
-- wait: pg_net queues it and returns. A hook that is down slows nothing down here.

create or replace function public.fire_webhooks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_now  public.records;
  hook     public.webhooks;
  body     text;
begin
  row_now := coalesce(new, old);

  for hook in
    select * from public.webhooks w
    where w.workspace_id = row_now.workspace_id
      and w.active
      and row_now.kind = any (w.kinds)
  loop
    body := json_build_object(
      'event', lower(tg_op),
      'at', now(),
      'record', json_build_object(
        'id', row_now.id,
        'kind', row_now.kind,
        'title', row_now.title,
        'status', row_now.status,
        'assignee', row_now.assignee,
        'priority', row_now.priority,
        'estimate', row_now.estimate,
        'seq', row_now.seq,
        'due_at', row_now.due_at,
        'project_id', row_now.project_id,
        'cycle_id', row_now.cycle_id,
        'parent_id', row_now.parent_id,
        'archived_at', row_now.archived_at,
        'updated_at', row_now.updated_at
      )
    )::text;

    perform extensions.http_post(
      url := hook.url,
      body := body::jsonb,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Tuval-Event', lower(tg_op),
        'X-Tuval-Signature',
        'sha256=' || encode(extensions.hmac(body, hook.secret, 'sha256'), 'hex')
      )
    );

    update public.webhooks set last_fired_at = now() where id = hook.id;
  end loop;

  return null;
end;
$$;

drop trigger if exists records_fire_webhooks on public.records;
create trigger records_fire_webhooks after insert or update or delete on public.records
  for each row execute function public.fire_webhooks();

-- Access ------------------------------------------------------------------------------------------
-- Both are workspace administration, so both follow the write rule of the workspace. The token
-- hash is readable by those people too, which is harmless: a hash is not a key.

alter table public.api_keys enable row level security;
alter table public.webhooks enable row level security;

drop policy if exists api_keys_read  on public.api_keys;
drop policy if exists api_keys_write on public.api_keys;
drop policy if exists webhooks_read  on public.webhooks;
drop policy if exists webhooks_write on public.webhooks;

create policy api_keys_read on public.api_keys for select to authenticated
  using ((select public.can_write_workspace(workspace_id)));

create policy api_keys_write on public.api_keys for all to authenticated
  using ((select public.can_write_workspace(workspace_id)))
  with check ((select public.can_write_workspace(workspace_id)));

create policy webhooks_read on public.webhooks for select to authenticated
  using ((select public.can_write_workspace(workspace_id)));

create policy webhooks_write on public.webhooks for all to authenticated
  using ((select public.can_write_workspace(workspace_id)))
  with check ((select public.can_write_workspace(workspace_id)));

-- What the gateway asks ---------------------------------------------------------------------------
-- The edge function holds the service key, so it can read anything; this is the one question it
-- asks before it does. Kept here rather than there so that what a key opens is written in the
-- same place as everything else about access.

create or replace function public.workspace_for_key(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  found public.api_keys;
begin
  select * into found from public.api_keys k
  where k.token_sha = encode(extensions.digest(token, 'sha256'), 'hex')
    and k.revoked_at is null;

  if found.id is null then
    return null;
  end if;

  update public.api_keys set last_used_at = now() where id = found.id;
  return found.workspace_id;
end;
$$;

revoke all on function public.workspace_for_key(text) from public, authenticated, anon;
