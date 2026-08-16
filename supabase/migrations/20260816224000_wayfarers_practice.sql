begin;

create table app_private.wayfarers_practice_configs (
  version integer primary key,
  focus text not null,
  minimum_offline_seconds bigint not null,
  full_rate_end_seconds bigint not null,
  reduced_rate_end_seconds bigint not null,
  rested_momentum_end_seconds bigint not null,
  full_rate_xp_per_hour bigint not null,
  reduced_rate_xp_per_hour bigint not null,
  direct_xp_cap bigint not null,
  rested_momentum_seconds_per_unit bigint not null,
  rested_momentum_cap integer not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint wayfarers_practice_configs_version_positive check (version > 0),
  constraint wayfarers_practice_configs_focus check (focus = 'balanced'),
  constraint wayfarers_practice_configs_minimum_nonnegative check (minimum_offline_seconds >= 0),
  constraint wayfarers_practice_configs_window_order check (
    full_rate_end_seconds > minimum_offline_seconds
    and reduced_rate_end_seconds > full_rate_end_seconds
    and rested_momentum_end_seconds > reduced_rate_end_seconds
  ),
  constraint wayfarers_practice_configs_rates_positive check (
    full_rate_xp_per_hour > 0
    and reduced_rate_xp_per_hour > 0
    and reduced_rate_xp_per_hour <= full_rate_xp_per_hour
  ),
  constraint wayfarers_practice_configs_caps_positive check (
    direct_xp_cap > 0
    and rested_momentum_seconds_per_unit > 0
    and rested_momentum_cap > 0
  )
);

comment on table app_private.wayfarers_practice_configs is
  'Versioned server-only Balanced Practice tuning. Phase 1 supports the balanced focus only.';

insert into app_private.wayfarers_practice_configs (
  version,
  focus,
  minimum_offline_seconds,
  full_rate_end_seconds,
  reduced_rate_end_seconds,
  rested_momentum_end_seconds,
  full_rate_xp_per_hour,
  reduced_rate_xp_per_hour,
  direct_xp_cap,
  rested_momentum_seconds_per_unit,
  rested_momentum_cap
)
values (
  1,
  'balanced',
  3600,
  86400,
  259200,
  1209600,
  8,
  4,
  376,
  7200,
  132
);

create table app_private.wayfarers_practice_state (
  character_id uuid primary key references public.characters(id) on delete cascade,
  focus text not null,
  config_version integer not null references app_private.wayfarers_practice_configs(version),
  last_active_at timestamptz not null,
  practice_claimed_through_at timestamptz not null,
  rested_momentum_balance integer not null default 0,
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  constraint wayfarers_practice_state_focus check (focus = 'balanced'),
  constraint wayfarers_practice_state_rested_nonnegative check (rested_momentum_balance >= 0),
  constraint wayfarers_practice_state_claim_boundary check (
    practice_claimed_through_at <= last_active_at
  )
);

comment on table app_private.wayfarers_practice_state is
  'Server-authoritative per-character Wayfarer activity/accrual boundary and stored Rested Momentum balance.';

create table app_private.training_reports (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  focus text not null,
  config_version integer not null references app_private.wayfarers_practice_configs(version),
  window_started_at timestamptz not null,
  window_ended_at timestamptz not null,
  elapsed_seconds bigint not null,
  credited_direct_seconds bigint not null,
  full_rate_seconds bigint not null,
  reduced_rate_seconds bigint not null,
  requested_character_xp bigint not null,
  direct_xp_cap_reached boolean not null,
  rested_momentum_seconds bigint not null,
  rested_momentum_gain integer not null,
  rested_momentum_cap_reached boolean not null,
  status text not null,
  created_at timestamptz not null,
  claimed_at timestamptz,
  constraint training_reports_focus check (focus = 'balanced'),
  constraint training_reports_window_order check (window_ended_at >= window_started_at),
  constraint training_reports_elapsed_nonnegative check (elapsed_seconds >= 0),
  constraint training_reports_direct_seconds_nonnegative check (
    credited_direct_seconds >= 0
    and full_rate_seconds >= 0
    and reduced_rate_seconds >= 0
    and credited_direct_seconds = full_rate_seconds + reduced_rate_seconds
  ),
  constraint training_reports_character_xp_nonnegative check (requested_character_xp >= 0),
  constraint training_reports_rested_nonnegative check (
    rested_momentum_seconds >= 0 and rested_momentum_gain >= 0
  ),
  constraint training_reports_status check (status in ('pending', 'claimed')),
  constraint training_reports_claimed_at_consistent check (
    (status = 'pending' and claimed_at is null)
    or (status = 'claimed' and claimed_at is not null)
  )
);

create unique index training_reports_one_pending_per_character_idx
  on app_private.training_reports (character_id)
  where status = 'pending';
create index training_reports_character_created_idx
  on app_private.training_reports (character_id, created_at desc);
create index training_reports_user_created_idx
  on app_private.training_reports (user_id, created_at desc);

comment on table app_private.training_reports is
  'Frozen server-generated Wayfarer Training Reports. A pending report is stable across refreshes until claimed.';

create table app_private.training_report_claims (
  report_id uuid primary key references app_private.training_reports(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  progression_cycle integer not null,
  curve_version integer not null references app_private.level_progression_curves(version),
  xp_grant_id uuid references app_private.character_xp_grants(id),
  requested_character_xp bigint not null,
  applied_character_xp bigint not null,
  xp_before bigint not null,
  xp_after bigint not null,
  level_before smallint not null,
  level_after smallint not null,
  reached_level smallint,
  rested_momentum_before integer not null,
  rested_momentum_applied integer not null,
  rested_momentum_after integer not null,
  claimed_at timestamptz not null,
  constraint training_report_claims_cycle_positive check (progression_cycle > 0),
  constraint training_report_claims_character_xp_range check (
    requested_character_xp >= 0
    and applied_character_xp >= 0
    and applied_character_xp <= requested_character_xp
  ),
  constraint training_report_claims_xp_monotonic check (
    xp_before >= 0 and xp_after >= xp_before
  ),
  constraint training_report_claims_level_range check (
    level_before between 1 and 100
    and level_after between level_before and 100
  ),
  constraint training_report_claims_reached_level_consistent check (
    (reached_level is null and level_after = level_before)
    or (reached_level = level_after and level_after > level_before)
  ),
  constraint training_report_claims_rested_consistent check (
    rested_momentum_before >= 0
    and rested_momentum_applied >= 0
    and rested_momentum_after = rested_momentum_before + rested_momentum_applied
  )
);

create index training_report_claims_character_claimed_idx
  on app_private.training_report_claims (character_id, claimed_at desc);

comment on table app_private.training_report_claims is
  'Append-only authoritative Training Report claim telemetry linking offline accrual to P1.5 XP provenance.';

revoke all on table app_private.wayfarers_practice_configs from public;
revoke all on table app_private.wayfarers_practice_configs from anon;
revoke all on table app_private.wayfarers_practice_configs from authenticated;
revoke all on table app_private.wayfarers_practice_state from public;
revoke all on table app_private.wayfarers_practice_state from anon;
revoke all on table app_private.wayfarers_practice_state from authenticated;
revoke all on table app_private.training_reports from public;
revoke all on table app_private.training_reports from anon;
revoke all on table app_private.training_reports from authenticated;
revoke all on table app_private.training_report_claims from public;
revoke all on table app_private.training_report_claims from anon;
revoke all on table app_private.training_report_claims from authenticated;
grant select on table app_private.wayfarers_practice_configs to service_role;
grant select on table app_private.wayfarers_practice_state to service_role;
grant select on table app_private.training_reports to service_role;
grant select on table app_private.training_report_claims to service_role;

create or replace function public.materialize_training_report_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  report_id uuid,
  character_id uuid,
  user_id uuid,
  focus text,
  config_version integer,
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
begin
  select *
  into v_character
  from public.characters
  where id = p_character_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CHARACTER_NOT_FOUND';
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
    );

    update public.characters
    set last_active_at = v_now
    where id = v_character.id;

    return;
  end if;

  select *
  into v_config
  from app_private.wayfarers_practice_configs
  where version = v_state.config_version;

  if not found or v_config.focus <> v_state.focus then
    raise exception using
      errcode = 'P0001',
      message = 'WAYFARERS_PRACTICE_CONFIG_UNAVAILABLE';
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
    set
      last_active_at = v_now,
      updated_at = v_now
    where character_id = v_character.id;

    update public.characters
    set last_active_at = v_now
    where id = v_character.id;

    return query
    select
      report.id,
      report.character_id,
      report.user_id,
      report.focus,
      report.config_version,
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

  v_window_start := greatest(
    v_state.last_active_at,
    v_state.practice_claimed_through_at
  );
  v_elapsed_seconds := greatest(
    0::bigint,
    floor(extract(epoch from (v_now - v_window_start)))::bigint
  );
  v_full_rate_seconds := greatest(
    0::bigint,
    least(v_elapsed_seconds, v_config.full_rate_end_seconds)
      - v_config.minimum_offline_seconds
  );
  v_reduced_rate_seconds := greatest(
    0::bigint,
    least(v_elapsed_seconds, v_config.reduced_rate_end_seconds)
      - v_config.full_rate_end_seconds
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
    least(v_elapsed_seconds, v_config.rested_momentum_end_seconds)
      - v_config.reduced_rate_end_seconds
  );
  v_rested_momentum_gain := least(
    (v_rested_momentum_seconds / v_config.rested_momentum_seconds_per_unit)::integer,
    v_config.rested_momentum_cap
  );

  update app_private.wayfarers_practice_state
  set
    last_active_at = v_now,
    updated_at = v_now
  where character_id = v_character.id;

  update public.characters
  set last_active_at = v_now
  where id = v_character.id;

  if v_requested_character_xp = 0 and v_rested_momentum_gain = 0 then
    return;
  end if;

  insert into app_private.training_reports (
    id,
    character_id,
    user_id,
    focus,
    config_version,
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

  return query
  select
    report.id,
    report.character_id,
    report.user_id,
    report.focus,
    report.config_version,
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

comment on function public.materialize_training_report_v1(uuid, uuid) is
  'Lazily evaluates server-authoritative absence time and freezes at most one pending Balanced Practice Training Report.';

revoke all on function public.materialize_training_report_v1(uuid, uuid) from public;
revoke all on function public.materialize_training_report_v1(uuid, uuid) from anon;
revoke all on function public.materialize_training_report_v1(uuid, uuid) from authenticated;
grant execute on function public.materialize_training_report_v1(uuid, uuid) to service_role;

create or replace function public.claim_training_report_v1(
  p_actor_key text,
  p_command_name text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
  p_character_id uuid,
  p_report_id uuid
)
returns table (
  report_id uuid,
  character_id uuid,
  user_id uuid,
  progression_cycle integer,
  curve_version integer,
  xp_grant_id uuid,
  requested_character_xp bigint,
  applied_character_xp bigint,
  xp_before bigint,
  xp_after bigint,
  level_before smallint,
  level_after smallint,
  reached_level smallint,
  rested_momentum_before integer,
  rested_momentum_applied integer,
  rested_momentum_after integer,
  claimed_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_expected_command constant text := 'wayfarers_practice.claim.v1';
  v_now timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_report app_private.training_reports%rowtype;
  v_existing_claim app_private.training_report_claims%rowtype;
  v_character public.characters%rowtype;
  v_state app_private.wayfarers_practice_state%rowtype;
  v_config app_private.wayfarers_practice_configs%rowtype;
  v_curve app_private.level_progression_curves%rowtype;
  v_resolved_before smallint;
  v_level_after smallint;
  v_max_xp bigint;
  v_applied_character_xp bigint;
  v_xp_after bigint;
  v_reached_level smallint;
  v_xp_grant_id uuid;
  v_elapsed_seconds bigint;
  v_rested_momentum_before integer;
  v_rested_momentum_applied integer;
  v_rested_momentum_after integer;
begin
  if p_command_name is null
    or p_command_name <> v_expected_command
    or p_actor_key is null
    or p_actor_key <> 'user:' || p_user_id::text
    or char_length(p_actor_key) not between 1 and 160
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160 then
    raise exception using
      errcode = '22023',
      message = 'Training Report claim authority is invalid';
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
    jsonb_build_object('report_id', p_report_id)
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select *
    into v_existing
    from app_private.idempotency_records
    where actor_key = p_actor_key
      and command_name = v_expected_command
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'idempotency record unavailable after conflict';
    end if;

    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using
        errcode = '22023',
        message = 'idempotency key reused with a different request fingerprint';
    end if;

    select *
    into v_existing_claim
    from app_private.training_report_claims
    where report_id = (v_existing.result ->> 'report_id')::uuid;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'idempotent Training Report claim result unavailable';
    end if;

    return query
    select
      claim.report_id,
      claim.character_id,
      claim.user_id,
      claim.progression_cycle,
      claim.curve_version,
      claim.xp_grant_id,
      claim.requested_character_xp,
      claim.applied_character_xp,
      claim.xp_before,
      claim.xp_after,
      claim.level_before,
      claim.level_after,
      claim.reached_level,
      claim.rested_momentum_before,
      claim.rested_momentum_applied,
      claim.rested_momentum_after,
      claim.claimed_at,
      true
    from app_private.training_report_claims claim
    where claim.report_id = v_existing_claim.report_id;
    return;
  end if;

  select *
  into v_report
  from app_private.training_reports
  where id = p_report_id
  for update;

  if not found
    or v_report.character_id <> p_character_id
    or v_report.user_id <> p_user_id then
    raise exception using
      errcode = 'P0001',
      message = 'TRAINING_REPORT_NOT_FOUND';
  end if;

  select *
  into v_character
  from public.characters
  where id = p_character_id
    and user_id = p_user_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CHARACTER_NOT_FOUND';
  end if;

  select *
  into v_state
  from app_private.wayfarers_practice_state
  where character_id = v_character.id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'WAYFARERS_PRACTICE_STATE_UNAVAILABLE';
  end if;

  if v_report.status = 'claimed' then
    select *
    into v_existing_claim
    from app_private.training_report_claims
    where report_id = v_report.id;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'claimed Training Report telemetry unavailable';
    end if;

    update app_private.wayfarers_practice_state
    set
      last_active_at = v_now,
      updated_at = v_now
    where character_id = v_character.id;

    update public.characters
    set last_active_at = v_now
    where id = v_character.id;

    return query
    select
      claim.report_id,
      claim.character_id,
      claim.user_id,
      claim.progression_cycle,
      claim.curve_version,
      claim.xp_grant_id,
      claim.requested_character_xp,
      claim.applied_character_xp,
      claim.xp_before,
      claim.xp_after,
      claim.level_before,
      claim.level_after,
      claim.reached_level,
      claim.rested_momentum_before,
      claim.rested_momentum_applied,
      claim.rested_momentum_after,
      claim.claimed_at,
      true
    from app_private.training_report_claims claim
    where claim.report_id = v_existing_claim.report_id;
    return;
  end if;

  select *
  into v_config
  from app_private.wayfarers_practice_configs
  where version = v_report.config_version;

  if not found or v_config.focus <> v_report.focus then
    raise exception using
      errcode = 'P0001',
      message = 'WAYFARERS_PRACTICE_CONFIG_UNAVAILABLE';
  end if;

  select curve.*
  into v_curve
  from app_private.progression_cycle_level_curves mapping
  join app_private.level_progression_curves curve
    on curve.version = mapping.curve_version
  where mapping.progression_cycle = v_character.progression_cycle;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROGRESSION_CURVE_UNAVAILABLE';
  end if;

  v_resolved_before := app_private.resolve_level_from_curve(
    v_character.xp,
    v_curve.cumulative_xp_by_level,
    v_curve.max_level
  );

  if v_resolved_before <> v_character.level then
    raise exception using
      errcode = 'P0001',
      message = 'CHARACTER_PROGRESSION_INCONSISTENT';
  end if;

  v_max_xp := v_curve.cumulative_xp_by_level[v_curve.max_level];
  if v_report.requested_character_xp > 0 then
    if v_character.xp >= v_max_xp then
      v_applied_character_xp := 0;
      v_xp_after := v_character.xp;
    else
      v_applied_character_xp := least(
        v_report.requested_character_xp,
        v_max_xp - v_character.xp
      );
      v_xp_after := v_character.xp + v_applied_character_xp;
    end if;

    v_level_after := app_private.resolve_level_from_curve(
      v_xp_after,
      v_curve.cumulative_xp_by_level,
      v_curve.max_level
    );
    v_reached_level := case
      when v_level_after > v_character.level then v_level_after
      else null
    end;
    v_xp_grant_id := gen_random_uuid();
    v_elapsed_seconds := greatest(
      0::bigint,
      floor(extract(epoch from (v_now - v_character.cycle_started_at)))::bigint
    );

    update public.characters
    set
      xp = v_xp_after,
      level = v_level_after,
      last_active_at = v_now
    where id = v_character.id;

    insert into app_private.character_xp_grants (
      id,
      character_id,
      progression_cycle,
      curve_version,
      authority_key,
      source_kind,
      source_id,
      reason_tag,
      requested_amount,
      applied_amount,
      xp_before,
      xp_after,
      level_before,
      level_after,
      reached_level,
      seconds_since_cycle_start,
      created_at
    )
    values (
      v_xp_grant_id,
      v_character.id,
      v_character.progression_cycle,
      v_curve.version,
      p_actor_key,
      'system',
      v_report.id::text,
      'wayfarers_practice.balanced.v1',
      v_report.requested_character_xp,
      v_applied_character_xp,
      v_character.xp,
      v_xp_after,
      v_character.level,
      v_level_after,
      v_reached_level,
      v_elapsed_seconds,
      v_now
    );
  else
    v_applied_character_xp := 0;
    v_xp_after := v_character.xp;
    v_level_after := v_character.level;
    v_reached_level := null;
    v_xp_grant_id := null;

    update public.characters
    set last_active_at = v_now
    where id = v_character.id;
  end if;

  v_rested_momentum_before := v_state.rested_momentum_balance;
  v_rested_momentum_applied := least(
    v_report.rested_momentum_gain,
    greatest(0, v_config.rested_momentum_cap - v_rested_momentum_before)
  );
  v_rested_momentum_after := v_rested_momentum_before + v_rested_momentum_applied;

  update app_private.wayfarers_practice_state
  set
    practice_claimed_through_at = greatest(
      practice_claimed_through_at,
      v_report.window_ended_at
    ),
    rested_momentum_balance = v_rested_momentum_after,
    last_active_at = v_now,
    updated_at = v_now
  where character_id = v_character.id;

  update app_private.training_reports
  set
    status = 'claimed',
    claimed_at = v_now
  where id = v_report.id;

  insert into app_private.training_report_claims (
    report_id,
    character_id,
    user_id,
    progression_cycle,
    curve_version,
    xp_grant_id,
    requested_character_xp,
    applied_character_xp,
    xp_before,
    xp_after,
    level_before,
    level_after,
    reached_level,
    rested_momentum_before,
    rested_momentum_applied,
    rested_momentum_after,
    claimed_at
  )
  values (
    v_report.id,
    v_character.id,
    v_character.user_id,
    v_character.progression_cycle,
    v_curve.version,
    v_xp_grant_id,
    v_report.requested_character_xp,
    v_applied_character_xp,
    v_character.xp,
    v_xp_after,
    v_character.level,
    v_level_after,
    v_reached_level,
    v_rested_momentum_before,
    v_rested_momentum_applied,
    v_rested_momentum_after,
    v_now
  );

  return query
  select
    claim.report_id,
    claim.character_id,
    claim.user_id,
    claim.progression_cycle,
    claim.curve_version,
    claim.xp_grant_id,
    claim.requested_character_xp,
    claim.applied_character_xp,
    claim.xp_before,
    claim.xp_after,
    claim.level_before,
    claim.level_after,
    claim.reached_level,
    claim.rested_momentum_before,
    claim.rested_momentum_applied,
    claim.rested_momentum_after,
    claim.claimed_at,
    false
  from app_private.training_report_claims claim
  where claim.report_id = v_report.id;
end;
$$;

comment on function public.claim_training_report_v1(text, text, uuid, text, uuid, uuid, uuid) is
  'Atomically claims one frozen Training Report, reusing the P1.5 progression curve/ledger and advancing bounded Rested Momentum exactly once.';

revoke all on function public.claim_training_report_v1(text, text, uuid, text, uuid, uuid, uuid) from public;
revoke all on function public.claim_training_report_v1(text, text, uuid, text, uuid, uuid, uuid) from anon;
revoke all on function public.claim_training_report_v1(text, text, uuid, text, uuid, uuid, uuid) from authenticated;
grant execute on function public.claim_training_report_v1(text, text, uuid, text, uuid, uuid, uuid) to service_role;

commit;