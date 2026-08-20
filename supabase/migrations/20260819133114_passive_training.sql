begin;

-- A2 replaces automatic offline accrual with an explicit server-timed Passive Training session.
-- Existing frozen reports remain valid and claimable under their legacy provenance values.

alter table app_private.training_reports
  drop constraint if exists training_reports_practice_source;

alter table app_private.training_reports
  add constraint training_reports_practice_source check (
    practice_source in ('automatic_balanced', 'planned_balanced', 'passive_training')
  );

alter table app_private.training_reports
  drop constraint if exists training_reports_plan_provenance_consistent;

alter table app_private.training_reports
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
    or (
      practice_source = 'passive_training'
      and planned_window is not null
      and planned_window_config_version is not null
      and planned_window_seconds > 0
      and elapsed_seconds = planned_window_seconds
      and planned_elapsed_seconds = planned_window_seconds
      and balanced_fallback_seconds = 0
    )
  );

create table if not exists app_private.passive_training_rate_configs (
  version integer primary key,
  short_xp_per_hour bigint not null,
  medium_xp_per_hour bigint not null,
  extended_xp_per_hour bigint not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint passive_training_rate_configs_positive check (
    version > 0
    and short_xp_per_hour > 0
    and medium_xp_per_hour > 0
    and extended_xp_per_hour > 0
  ),
  constraint passive_training_rate_configs_efficiency_order check (
    short_xp_per_hour > medium_xp_per_hour
    and medium_xp_per_hour > extended_xp_per_hour
  )
);

insert into app_private.passive_training_rate_configs (
  version,
  short_xp_per_hour,
  medium_xp_per_hour,
  extended_xp_per_hour
)
values (1, 10, 7, 4)
on conflict (version) do update set
  short_xp_per_hour = excluded.short_xp_per_hour,
  medium_xp_per_hour = excluded.medium_xp_per_hour,
  extended_xp_per_hour = excluded.extended_xp_per_hour;

revoke all on table app_private.passive_training_rate_configs from public, anon, authenticated;
grant select on table app_private.passive_training_rate_configs to service_role;

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
  v_pending app_private.training_reports%rowtype;
  v_rates app_private.passive_training_rate_configs%rowtype;
  v_end timestamptz;
  v_xp_per_hour bigint;
  v_requested_xp bigint;
  v_report_id uuid := gen_random_uuid();
begin
  select * into v_character
  from public.characters
  where id = p_character_id and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

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
  on conflict (character_id) do nothing;

  select * into v_state
  from app_private.wayfarers_practice_state
  where character_id = v_character.id
  for update;

  select * into v_pending
  from app_private.training_reports
  where character_id = v_character.id and status = 'pending'
  order by created_at
  limit 1
  for update;

  if found then
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

  -- No explicit plan means no training and therefore no report.
  if v_state.planned_window is null
    or v_state.planned_window_seconds is null
    or v_state.plan_set_at is null then
    return;
  end if;

  v_end := v_state.plan_set_at + (v_state.planned_window_seconds * interval '1 second');
  if v_now < v_end then
    return;
  end if;

  select * into v_rates
  from app_private.passive_training_rate_configs
  order by version desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_CONFIG_UNAVAILABLE';
  end if;

  v_xp_per_hour := case v_state.planned_window
    when 'short' then v_rates.short_xp_per_hour
    when 'overnight' then v_rates.medium_xp_per_hour
    when 'extended' then v_rates.extended_xp_per_hour
    else null
  end;

  if v_xp_per_hour is null then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_PLAN_INVALID';
  end if;

  v_requested_xp := (v_state.planned_window_seconds * v_xp_per_hour) / 3600::bigint;

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
    'passive_training',
    v_state.planned_window,
    v_state.planned_window_config_version,
    v_state.planned_window_seconds,
    v_state.planned_window_seconds,
    0,
    v_state.plan_set_at,
    v_end,
    v_state.planned_window_seconds,
    v_state.planned_window_seconds,
    v_state.planned_window_seconds,
    0,
    v_requested_xp,
    false,
    0,
    0,
    false,
    'pending',
    v_now,
    null
  );

  update app_private.wayfarers_practice_state
  set
    planned_window = null,
    planned_window_config_version = null,
    planned_window_seconds = null,
    plan_set_at = null,
    last_active_at = v_now,
    updated_at = v_now
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
  where report.id = v_report_id;
end;
$$;

comment on function public.materialize_training_report_v2(uuid, uuid) is
  'Materializes only completed explicit Passive Training plans. Browser presence or absence is not a reward input.';

revoke all on function public.materialize_training_report_v2(uuid, uuid) from public, anon, authenticated;
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
  v_window_config app_private.wayfarers_practice_window_configs%rowtype;
begin
  select * into v_character
  from public.characters
  where id = p_character_id and user_id = p_user_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

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
  on conflict (character_id) do nothing;

  select * into v_state
  from app_private.wayfarers_practice_state
  where character_id = v_character.id;

  select * into v_window_config
  from app_private.wayfarers_practice_window_configs
  order by version desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_CONFIG_UNAVAILABLE';
  end if;

  return query select
    v_character.id,
    v_character.user_id,
    v_state.focus,
    v_state.config_version,
    0::bigint,
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

revoke all on function public.get_wayfarers_practice_status_v1(uuid, uuid) from public, anon, authenticated;
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
    raise exception using errcode = '22023', message = 'Passive Training plan authority is invalid';
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
      raise exception using errcode = '40001', message = 'idempotent Passive Training result unavailable';
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
  on conflict (character_id) do nothing;

  select * into v_state
  from app_private.wayfarers_practice_state
  where character_id = v_character.id
  for update;

  if v_state.planned_window is not null then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_ACTIVE';
  end if;

  select * into v_window_config
  from app_private.wayfarers_practice_window_configs
  order by version desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_CONFIG_UNAVAILABLE';
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
  'Starts one explicit server-timed Passive Training plan. No browser-away or client timestamp input controls rewards.';

revoke all on function public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text)
  to service_role;

create or replace function public.stop_passive_training_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  stopped boolean,
  server_now timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_now timestamptz := clock_timestamp();
  v_state app_private.wayfarers_practice_state%rowtype;
begin
  if not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select * into v_state
  from app_private.wayfarers_practice_state
  where character_id = p_character_id
  for update;

  if not found or v_state.planned_window is null then
    return query select false, v_now;
    return;
  end if;

  update app_private.wayfarers_practice_state
  set
    planned_window = null,
    planned_window_config_version = null,
    planned_window_seconds = null,
    plan_set_at = null,
    last_active_at = v_now,
    updated_at = v_now
  where character_id = p_character_id;

  update public.characters set last_active_at = v_now where id = p_character_id;
  return query select true, v_now;
end;
$$;

revoke all on function public.stop_passive_training_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.stop_passive_training_v1(uuid, uuid) to service_role;

-- Keep the stored account defaults aligned with the six visible command buttons.
alter table public.player_profiles
  alter column combat_keybinds set default
  '{"inspect":{"code":"Digit1","shift":false},"move":{"code":"Digit2","shift":false},"basicAttack":{"code":"Digit3","shift":false},"guard":{"code":"Digit4","shift":false},"recover":{"code":"Digit5","shift":false},"endTurn":{"code":"Space","shift":false},"confirm":{"code":"Enter","shift":false},"cancel":{"code":"Escape","shift":false},"faceNorth":{"code":"KeyW","shift":false},"faceWest":{"code":"KeyA","shift":false},"faceSouth":{"code":"KeyS","shift":false},"faceEast":{"code":"KeyD","shift":false},"nextTarget":{"code":"Tab","shift":false},"previousTarget":{"code":"Tab","shift":true},"combatLog":{"code":"KeyL","shift":false}}'::jsonb;

update public.player_profiles
set combat_keybinds = combat_keybinds || '{"recover":{"code":"Digit5","shift":false}}'::jsonb
where not (combat_keybinds ? 'recover');

commit;
