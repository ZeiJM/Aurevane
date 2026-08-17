begin;

create table app_private.wayfarers_practice_window_configs (
  version integer primary key,
  short_seconds bigint not null,
  overnight_seconds bigint not null,
  extended_seconds bigint not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint wayfarers_practice_window_configs_version_positive check (version > 0),
  constraint wayfarers_practice_window_configs_positive check (
    short_seconds > 0 and overnight_seconds > 0 and extended_seconds > 0
  ),
  constraint wayfarers_practice_window_configs_order check (
    short_seconds < overnight_seconds and overnight_seconds < extended_seconds
  )
);

comment on table app_private.wayfarers_practice_window_configs is
  'Versioned server-only planned Wayfarer Practice duration tuning. Phase 1 exposes exactly Short, Overnight, and Extended.';

insert into app_private.wayfarers_practice_window_configs (
  version,
  short_seconds,
  overnight_seconds,
  extended_seconds
)
values (1, 10800, 28800, 86400);

revoke all on table app_private.wayfarers_practice_window_configs from public;
revoke all on table app_private.wayfarers_practice_window_configs from anon;
revoke all on table app_private.wayfarers_practice_window_configs from authenticated;
grant select on table app_private.wayfarers_practice_window_configs to service_role;

alter table app_private.wayfarers_practice_state
  add column planned_window text,
  add column planned_window_config_version integer references app_private.wayfarers_practice_window_configs(version),
  add column planned_window_seconds bigint,
  add column plan_set_at timestamptz;

alter table app_private.wayfarers_practice_state
  add constraint wayfarers_practice_state_planned_window check (
    planned_window is null or planned_window in ('short', 'overnight', 'extended')
  ),
  add constraint wayfarers_practice_state_plan_consistent check (
    (
      planned_window is null
      and planned_window_config_version is null
      and planned_window_seconds is null
      and plan_set_at is null
    )
    or (
      planned_window is not null
      and planned_window_config_version is not null
      and planned_window_seconds > 0
      and plan_set_at is not null
    )
  );

alter table app_private.training_reports
  add column practice_source text,
  add column planned_window text,
  add column planned_window_config_version integer references app_private.wayfarers_practice_window_configs(version),
  add column planned_window_seconds bigint,
  add column planned_elapsed_seconds bigint,
  add column balanced_fallback_seconds bigint;

update app_private.training_reports
set
  practice_source = 'automatic_balanced',
  planned_elapsed_seconds = 0,
  balanced_fallback_seconds = elapsed_seconds
where practice_source is null;

alter table app_private.training_reports
  alter column practice_source set not null,
  alter column planned_elapsed_seconds set not null,
  alter column balanced_fallback_seconds set not null,
  add constraint training_reports_practice_source check (
    practice_source in ('automatic_balanced', 'planned_balanced')
  ),
  add constraint training_reports_planned_window check (
    planned_window is null or planned_window in ('short', 'overnight', 'extended')
  ),
  add constraint training_reports_plan_seconds_nonnegative check (
    planned_elapsed_seconds >= 0 and balanced_fallback_seconds >= 0
  ),
  add constraint training_reports_plan_provenance_consistent check (
    (
      practice_source = 'automatic_balanced'
      and planned_window is null
      and planned_window_config_version is null
      and planned_window_seconds is null
      and planned_elapsed_seconds = 0
      and balanced_fallback_seconds = elapsed_seconds
    )
    or (
      practice_source = 'planned_balanced'
      and planned_window is not null
      and planned_window_config_version is not null
      and planned_window_seconds > 0
      and planned_elapsed_seconds = least(elapsed_seconds, planned_window_seconds)
      and balanced_fallback_seconds = greatest(0::bigint, elapsed_seconds - planned_window_seconds)
    )
  );

create or replace function public.materialize_training_report_v2(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  report_id uuid,
  character_id uuid,
  user_id uuid,
  focus text,
  config_version integer,
  practice_source text,
  planned_window text,
  planned_window_config_version integer,
  planned_window_seconds bigint,
  planned_elapsed_seconds bigint,
  balanced_fallback_seconds bigint,
  window_started_at timestamptz,
  window_ended_at timestamptz,
  elapsed_seconds bigint,
  credited_direct_seconds bigint,
  full_rate_seconds bigint,
  reduced_rate_seconds bigint,
  requested_character_xp bigint,
  direct_xp_cap_reached boolean,
  rested_momentum_seconds bigint,
  rested_momentum_gain integer,
  rested_momentum_cap_reached boolean,
  status text,
  created_at timestamptz,
  claimed_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_now timestamptz := clock_timestamp();
  v_character public.characters%rowtype;
  v_state app_private.wayfarers_practice_state%rowtype;
  v_config app_private.wayfarers_practice_configs%rowtype;
  v_pending app_private.training_reports%rowtype;
  v_report_id uuid := gen_random_uuid();
  v_window_start timestamptz;
  v_elapsed_seconds bigint;
  v_full_rate_seconds bigint;
  v_reduced_rate_seconds bigint;
  v_credited_direct_seconds bigint;
  v_requested_character_xp bigint;
  v_rested_momentum_seconds bigint;
  v_rested_momentum_gain integer;
  v_practice_source text;
  v_planned_elapsed_seconds bigint;
  v_balanced_fallback_seconds bigint;
begin
  select *
  into v_character
  from public.characters
  where id = p_character_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select *
  into v_state
  from app_private.wayfarers_practice_state
  where character_id = v_character.id
  for update;

  if not found then
    insert into app_private.wayfarers_practice_state (
      character_id,
      focus,
      config_version,
      last_active_at,
      practice_claimed_through_at,
      rested_momentum_balance,
      created_at,
      updated_at
    )
    values (
      v_character.id,
      'balanced',
      1,
      v_now,
      v_now,
      0,
      v_now,
      v_now
    )
    returning * into v_state;

    update public.characters set last_active_at = v_now where id = v_character.id;
    return;
  end if;

  select *
  into v_config
  from app_private.wayfarers_practice_configs
  where version = v_state.config_version;

  if not found or v_config.focus <> v_state.focus then
    raise exception using errcode = 'P0001', message = 'WAYFARERS_PRACTICE_CONFIG_UNAVAILABLE';
  end if;

  select *
  into v_pending
  from app_private.training_reports
  where character_id = v_character.id
    and status = 'pending'
  order by created_at
  limit 1
  for update;

  if found then
    update app_private.wayfarers_practice_state
    set last_active_at = v_now, updated_at = v_now
    where character_id = v_character.id;
    update public.characters set last_active_at = v_now where id = v_character.id;

    return query
    select
      report.id,
      report.character_id,
      report.user_id,
      report.focus,
      report.config_version,
      report.practice_source,
      report.planned_window,
      report.planned_window_config_version,
      report.planned_window_seconds,
      report.planned_elapsed_seconds,
      report.balanced_fallback_seconds,
      report.window_started_at,
      report.window_ended_at,
      report.elapsed_seconds,
      report.credited_direct_seconds,
      report.full_rate_seconds,
      report.reduced_rate_seconds,
      report.requested_character_xp,
      report.direct_xp_cap_reached,
      report.rested_momentum_seconds,
      report.rested_momentum_gain,
      report.rested_momentum_cap_reached,
      report.status,
      report.created_at,
      report.claimed_at
    from app_private.training_reports report
    where report.id = v_pending.id;
    return;
  end if;

  v_window_start := greatest(v_state.last_active_at, v_state.practice_claimed_through_at);
  v_elapsed_seconds := greatest(
    0::bigint,
    floor(extract(epoch from (v_now - v_window_start)))::bigint
  );
  v_full_rate_seconds := greatest(
    0::bigint,
    least(v_elapsed_seconds, v_config.full_rate_end_seconds) - v_config.minimum_offline_seconds
  );
  v_reduced_rate_seconds := greatest(
    0::bigint,
    least(v_elapsed_seconds, v_config.reduced_rate_end_seconds) - v_config.full_rate_end_seconds
  );
  v_credited_direct_seconds := v_full_rate_seconds + v_reduced_rate_seconds;
  v_requested_character_xp := least(
    (
      (v_full_rate_seconds * v_config.full_rate_xp_per_hour) / 3600::bigint
      + (v_reduced_rate_seconds * v_config.reduced_rate_xp_per_hour) / 3600::bigint
    ),
    v_config.direct_xp_cap
  );
  v_rested_momentum_seconds := greatest(
    0::bigint,
    least(v_elapsed_seconds, v_config.rested_momentum_end_seconds) - v_config.reduced_rate_end_seconds
  );
  v_rested_momentum_gain := least(
    (v_rested_momentum_seconds / v_config.rested_momentum_seconds_per_unit)::integer,
    v_config.rested_momentum_cap
  );

  update app_private.wayfarers_practice_state
  set last_active_at = v_now, updated_at = v_now
  where character_id = v_character.id;
  update public.characters set last_active_at = v_now where id = v_character.id;

  if v_requested_character_xp = 0 and v_rested_momentum_gain = 0 then
    return;
  end if;

  if v_state.planned_window is null then
    v_practice_source := 'automatic_balanced';
    v_planned_elapsed_seconds := 0;
    v_balanced_fallback_seconds := v_elapsed_seconds;
  else
    v_practice_source := 'planned_balanced';
    v_planned_elapsed_seconds := least(v_elapsed_seconds, v_state.planned_window_seconds);
    v_balanced_fallback_seconds := greatest(0::bigint, v_elapsed_seconds - v_state.planned_window_seconds);
  end if;

  insert into app_private.training_reports (
    id,
    character_id,
    user_id,
    focus,
    config_version,
    practice_source,
    planned_window,
    planned_window_config_version,
    planned_window_seconds,
    planned_elapsed_seconds,
    balanced_fallback_seconds,
    window_started_at,
    window_ended_at,
    elapsed_seconds,
    credited_direct_seconds,
    full_rate_seconds,
    reduced_rate_seconds,
    requested_character_xp,
    direct_xp_cap_reached,
    rested_momentum_seconds,
    rested_momentum_gain,
    rested_momentum_cap_reached,
    status,
    created_at,
    claimed_at
  )
  values (
    v_report_id,
    v_character.id,
    v_character.user_id,
    v_state.focus,
    v_state.config_version,
    v_practice_source,
    v_state.planned_window,
    v_state.planned_window_config_version,
    v_state.planned_window_seconds,
    v_planned_elapsed_seconds,
    v_balanced_fallback_seconds,
    v_window_start,
    v_now,
    v_elapsed_seconds,
    v_credited_direct_seconds,
    v_full_rate_seconds,
    v_reduced_rate_seconds,
    v_requested_character_xp,
    v_requested_character_xp >= v_config.direct_xp_cap,
    v_rested_momentum_seconds,
    v_rested_momentum_gain,
    v_rested_momentum_gain >= v_config.rested_momentum_cap,
    'pending',
    v_now,
    null
  );

  if v_state.planned_window is not null then
    update app_private.wayfarers_practice_state
    set
      planned_window = null,
      planned_window_config_version = null,
      planned_window_seconds = null,
      plan_set_at = null,
      updated_at = v_now
    where character_id = v_character.id;
  end if;

  return query
  select
    report.id,
    report.character_id,
    report.user_id,
    report.focus,
    report.config_version,
    report.practice_source,
    report.planned_window,
    report.planned_window_config_version,
    report.planned_window_seconds,
    report.planned_elapsed_seconds,
    report.balanced_fallback_seconds,
    report.window_started_at,
    report.window_ended_at,
    report.elapsed_seconds,
    report.credited_direct_seconds,
    report.full_rate_seconds,
    report.reduced_rate_seconds,
    report.requested_character_xp,
    report.direct_xp_cap_reached,
    report.rested_momentum_seconds,
    report.rested_momentum_gain,
    report.rested_momentum_cap_reached,
    report.status,
    report.created_at,
    report.claimed_at
  from app_private.training_reports report
  where report.id = v_report_id;
end;
$$;

comment on function public.materialize_training_report_v2(uuid, uuid) is
  'Lazily freezes one server-authoritative Training Report with prospective one-absence plan provenance and Balanced fallback.';

revoke all on function public.materialize_training_report_v2(uuid, uuid) from public;
revoke all on function public.materialize_training_report_v2(uuid, uuid) from anon;
revoke all on function public.materialize_training_report_v2(uuid, uuid) from authenticated;
grant execute on function public.materialize_training_report_v2(uuid, uuid) to service_role;

create or replace function public.get_wayfarers_practice_status_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  character_id uuid,
  user_id uuid,
  focus text,
  config_version integer,
  minimum_offline_seconds bigint,
  rested_momentum_balance integer,
  planned_window text,
  planned_window_config_version integer,
  planned_window_seconds bigint,
  plan_set_at timestamptz,
  short_window_seconds bigint,
  overnight_window_seconds bigint,
  extended_window_seconds bigint,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_now timestamptz := clock_timestamp();
  v_character public.characters%rowtype;
  v_state app_private.wayfarers_practice_state%rowtype;
  v_config app_private.wayfarers_practice_configs%rowtype;
  v_window_config app_private.wayfarers_practice_window_configs%rowtype;
begin
  select * into v_character
  from public.characters
  where id = p_character_id and user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select * into v_state
  from app_private.wayfarers_practice_state
  where character_id = v_character.id;

  if not found then
    raise exception using errcode = 'P0001', message = 'WAYFARERS_PRACTICE_STATE_UNAVAILABLE';
  end if;

  select * into v_config
  from app_private.wayfarers_practice_configs
  where version = v_state.config_version;

  select * into v_window_config
  from app_private.wayfarers_practice_window_configs
  order by version desc
  limit 1;

  if not found or v_config.version is null then
    raise exception using errcode = 'P0001', message = 'WAYFARERS_PRACTICE_CONFIG_UNAVAILABLE';
  end if;

  return query select
    v_character.id,
    v_character.user_id,
    v_state.focus,
    v_state.config_version,
    v_config.minimum_offline_seconds,
    v_state.rested_momentum_balance,
    v_state.planned_window,
    v_state.planned_window_config_version,
    v_state.planned_window_seconds,
    v_state.plan_set_at,
    v_window_config.short_seconds,
    v_window_config.overnight_seconds,
    v_window_config.extended_seconds,
    v_now;
end;
$$;

revoke all on function public.get_wayfarers_practice_status_v1(uuid, uuid) from public;
revoke all on function public.get_wayfarers_practice_status_v1(uuid, uuid) from anon;
revoke all on function public.get_wayfarers_practice_status_v1(uuid, uuid) from authenticated;
grant execute on function public.get_wayfarers_practice_status_v1(uuid, uuid) to service_role;

create or replace function public.set_wayfarers_practice_plan_v1(
  p_actor_key text,
  p_command_name text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
  p_character_id uuid,
  p_planned_window text
)
returns table (
  character_id uuid,
  user_id uuid,
  planned_window text,
  planned_window_config_version integer,
  planned_window_seconds bigint,
  plan_set_at timestamptz,
  server_now timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_expected_command constant text := 'wayfarers_practice.set_plan.v1';
  v_now timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_character public.characters%rowtype;
  v_state app_private.wayfarers_practice_state%rowtype;
  v_window_config app_private.wayfarers_practice_window_configs%rowtype;
  v_planned_seconds bigint;
begin
  if p_command_name is null
    or p_command_name <> v_expected_command
    or p_actor_key is null
    or p_actor_key <> 'user:' || p_user_id::text
    or char_length(p_actor_key) not between 1 and 160
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160
    or p_planned_window not in ('short', 'overnight', 'extended') then
    raise exception using errcode = '22023', message = 'Practice plan authority is invalid';
  end if;

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  )
  values (
    p_actor_key,
    v_expected_command,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object('pending', true)
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select * into v_existing
    from app_private.idempotency_records
    where actor_key = p_actor_key
      and command_name = v_expected_command
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using errcode = '40001', message = 'idempotency record unavailable after conflict';
    end if;
    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using errcode = '22023', message = 'idempotency key reused with a different request fingerprint';
    end if;
    if coalesce((v_existing.result ->> 'pending')::boolean, false) then
      raise exception using errcode = '40001', message = 'idempotent Practice plan result unavailable';
    end if;

    return query select
      (v_existing.result ->> 'character_id')::uuid,
      (v_existing.result ->> 'user_id')::uuid,
      v_existing.result ->> 'planned_window',
      (v_existing.result ->> 'planned_window_config_version')::integer,
      (v_existing.result ->> 'planned_window_seconds')::bigint,
      (v_existing.result ->> 'plan_set_at')::timestamptz,
      (v_existing.result ->> 'server_now')::timestamptz,
      true;
    return;
  end if;

  select * into v_character
  from public.characters
  where id = p_character_id and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select * into v_state
  from app_private.wayfarers_practice_state
  where character_id = v_character.id
  for update;

  if not found then
    insert into app_private.wayfarers_practice_state (
      character_id,
      focus,
      config_version,
      last_active_at,
      practice_claimed_through_at,
      rested_momentum_balance,
      created_at,
      updated_at
    )
    values (v_character.id, 'balanced', 1, v_now, v_now, 0, v_now, v_now)
    returning * into v_state;
  end if;

  select * into v_window_config
  from app_private.wayfarers_practice_window_configs
  order by version desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'WAYFARERS_PRACTICE_WINDOW_CONFIG_UNAVAILABLE';
  end if;

  v_planned_seconds := case p_planned_window
    when 'short' then v_window_config.short_seconds
    when 'overnight' then v_window_config.overnight_seconds
    when 'extended' then v_window_config.extended_seconds
    else null
  end;

  update app_private.wayfarers_practice_state
  set
    planned_window = p_planned_window,
    planned_window_config_version = v_window_config.version,
    planned_window_seconds = v_planned_seconds,
    plan_set_at = v_now,
    last_active_at = v_now,
    updated_at = v_now
  where character_id = v_character.id;

  update public.characters set last_active_at = v_now where id = v_character.id;

  update app_private.idempotency_records
  set result = jsonb_build_object(
    'character_id', v_character.id,
    'user_id', v_character.user_id,
    'planned_window', p_planned_window,
    'planned_window_config_version', v_window_config.version,
    'planned_window_seconds', v_planned_seconds,
    'plan_set_at', v_now,
    'server_now', v_now
  )
  where actor_key = p_actor_key
    and command_name = v_expected_command
    and idempotency_key = p_idempotency_key;

  return query select
    v_character.id,
    v_character.user_id,
    p_planned_window,
    v_window_config.version,
    v_planned_seconds,
    v_now,
    v_now,
    false;
end;
$$;

comment on function public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text) is
  'Idempotently sets one prospective Short, Overnight, or Extended Balanced Practice plan for the next meaningful absence without accepting client timestamps or reward values.';

revoke all on function public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text) from public;
revoke all on function public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text) from anon;
revoke all on function public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text) from authenticated;
grant execute on function public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text) to service_role;

commit;
