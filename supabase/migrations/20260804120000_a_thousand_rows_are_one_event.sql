-- Webhooks fired once per row. A spreadsheet of eight thousand rows queued eight thousand
-- requests, each with its own body, signature and write back to the hook — the fan-out came from
-- the write path, not the read path, which is why paging the reads did not help it.
--
-- The sending itself is already asynchronous and already survives a hook nobody can reach; that
-- was fixed twice before this. What is left is the count, and the count is what a statement
-- trigger answers: a handful of rows still arrive one event each, because that is what an
-- integration expects when somebody edits something, and past that an import is announced as the
-- one thing it was, carrying how many rows it held.
--
-- Silence would have been simpler and would have repeated the mistake the importer just stopped
-- making: a consumer told nothing cannot tell the difference between nothing happening and
-- everything being dropped.

create or replace function public.fire_webhooks()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  row_now public.records;
  hook    public.webhooks;
  body    text;
  sent    bigint;
  many    int;
  mine    int;
  -- Above this, a statement is a bulk write rather than somebody typing.
  bulk    constant int := 25;
begin
  select count(*) into many from changed;
  if many = 0 then return null; end if;

  for hook in
    select * from public.webhooks w
    where w.active
      and exists (
        select 1 from changed c
        where c.workspace_id = w.workspace_id and c.kind = any (w.kinds)
      )
  loop
    select count(*) into mine from changed c
    where c.workspace_id = hook.workspace_id and c.kind = any (hook.kinds);

    begin
      if mine > bulk then
        body := json_build_object(
          'event', 'bulk',
          'operation', lower(tg_op),
          'at', now(),
          'records', mine
        )::text;

        sent := net.http_post(
          url := hook.url,
          body := body::jsonb,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Tuval-Event', 'bulk',
            'X-Tuval-Signature',
            'sha256=' || encode(extensions.hmac(body, hook.secret, 'sha256'), 'hex')
          )
        );
      else
        for row_now in
          select * from changed c
          where c.workspace_id = hook.workspace_id and c.kind = any (hook.kinds)
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

          sent := net.http_post(
            url := hook.url,
            body := body::jsonb,
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'X-Tuval-Event', lower(tg_op),
              'X-Tuval-Signature',
              'sha256=' || encode(extensions.hmac(body, hook.secret, 'sha256'), 'hex')
            )
          );
        end loop;
      end if;

      update public.webhooks
      set last_fired_at = now(), last_request_id = sent, last_status = null
      where id = hook.id;
    exception when others then
      -- The write goes through regardless. A hook nobody can reach is a hook nobody hears from.
      raise warning 'webhook % could not be sent: %', hook.id, sqlerrm;
    end;
  end loop;

  return null;
end;
$$;

-- A statement trigger reads its rows from a transition table, and Postgres allows a transition
-- table on one event only, so the three operations are three triggers naming the same table.
drop trigger if exists records_fire_webhooks on public.records;
drop trigger if exists records_fire_webhooks_insert on public.records;
drop trigger if exists records_fire_webhooks_update on public.records;
drop trigger if exists records_fire_webhooks_delete on public.records;

create trigger records_fire_webhooks_insert after insert on public.records
  referencing new table as changed
  for each statement execute function public.fire_webhooks();

create trigger records_fire_webhooks_update after update on public.records
  referencing new table as changed
  for each statement execute function public.fire_webhooks();

create trigger records_fire_webhooks_delete after delete on public.records
  referencing old table as changed
  for each statement execute function public.fire_webhooks();
