begin;

alter table app_private.event_runs
  add column cleanup_status text not null default 'not-required'
    check (cleanup_status in ('not-required','pending','completed')),
  add column cleanup_required_at timestamptz,
  add column cleanup_completed_at timestamptz,
  add constraint event_runs_cleanup_state_consistent check (
    (
      cleanup_status = 'not-required'
      and cleanup_required_at is null
      and cleanup_completed_at is null
    )
    or
    (
      cleanup_status = 'pending'
      and cleanup_required_at is not null
      and cleanup_completed_at is null
    )
    or
    (
      cleanup_status = 'completed'
      and cleanup_required_at is not null
      and cleanup_completed_at is not null
      and cleanup_completed_at >= cleanup_required_at
    )
  );

create table app_private.event_run_cleanup_requirements (
  run_id uuid not null,
  phase_id text not null,
  effect_ordinal integer not null check (effect_ordinal >= 0),
  effect_type text not null check (
    effect_type in (
      'map-marker',
      'event-node',
      'encounter-pool',
      'quest-package',
      'npc-presentation',
      'temporary-vendor',
      'world-pulse',
      'ambience',
      'reward-modifier',
      'region-presentation'
    )
  ),
  reference_key text not null check (
    reference_key ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  enabled boolean not null,
  cleanup_status text not null default 'pending'
    check (cleanup_status in ('pending','completed')),
  created_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,
  primary key (run_id, phase_id, effect_ordinal),
  foreign key (run_id, phase_id)
    references app_private.event_run_phases(run_id, phase_id)
    on delete cascade,
  check (
    (cleanup_status = 'pending' and completed_at is null)
    or
    (cleanup_status = 'completed' and completed_at is not null)
  )
);

comment on table app_private.event_run_cleanup_requirements is
  'Pinned cleanup obligations materialized from the immutable Event Definition when a Production run reaches a terminal pre-archive state. P4.14 owns actual typed effect cleanup execution.';

create index event_run_cleanup_requirements_pending_idx
  on app_private.event_run_cleanup_requirements(run_id, phase_id, effect_ordinal)
  where cleanup_status = 'pending';

alter table app_private.event_run_cleanup_requirements enable row level security;
revoke all on table app_private.event_run_cleanup_requirements
  from public, anon, authenticated, service_role;
grant select on table app_private.event_run_cleanup_requirements to service_role;

create or replace function public.transition_event_run_v1(
  p_run_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
  p_to_status text,
  p_reason text
)
returns table (
  run_id uuid,
  lifecycle_status text,
  state_version bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
  v_receipt app_private.event_run_transitions%rowtype;
  v_allowed boolean;
  v_next_version bigint;
  v_now timestamptz := clock_timestamp();
  v_definition jsonb;
  v_cleanup_status text;
  v_cleanup_required_at timestamptz;
  v_cleanup_completed_at timestamptz;
begin
  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_RUN_NOT_FOUND';
  end if;

  select *
  into v_receipt
  from app_private.event_run_transitions as receipt
  where receipt.run_id = p_run_id
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_receipt.to_status <> p_to_status or v_receipt.reason <> p_reason then
      raise exception using errcode = '22023', message = 'EVENT_RUN_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select p_run_id, v_receipt.to_status, v_receipt.resulting_state_version, true;
    return;
  end if;

  if v_run.state_version <> p_expected_state_version then
    raise exception using errcode = '40001', message = 'EVENT_RUN_STATE_VERSION_CONFLICT';
  end if;

  if p_reason is null
    or char_length(p_reason) < 3
    or char_length(p_reason) > 240
    or btrim(p_reason) <> p_reason then
    raise exception using errcode = '22023', message = 'EVENT_RUN_REASON_REQUIRED';
  end if;

  v_allowed := case v_run.lifecycle_status
    when 'preview' then p_to_status in ('cancelled','archived')
    when 'scheduled' then p_to_status in ('live','cancelled','emergency-stopped')
    when 'live' then p_to_status in ('paused','resolving','emergency-stopped')
    when 'paused' then p_to_status in ('live','resolving','emergency-stopped')
    when 'resolving' then p_to_status in ('ended','emergency-stopped')
    when 'ended' then p_to_status = 'archived'
    when 'cancelled' then p_to_status = 'archived'
    when 'emergency-stopped' then p_to_status = 'archived'
    else false
  end;

  if not v_allowed then
    raise exception using errcode = '22023', message = 'EVENT_RUN_TRANSITION_INVALID';
  end if;

  if p_to_status = 'archived' and v_run.run_mode = 'production' then
    if v_run.cleanup_status = 'pending'
      or exists (
        select 1
        from app_private.event_run_cleanup_requirements as cleanup
        where cleanup.run_id = p_run_id
          and cleanup.cleanup_status = 'pending'
      ) then
      raise exception using errcode = '22023', message = 'EVENT_RUN_CLEANUP_PENDING';
    end if;

    if exists (
      select 1
      from app_private.event_run_phases as phase
      where phase.run_id = p_run_id
        and phase.phase_status in ('pending','live')
    )
    or exists (
      select 1
      from app_private.event_run_objectives as objective
      where objective.run_id = p_run_id
        and objective.objective_status in ('inactive','active')
    ) then
      raise exception using errcode = '22023', message = 'EVENT_RUN_TERMINAL_STATE_INCOMPLETE';
    end if;
  end if;

  v_cleanup_status := v_run.cleanup_status;
  v_cleanup_required_at := v_run.cleanup_required_at;
  v_cleanup_completed_at := v_run.cleanup_completed_at;

  if p_to_status in ('ended','cancelled','emergency-stopped')
    and v_run.run_mode = 'production'
    and (
      v_run.started_at is not null
      or exists (
        select 1
        from app_private.event_run_phases as historical_phase
        where historical_phase.run_id = p_run_id
          and historical_phase.phase_status in ('live','completed')
      )
    ) then
    select version.definition
    into v_definition
    from app_private.event_definition_versions as version
    where version.id = v_run.definition_version_id
      and version.event_key = v_run.event_key;

    if not found then
      raise exception using errcode = '55000', message = 'EVENT_RUN_PINNED_DEFINITION_UNAVAILABLE';
    end if;

    insert into app_private.event_run_cleanup_requirements (
      run_id,
      phase_id,
      effect_ordinal,
      effect_type,
      reference_key,
      enabled
    )
    select
      p_run_id,
      phase.value ->> 'id',
      (effect.ordinality - 1)::integer,
      effect.value ->> 'type',
      effect.value ->> 'referenceKey',
      (effect.value ->> 'enabled')::boolean
    from jsonb_array_elements(coalesce(v_definition -> 'phases', '[]'::jsonb)) as phase(value)
    cross join lateral jsonb_array_elements(
      coalesce(phase.value -> 'cleanupEffects', '[]'::jsonb)
    ) with ordinality as effect(value, ordinality)
    where phase.value ->> 'id' is not null
      and effect.value ->> 'type' is not null
      and effect.value ->> 'referenceKey' is not null
      and effect.value ? 'enabled'
    on conflict (run_id, phase_id, effect_ordinal) do nothing;

    if exists (
      select 1
      from app_private.event_run_cleanup_requirements as cleanup
      where cleanup.run_id = p_run_id
        and cleanup.cleanup_status = 'pending'
    ) then
      v_cleanup_status := 'pending';
      v_cleanup_required_at := coalesce(v_run.cleanup_required_at, v_now);
      v_cleanup_completed_at := null;
    else
      v_cleanup_status := 'not-required';
      v_cleanup_required_at := null;
      v_cleanup_completed_at := null;
    end if;
  end if;

  if p_to_status in ('ended','cancelled','emergency-stopped')
    or (p_to_status = 'archived' and v_run.run_mode = 'preview') then
    update app_private.event_run_phases as phase
    set
      phase_status = case
        when phase.phase_status in ('completed','skipped') then phase.phase_status
        when p_to_status = 'ended' and phase.phase_status = 'live' then 'completed'
        else 'skipped'
      end,
      completed_at = coalesce(phase.completed_at, v_now),
      state_version = phase.state_version + 1
    where phase.run_id = p_run_id
      and phase.phase_status in ('pending','live');

    update app_private.event_run_objectives as objective
    set
      objective_status = case
        when objective.progress >= objective.target then 'completed'
        else 'failed'
      end,
      state_version = objective.state_version + 1,
      updated_at = v_now
    where objective.run_id = p_run_id
      and objective.objective_status in ('inactive','active');
  end if;

  v_next_version := v_run.state_version + 1;

  update app_private.event_runs as run
  set
    lifecycle_status = p_to_status,
    state_version = v_next_version,
    current_phase_id = case
      when p_to_status in ('ended','cancelled','emergency-stopped','archived') then null
      else run.current_phase_id
    end,
    cleanup_status = v_cleanup_status,
    cleanup_required_at = v_cleanup_required_at,
    cleanup_completed_at = v_cleanup_completed_at,
    updated_at = v_now,
    started_at = case
      when p_to_status = 'live' and run.started_at is null then v_now
      else run.started_at
    end,
    paused_at = case when p_to_status = 'paused' then v_now else run.paused_at end,
    resolving_at = case when p_to_status = 'resolving' then v_now else run.resolving_at end,
    ended_at = case when p_to_status = 'ended' then v_now else run.ended_at end,
    archived_at = case when p_to_status = 'archived' then v_now else run.archived_at end,
    cancelled_at = case when p_to_status = 'cancelled' then v_now else run.cancelled_at end,
    emergency_stopped_at = case
      when p_to_status = 'emergency-stopped' then v_now
      else run.emergency_stopped_at
    end
  where run.id = p_run_id;

  insert into app_private.event_run_transitions (
    run_id,
    idempotency_key,
    from_status,
    to_status,
    resulting_state_version,
    reason
  ) values (
    p_run_id,
    p_idempotency_key,
    v_run.lifecycle_status,
    p_to_status,
    v_next_version,
    p_reason
  );

  return query select p_run_id, p_to_status, v_next_version, false;
end;
$$;

comment on function public.transition_event_run_v1(uuid,bigint,uuid,text,text) is
  'P4.12 service-only idempotent lifecycle transition. Terminal Production states materialize pinned cleanup obligations, close active phase/objective state and block archive until cleanup is complete.';

commit;
