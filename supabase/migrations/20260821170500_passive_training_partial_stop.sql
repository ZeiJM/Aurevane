begin;

-- Early Passive Training stops freeze the elapsed server-authoritative fraction into a normal
-- pending Training Report. The existing claim pipeline remains the only path that applies XP.

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
      and elapsed_seconds between 0 and planned_window_seconds
      and planned_elapsed_seconds = elapsed_seconds
      and balanced_fallback_seconds = 0
    )
  );

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
  v_character public.characters%rowtype;
  v_state app_private.wayfarers_practice_state%rowtype;
  v_rates app_private.passive_training_rate_configs%rowtype;
  v_elapsed_seconds bigint;
  v_xp_per_hour bigint;
  v_requested_xp bigint;
  v_window_end timestamptz;
  v_report_id uuid := gen_random_uuid();
begin
  select * into v_character
  from public.characters
  where id = p_character_id and user_id = p_user_id
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_FOUND';
  end if;

  select * into v_state
  from app_private.wayfarers_practice_state
  where character_id = p_character_id
  for update;

  if not found
    or v_state.planned_window is null
    or v_state.planned_window_seconds is null
    or v_state.plan_set_at is null then
    return query select false, v_now;
    return;
  end if;

  if exists (
    select 1
    from app_private.training_reports report
    where report.character_id = p_character_id
      and report.status = 'pending'
  ) then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_REPORT_PENDING';
  end if;

  select * into v_rates
  from app_private.passive_training_rate_configs
  order by version desc
  limit 1;

  if not found then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_CONFIG_UNAVAILABLE';
  end if;

  v_elapsed_seconds := least(
    v_state.planned_window_seconds,
    greatest(0::bigint, floor(extract(epoch from (v_now - v_state.plan_set_at)))::bigint)
  );
  v_window_end := v_state.plan_set_at + (v_elapsed_seconds * interval '1 second');

  v_xp_per_hour := case v_state.planned_window
    when 'short' then v_rates.short_xp_per_hour
    when 'overnight' then v_rates.medium_xp_per_hour
    when 'extended' then v_rates.extended_xp_per_hour
    else null
  end;

  if v_xp_per_hour is null then
    raise exception using errcode = 'P0001', message = 'PASSIVE_TRAINING_PLAN_INVALID';
  end if;

  v_requested_xp := (v_elapsed_seconds * v_xp_per_hour) / 3600::bigint;

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
  ) values (
    v_report_id,
    v_character.id,
    v_character.user_id,
    v_state.focus,
    v_state.config_version,
    'passive_training',
    v_state.planned_window,
    v_state.planned_window_config_version,
    v_state.planned_window_seconds,
    v_elapsed_seconds,
    0,
    v_state.plan_set_at,
    v_window_end,
    v_elapsed_seconds,
    v_elapsed_seconds,
    v_elapsed_seconds,
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
  where character_id = p_character_id;

  update public.characters
  set last_active_at = v_now
  where id = p_character_id;

  return query select true, v_now;
end;
$$;

comment on function public.stop_passive_training_v1(uuid, uuid) is
  'Stops an explicit Passive Training plan and freezes elapsed server time into one proportional pending Training Report.';

revoke all on function public.stop_passive_training_v1(uuid, uuid) from public, anon, authenticated;
grant execute on function public.stop_passive_training_v1(uuid, uuid) to service_role;

commit;
