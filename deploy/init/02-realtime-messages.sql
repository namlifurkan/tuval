-- The table the private channel's policies are written against ------------------------------------
-- Tuval's board channel is private, and a private channel is one whose messages are filtered by
-- row policies — the same can_read_board / can_write_board every table uses. Those policies need
-- something to sit on.
--
-- On the hosted service this table is part of the platform rather than of any migration, which is
-- why the schema assumes it and does not create it. Assembling the platform by hand means
-- creating it by hand.

create schema if not exists realtime;

create table if not exists realtime.messages (
  topic       text not null,
  extension   text not null,
  payload     jsonb,
  event       text,
  private     boolean default false,
  inserted_at timestamp not null default now(),
  updated_at  timestamp not null default now(),
  id          uuid not null default extensions.gen_random_uuid(),
  primary key (id, inserted_at)
) partition by range (inserted_at);

-- Upstream partitions by day and has a janitor drop the old ones. An install without that job
-- still needs somewhere for today's row to land, and one default partition is the whole of it.
create table if not exists realtime.messages_default
  partition of realtime.messages default;

alter table realtime.messages enable row level security;

-- Which channel the request is for. The policies read it to decide, so it answers from the
-- setting the server puts there rather than from anything the caller sends.
create or replace function realtime.topic()
returns text
language sql
stable
as $$ select nullif(current_setting('realtime.topic', true), '')::text $$;

grant usage on schema realtime to postgres, anon, authenticated, service_role;
grant select, insert, update, delete on realtime.messages to postgres, anon, authenticated, service_role;
