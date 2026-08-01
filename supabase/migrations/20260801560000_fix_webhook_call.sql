-- Two things wrong with the first webhook trigger ---------------------------------------------
--
-- One: pg_net puts its functions in a schema called `net` whatever schema the extension is
-- created in. The trigger called extensions.http_post, which does not exist, so with a webhook
-- registered every insert and update of a record raised — the door being open broke the room.
--
-- Two, and worse in principle: a webhook is somebody else's URL. Nothing about it should be able
-- to stop work being saved. Sending is now wrapped, so a hook that is broken, or an extension
-- that is missing, costs a log line and nothing else.

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

    begin
      perform net.http_post(
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
    exception when others then
      -- The write goes through regardless. A hook nobody can reach is a hook nobody hears from.
      raise warning 'webhook % could not be sent: %', hook.id, sqlerrm;
    end;
  end loop;

  return null;
end;
$$;
