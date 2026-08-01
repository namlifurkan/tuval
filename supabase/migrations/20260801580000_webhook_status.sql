-- Did it arrive? ---------------------------------------------------------------------------------
-- Sending is asynchronous, so the trigger cannot know how it went. What it can do is remember
-- which request it made, and that is enough for somebody looking at the settings page to be told
-- afterwards whether the far end answered.
--
-- pg_net keeps its responses for a few hours and then prunes them, so this is "how the last one
-- went", not a delivery log. A hook that has never answered and a hook nobody has poked since
-- yesterday look the same, which is honest: neither is evidence of anything.

alter table public.webhooks add column if not exists last_request_id bigint;

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

-- Reading pg_net's own table needs more than an ordinary account has, so this is the one thing
-- allowed to look, and it only ever fills in hooks the caller may already see.
create or replace function public.refresh_webhooks()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.webhooks w
  set last_status = r.status_code
  from net._http_response r
  where r.id = w.last_request_id
    and w.last_status is distinct from r.status_code
    and public.can_write_workspace(w.workspace_id);
end;
$$;

revoke all on function public.refresh_webhooks() from public;
grant execute on function public.refresh_webhooks() to authenticated;
