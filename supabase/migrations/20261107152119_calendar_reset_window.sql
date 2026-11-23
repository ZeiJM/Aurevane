begin;

-- A calendar window is defined by local civil boundaries, not by a fixed
-- elapsed duration or the database session timezone. Weeks start on Monday.
create function app_private.calendar_reset_window_v1(
  p_at timestamptz, p_period text, p_zone text, p_reset_minute integer
)
returns table (starts_at timestamptz, resets_at timestamptz)
language plpgsql stable strict set search_path = '' as $$
declare
  reset_offset interval;
  period_length interval;
  local_start timestamp;
begin
  if not isfinite(p_at) or p_period not in ('day','week') or p_reset_minute not between 0 and 1439 then
    raise exception using errcode = '22023', message = 'INVALID_CALENDAR_RESET_WINDOW';
  end if;

  reset_offset := make_interval(mins => p_reset_minute);
  period_length := case p_period when 'day' then interval '1 day' else interval '1 week' end;
  local_start := date_trunc(p_period, (p_at at time zone p_zone) - reset_offset) + reset_offset;
  starts_at := local_start at time zone p_zone;

  -- PostgreSQL resolves a forward gap by moving the reset forward by the gap
  -- and a backward fold by choosing the later occurrence. Check the resolved
  -- instant, since local clock ordering alone can disagree at these seams.
  if starts_at > p_at then
    local_start := local_start - period_length;
    starts_at := local_start at time zone p_zone;
  end if;
  loop
    local_start := local_start + period_length;
    resets_at := local_start at time zone p_zone;
    exit when resets_at > p_at;
    -- A skipped civil date can resolve to the same instant as the next date.
    starts_at := resets_at;
  end loop;
  return next;
end;
$$;
revoke all on function app_private.calendar_reset_window_v1(timestamptz,text,text,integer)
  from public, anon, authenticated, service_role;

-- Keep the existing account and selected-character entry points and ACLs.
-- Both report the same Monday 00:00 UTC window the cleanup uses.
do $migration$
declare
  reader record;
  body text;
  patched integer := 0;
  declaration constant text := $from$v_week timestamptz:=date_trunc('week',statement_timestamp() at time zone 'UTC') at time zone 'UTC';$from$;
  reset_result constant text := $from$'resetsAt',v_week+interval '7 days'$from$;
  week_query_anchor constant text := '  -- Filtering by the UTC epoch';
begin
  for reader in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'read_master_panel_activity_v1'
  loop
    body := pg_get_functiondef(reader.oid);
    if strpos(body, declaration) = 0 or strpos(body, reset_result) = 0
      or strpos(body, week_query_anchor) = 0 then
      raise exception 'MASTER_ACTIVITY_RESET_PREDECESSOR_MISSING: %', reader.oid::regprocedure;
    end if;
    body := replace(body, declaration, 'v_week timestamptz; v_reset timestamptz;');
    body := replace(body, reset_result, $to$'resetsAt',v_reset$to$);
    body := replace(body, week_query_anchor, $query$  select starts_at, resets_at into v_week, v_reset
  from app_private.calendar_reset_window_v1(statement_timestamp(), 'week', 'UTC', 0);
$query$ || week_query_anchor);
    execute body;
    patched := patched + 1;
  end loop;
  if patched = 0 then raise exception 'MASTER_ACTIVITY_RESET_PREDECESSOR_MISSING'; end if;
end;
$migration$;

create or replace function app_private.clear_master_panel_activity_v1()
returns void language sql security definer set search_path = '' as $$
  delete from app_private.master_panel_activity where occurred_at < (
    select starts_at from app_private.calendar_reset_window_v1(statement_timestamp(), 'week', 'UTC', 0)
  );
$$;

commit;
