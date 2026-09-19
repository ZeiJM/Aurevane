begin;

create table app_private.event_run_phase_advances (
  run_id uuid not null references app_private.event_runs(id) on delete restrict,
  idempotency_key uuid not null,
  from_phase_id text not null,
  to_phase_id text not null,
  resulting_state_version bigint not null check (resulting_state_version > 0),
  reason text not null check (
    char_length(reason) between 3 and 240 and btrim(reason) = reason
  ),
  occurred_at timestamptz not null default clock_timestamp(),
  primary key (run_id, idempotency_key),
  unique (run_id, resulting_state_version)
);

create table app_private.event_cleanup_completion_receipts (
  run_id uuid not null,
  phase_id text not null,
  effect_ordinal integer not null,
  completion_key uuid not null,
  completed_by uuid not null,
  note text not null check (
    char_length(note) between 3 and 240 and btrim(note) = note
  ),
  completed_at timestamptz not null default clock_timestamp(),
  primary key (run_id, phase_id, effect_ordinal),
  unique (run_id, completion_key),
  foreign key (run_id, phase_id, effect_ordinal)
    references app_private.event_run_cleanup_requirements(
      run_id, phase_id, effect_ordinal
    )
    on update restrict
    on delete restrict
);

create table app_private.event_run_chronicle_entries (
  run_id uuid primary key references app_private.event_runs(id) on delete restrict,
  event_key text not null,
  definition_version_id uuid not null,
  scope_type text not null,
  scope_key text,
  started_at timestamptz,
  terminal_status text not null,
  ended_at timestamptz,
  archived_at timestamptz not null,
  participant_count bigint not null check (participant_count >= 0),
  contribution_count bigint not null check (contribution_count >= 0),
  contribution_total bigint not null check (contribution_total >= 0),
  claim_reservation_count bigint not null check (claim_reservation_count >= 0),
  reward_execution_count bigint not null check (reward_execution_count >= 0),
  cleanup_status text not null,
  summary jsonb not null check (
    jsonb_typeof(summary) = 'object' and summary <> '{}'::jsonb
  ),
  recorded_at timestamptz not null default clock_timestamp()
);

create or replace function app_private.prevent_event_operations_history_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'EVENT_OPERATIONS_HISTORY_IMMUTABLE';
end;
$$;

create trigger prevent_event_run_phase_advances_mutation_v1
before update or delete on app_private.event_run_phase_advances
for each row execute function app_private.prevent_event_operations_history_mutation_v1();

create trigger prevent_event_cleanup_completion_receipts_mutation_v1
before update or delete on app_private.event_cleanup_completion_receipts
for each row execute function app_private.prevent_event_operations_history_mutation_v1();

create trigger prevent_event_run_chronicle_entries_mutation_v1
before update or delete on app_private.event_run_chronicle_entries
for each row execute function app_private.prevent_event_operations_history_mutation_v1();

alter table app_private.event_run_phase_advances enable row level security;
alter table app_private.event_cleanup_completion_receipts enable row level security;
alter table app_private.event_run_chronicle_entries enable row level security;

revoke all on table app_private.event_run_phase_advances
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_cleanup_completion_receipts
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_run_chronicle_entries
  from public, anon, authenticated, service_role;

grant select on table app_private.event_run_phase_advances to service_role;
grant select on table app_private.event_cleanup_completion_receipts to service_role;
grant select on table app_private.event_run_chronicle_entries to service_role;

create or replace function app_private.assert_event_emergency_stop_v1(
  p_actor_user_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_role text;
begin
  v_role := app_private.assert_event_staff_author_v1(p_actor_user_id);
  if v_role = 'game-owner' then
    return;
  end if;

  if not exists (
    select 1
    from app_private.master_panel_capability_grants as grant_row
    where grant_row.user_id = p_actor_user_id
      and grant_row.capability = 'events.emergency_stop'
      and grant_row.enabled = true
  ) then
    raise exception using
      errcode = '42501',
      message = 'EVENT_EMERGENCY_STOP_CAPABILITY_REQUIRED';
  end if;
end;
$$;

revoke all on function app_private.assert_event_emergency_stop_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.materialize_event_chronicle_v1(
  p_run_id uuid
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
  v_terminal_status text;
  v_participant_count bigint;
  v_contribution_count bigint;
  v_contribution_total bigint;
  v_claim_reservation_count bigint;
  v_reward_execution_count bigint;
begin
  if exists (
    select 1
    from app_private.event_run_chronicle_entries as chronicle
    where chronicle.run_id = p_run_id
  ) then
    return;
  end if;

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id;

  if not found or v_run.lifecycle_status <> 'archived' or v_run.archived_at is null then
    raise exception using
      errcode = '22023',
      message = 'EVENT_CHRONICLE_ARCHIVED_RUN_REQUIRED';
  end if;

  select transition.from_status
  into v_terminal_status
  from app_private.event_run_transitions as transition
  where transition.run_id = p_run_id
    and transition.to_status = 'archived'
  order by transition.resulting_state_version desc
  limit 1;

  if v_terminal_status is null then
    v_terminal_status := 'archived';
  end if;

  select count(*)::bigint
  into v_participant_count
  from app_private.event_participants as participant
  where participant.run_id = p_run_id;

  select
    count(*)::bigint,
    coalesce(sum(contribution.amount), 0)::bigint
  into
    v_contribution_count,
    v_contribution_total
  from app_private.event_contributions as contribution
  where contribution.run_id = p_run_id;

  select count(*)::bigint
  into v_claim_reservation_count
  from app_private.event_reward_claim_reservations as reservation
  where reservation.run_id = p_run_id;

  select count(*)::bigint
  into v_reward_execution_count
  from app_private.event_reward_claim_executions as execution
  where execution.run_id = p_run_id;

  insert into app_private.event_run_chronicle_entries (
    run_id,
    event_key,
    definition_version_id,
    scope_type,
    scope_key,
    started_at,
    terminal_status,
    ended_at,
    archived_at,
    participant_count,
    contribution_count,
    contribution_total,
    claim_reservation_count,
    reward_execution_count,
    cleanup_status,
    summary
  ) values (
    v_run.id,
    v_run.event_key,
    v_run.definition_version_id,
    v_run.scope_type,
    v_run.scope_key,
    v_run.started_at,
    v_terminal_status,
    v_run.ended_at,
    v_run.archived_at,
    v_participant_count,
    v_contribution_count,
    v_contribution_total,
    v_claim_reservation_count,
    v_reward_execution_count,
    v_run.cleanup_status,
    jsonb_build_object(
      'runId', v_run.id,
      'eventKey', v_run.event_key,
      'definitionVersionId', v_run.definition_version_id,
      'scopeType', v_run.scope_type,
      'scopeKey', v_run.scope_key,
      'startedAt', v_run.started_at,
      'terminalStatus', v_terminal_status,
      'endedAt', v_run.ended_at,
      'archivedAt', v_run.archived_at,
      'participantCount', v_participant_count,
      'contributionCount', v_contribution_count,
      'contributionTotal', v_contribution_total,
      'claimReservationCount', v_claim_reservation_count,
      'rewardExecutionCount', v_reward_execution_count,
      'cleanupStatus', v_run.cleanup_status
    )
  );
end;
$$;

revoke all on function app_private.materialize_event_chronicle_v1(uuid)
  from public, anon, authenticated, service_role;

create or replace function app_private.capture_event_chronicle_on_archive_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if new.lifecycle_status = 'archived'
    and old.lifecycle_status is distinct from 'archived' then
    perform app_private.materialize_event_chronicle_v1(new.id);
  end if;
  return new;
end;
$$;

create trigger capture_event_chronicle_on_archive_v1
after update of lifecycle_status on app_private.event_runs
for each row execute function app_private.capture_event_chronicle_on_archive_v1();

create or replace function public.list_event_operation_runs_v1(
  p_actor_user_id uuid
)
returns table (
  run_id uuid,
  event_key text,
  lifecycle_status text,
  state_version bigint,
  scope_type text,
  scope_key text,
  current_phase_id text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  started_at timestamptz,
  cleanup_status text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_role text;
  v_global_allowed boolean;
begin
  v_role := app_private.assert_event_staff_author_v1(p_actor_user_id);
  v_global_allowed :=
    v_role = 'game-owner'
    or exists (
      select 1
      from app_private.master_panel_capability_grants as grant_row
      where grant_row.user_id = p_actor_user_id
        and grant_row.capability = 'events.global_scope'
        and grant_row.enabled = true
    );

  return query
  select
    run.id,
    run.event_key,
    run.lifecycle_status,
    run.state_version,
    run.scope_type,
    run.scope_key,
    run.current_phase_id,
    run.scheduled_start_at,
    run.scheduled_end_at,
    run.started_at,
    run.cleanup_status,
    run.updated_at
  from app_private.event_runs as run
  where run.run_mode = 'production'
    and (run.scope_type <> 'global' or v_global_allowed)
  order by
    case when run.lifecycle_status = 'archived' then 1 else 0 end,
    run.updated_at desc,
    run.id
  limit 100;
end;
$$;

create or replace function public.read_event_operation_dashboard_v1(
  p_actor_user_id uuid,
  p_run_id uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
  v_definition jsonb;
  v_current_effects jsonb;
  v_phases jsonb;
  v_participants jsonb;
  v_claims jsonb;
  v_cleanup jsonb;
  v_chronicle jsonb;
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
    and run.run_mode = 'production';

  if not found then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_RUN_NOT_FOUND';
  end if;

  perform app_private.assert_event_operational_scope_v1(
    p_actor_user_id,
    v_run.scope_type
  );

  select version.definition
  into v_definition
  from app_private.event_definition_versions as version
  where version.id = v_run.definition_version_id
    and version.event_key = v_run.event_key;

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_RUN_PINNED_DEFINITION_UNAVAILABLE';
  end if;

  select coalesce(phase.value -> 'effects', '[]'::jsonb)
  into v_current_effects
  from jsonb_array_elements(
    coalesce(v_definition -> 'phases', '[]'::jsonb)
  ) as phase(value)
  where phase.value ->> 'id' = v_run.current_phase_id
  limit 1;

  v_current_effects := coalesce(v_current_effects, '[]'::jsonb);

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'phaseId', phase.phase_id,
        'ordinal', phase.ordinal,
        'status', phase.phase_status,
        'startedAt', phase.started_at,
        'completedAt', phase.completed_at,
        'stateVersion', phase.state_version,
        'objectives', coalesce(
          (
            select jsonb_agg(
              jsonb_build_object(
                'objectiveId', objective.objective_id,
                'status', objective.objective_status,
                'progress', objective.progress,
                'target', objective.target,
                'stateVersion', objective.state_version,
                'updatedAt', objective.updated_at
              )
              order by objective.objective_id
            )
            from app_private.event_run_objectives as objective
            where objective.run_id = phase.run_id
              and objective.phase_id = phase.phase_id
          ),
          '[]'::jsonb
        )
      )
      order by phase.ordinal
    ),
    '[]'::jsonb
  )
  into v_phases
  from app_private.event_run_phases as phase
  where phase.run_id = p_run_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'characterId', participant.character_id,
        'userId', participant.user_id,
        'firstParticipatedAt', participant.first_participated_at,
        'lastContributedAt', participant.last_contributed_at,
        'contributionCount', participant.contribution_count,
        'contributionTotal', participant.contribution_total
      )
      order by participant.first_participated_at, participant.character_id
    ),
    '[]'::jsonb
  )
  into v_participants
  from app_private.event_participants as participant
  where participant.run_id = p_run_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'reservationId', reservation.id,
        'characterId', reservation.character_id,
        'rewardPackageRef', reservation.reward_package_ref,
        'reservedAt', reservation.reserved_at,
        'executed', execution.reservation_id is not null,
        'executedAt', execution.executed_at,
        'appliedAmount', execution.applied_amount
      )
      order by reservation.reserved_at, reservation.id
    ),
    '[]'::jsonb
  )
  into v_claims
  from app_private.event_reward_claim_reservations as reservation
  left join app_private.event_reward_claim_executions as execution
    on execution.reservation_id = reservation.id
  where reservation.run_id = p_run_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'phaseId', cleanup.phase_id,
        'effectOrdinal', cleanup.effect_ordinal,
        'effectType', cleanup.effect_type,
        'referenceKey', cleanup.reference_key,
        'enabled', cleanup.enabled,
        'status', cleanup.cleanup_status,
        'completedAt', cleanup.completed_at,
        'completion', case
          when receipt.completion_key is null then null
          else jsonb_build_object(
            'completionKey', receipt.completion_key,
            'completedBy', receipt.completed_by,
            'note', receipt.note,
            'completedAt', receipt.completed_at
          )
        end
      )
      order by cleanup.phase_id, cleanup.effect_ordinal
    ),
    '[]'::jsonb
  )
  into v_cleanup
  from app_private.event_run_cleanup_requirements as cleanup
  left join app_private.event_cleanup_completion_receipts as receipt
    on receipt.run_id = cleanup.run_id
   and receipt.phase_id = cleanup.phase_id
   and receipt.effect_ordinal = cleanup.effect_ordinal
  where cleanup.run_id = p_run_id;

  select chronicle.summary
  into v_chronicle
  from app_private.event_run_chronicle_entries as chronicle
  where chronicle.run_id = p_run_id;

  return jsonb_build_object(
    'run', jsonb_build_object(
      'runId', v_run.id,
      'eventKey', v_run.event_key,
      'definitionVersionId', v_run.definition_version_id,
      'lifecycleStatus', v_run.lifecycle_status,
      'stateVersion', v_run.state_version,
      'scopeType', v_run.scope_type,
      'scopeKey', v_run.scope_key,
      'currentPhaseId', v_run.current_phase_id,
      'scheduledStartAt', v_run.scheduled_start_at,
      'scheduledEndAt', v_run.scheduled_end_at,
      'startedAt', v_run.started_at,
      'pausedAt', v_run.paused_at,
      'resolvingAt', v_run.resolving_at,
      'endedAt', v_run.ended_at,
      'archivedAt', v_run.archived_at,
      'cancelledAt', v_run.cancelled_at,
      'emergencyStoppedAt', v_run.emergency_stopped_at,
      'cleanupStatus', v_run.cleanup_status,
      'cleanupRequiredAt', v_run.cleanup_required_at,
      'cleanupCompletedAt', v_run.cleanup_completed_at,
      'updatedAt', v_run.updated_at
    ),
    'activeEffects', v_current_effects,
    'phases', v_phases,
    'participants', v_participants,
    'claims', v_claims,
    'cleanupRequirements', v_cleanup,
    'chronicle', v_chronicle
  );
end;
$$;

create or replace function public.operate_event_run_v1(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
  p_command text,
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
  v_transition record;
  v_to_status text;
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
    and run.run_mode = 'production';

  if not found then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_RUN_NOT_FOUND';
  end if;

  perform app_private.assert_event_operational_scope_v1(
    p_actor_user_id,
    v_run.scope_type
  );

  if p_command = 'emergency-stop' then
    perform app_private.assert_event_emergency_stop_v1(p_actor_user_id);
  end if;

  v_to_status := case p_command
    when 'start' then 'live'
    when 'pause' then 'paused'
    when 'resume' then 'live'
    when 'stop' then 'resolving'
    when 'end' then 'ended'
    when 'archive' then 'archived'
    when 'emergency-stop' then 'emergency-stopped'
    else null
  end;

  if v_to_status is null then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_COMMAND_INVALID';
  end if;

  if p_command = 'start'
    and v_run.lifecycle_status = 'scheduled'
    and v_run.scheduled_start_at is not null
    and v_run.scheduled_start_at > statement_timestamp() then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_START_NOT_DUE';
  end if;

  select *
  into v_transition
  from public.transition_event_run_v1(
    p_run_id,
    p_expected_state_version,
    p_idempotency_key,
    v_to_status,
    p_reason
  );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_OPERATION_TRANSITION_UNAVAILABLE';
  end if;

  if p_command = 'start' and v_transition.replayed = false then
    update app_private.event_run_phases as phase
    set
      phase_status = 'live',
      started_at = coalesce(phase.started_at, clock_timestamp()),
      state_version = phase.state_version + 1
    where phase.run_id = p_run_id
      and phase.phase_id = v_run.current_phase_id
      and phase.phase_status = 'pending';

    if not found then
      raise exception using
        errcode = '22023',
        message = 'EVENT_OPERATION_CURRENT_PHASE_NOT_PENDING';
    end if;

    update app_private.event_run_objectives as objective
    set
      objective_status = 'active',
      state_version = objective.state_version + 1,
      updated_at = clock_timestamp()
    where objective.run_id = p_run_id
      and objective.phase_id = v_run.current_phase_id
      and objective.objective_status = 'inactive';
  end if;

  return query
  select
    v_transition.run_id,
    v_transition.lifecycle_status,
    v_transition.state_version,
    v_transition.replayed;
end;
$$;

create or replace function public.advance_event_run_phase_v1(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
  p_reason text
)
returns table (
  run_id uuid,
  current_phase_id text,
  state_version bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
  v_existing app_private.event_run_phase_advances%rowtype;
  v_current app_private.event_run_phases%rowtype;
  v_next app_private.event_run_phases%rowtype;
  v_next_version bigint;
  v_now timestamptz := clock_timestamp();
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
  for update;

  if not found or v_run.run_mode <> 'production' then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_RUN_NOT_FOUND';
  end if;

  perform app_private.assert_event_operational_scope_v1(
    p_actor_user_id,
    v_run.scope_type
  );

  select *
  into v_existing
  from app_private.event_run_phase_advances as receipt
  where receipt.run_id = p_run_id
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.reason <> p_reason then
      raise exception using
        errcode = '22023',
        message = 'EVENT_PHASE_ADVANCE_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      p_run_id,
      v_existing.to_phase_id,
      v_existing.resulting_state_version,
      true;
    return;
  end if;

  if v_run.state_version <> p_expected_state_version then
    raise exception using
      errcode = '40001',
      message = 'EVENT_RUN_STATE_VERSION_CONFLICT';
  end if;

  if v_run.lifecycle_status <> 'live' then
    raise exception using
      errcode = '22023',
      message = 'EVENT_PHASE_ADVANCE_LIVE_RUN_REQUIRED';
  end if;

  if p_reason is null
    or char_length(p_reason) not between 3 and 240
    or btrim(p_reason) <> p_reason then
    raise exception using
      errcode = '22023',
      message = 'EVENT_RUN_REASON_REQUIRED';
  end if;

  select *
  into v_current
  from app_private.event_run_phases as phase
  where phase.run_id = p_run_id
    and phase.phase_id = v_run.current_phase_id
  for update;

  if not found or v_current.phase_status <> 'live' then
    raise exception using
      errcode = '22023',
      message = 'EVENT_PHASE_ADVANCE_CURRENT_PHASE_INVALID';
  end if;

  select *
  into v_next
  from app_private.event_run_phases as phase
  where phase.run_id = p_run_id
    and phase.ordinal > v_current.ordinal
  order by phase.ordinal
  limit 1
  for update;

  if not found or v_next.phase_status <> 'pending' then
    raise exception using
      errcode = '22023',
      message = 'EVENT_PHASE_ADVANCE_NEXT_PHASE_UNAVAILABLE';
  end if;

  update app_private.event_run_objectives as objective
  set
    objective_status = case
      when objective.objective_status = 'completed' then 'completed'
      else 'failed'
    end,
    state_version = objective.state_version + 1,
    updated_at = v_now
  where objective.run_id = p_run_id
    and objective.phase_id = v_current.phase_id
    and objective.objective_status in ('inactive','active');

  update app_private.event_run_phases as phase
  set
    phase_status = 'completed',
    completed_at = v_now,
    state_version = phase.state_version + 1
  where phase.run_id = p_run_id
    and phase.phase_id = v_current.phase_id;

  update app_private.event_run_phases as phase
  set
    phase_status = 'live',
    started_at = coalesce(phase.started_at, v_now),
    state_version = phase.state_version + 1
  where phase.run_id = p_run_id
    and phase.phase_id = v_next.phase_id;

  update app_private.event_run_objectives as objective
  set
    objective_status = 'active',
    state_version = objective.state_version + 1,
    updated_at = v_now
  where objective.run_id = p_run_id
    and objective.phase_id = v_next.phase_id
    and objective.objective_status = 'inactive';

  v_next_version := v_run.state_version + 1;

  update app_private.event_runs as run
  set
    current_phase_id = v_next.phase_id,
    state_version = v_next_version,
    updated_at = v_now
  where run.id = p_run_id;

  insert into app_private.event_run_phase_advances (
    run_id,
    idempotency_key,
    from_phase_id,
    to_phase_id,
    resulting_state_version,
    reason
  ) values (
    p_run_id,
    p_idempotency_key,
    v_current.phase_id,
    v_next.phase_id,
    v_next_version,
    p_reason
  );

  return query
  select p_run_id, v_next.phase_id, v_next_version, false;
end;
$$;

create or replace function public.complete_event_cleanup_requirement_v1(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_phase_id text,
  p_effect_ordinal integer,
  p_completion_key uuid,
  p_note text
)
returns table (
  run_id uuid,
  cleanup_status text,
  state_version bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
  v_requirement app_private.event_run_cleanup_requirements%rowtype;
  v_receipt app_private.event_cleanup_completion_receipts%rowtype;
  v_next_version bigint;
  v_now timestamptz := clock_timestamp();
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
  for update;

  if not found or v_run.run_mode <> 'production' then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_RUN_NOT_FOUND';
  end if;

  perform app_private.assert_event_operational_scope_v1(
    p_actor_user_id,
    v_run.scope_type
  );

  if v_run.lifecycle_status not in ('ended','cancelled','emergency-stopped') then
    raise exception using
      errcode = '22023',
      message = 'EVENT_CLEANUP_TERMINAL_RUN_REQUIRED';
  end if;

  if p_note is null
    or char_length(p_note) not between 3 and 240
    or btrim(p_note) <> p_note then
    raise exception using
      errcode = '22023',
      message = 'EVENT_CLEANUP_NOTE_REQUIRED';
  end if;

  select *
  into v_requirement
  from app_private.event_run_cleanup_requirements as cleanup
  where cleanup.run_id = p_run_id
    and cleanup.phase_id = p_phase_id
    and cleanup.effect_ordinal = p_effect_ordinal
  for update;

  if not found then
    raise exception using
      errcode = '22023',
      message = 'EVENT_CLEANUP_REQUIREMENT_NOT_FOUND';
  end if;

  select *
  into v_receipt
  from app_private.event_cleanup_completion_receipts as receipt
  where receipt.run_id = p_run_id
    and receipt.phase_id = p_phase_id
    and receipt.effect_ordinal = p_effect_ordinal;

  if found then
    if v_receipt.completion_key <> p_completion_key
      or v_receipt.note <> p_note then
      raise exception using
        errcode = '22023',
        message = 'EVENT_CLEANUP_COMPLETION_CONFLICT';
    end if;

    return query
    select
      p_run_id,
      v_run.cleanup_status,
      v_run.state_version,
      true;
    return;
  end if;

  if v_requirement.cleanup_status <> 'pending' then
    raise exception using
      errcode = '22023',
      message = 'EVENT_CLEANUP_COMPLETION_RECEIPT_MISSING';
  end if;

  update app_private.event_run_cleanup_requirements as cleanup
  set
    cleanup_status = 'completed',
    completed_at = v_now
  where cleanup.run_id = p_run_id
    and cleanup.phase_id = p_phase_id
    and cleanup.effect_ordinal = p_effect_ordinal;

  insert into app_private.event_cleanup_completion_receipts (
    run_id,
    phase_id,
    effect_ordinal,
    completion_key,
    completed_by,
    note,
    completed_at
  ) values (
    p_run_id,
    p_phase_id,
    p_effect_ordinal,
    p_completion_key,
    p_actor_user_id,
    p_note,
    v_now
  );

  v_next_version := v_run.state_version + 1;

  update app_private.event_runs as run
  set
    cleanup_status = case
      when exists (
        select 1
        from app_private.event_run_cleanup_requirements as pending
        where pending.run_id = p_run_id
          and pending.cleanup_status = 'pending'
      ) then 'pending'
      else 'completed'
    end,
    cleanup_completed_at = case
      when exists (
        select 1
        from app_private.event_run_cleanup_requirements as pending
        where pending.run_id = p_run_id
          and pending.cleanup_status = 'pending'
      ) then null
      else v_now
    end,
    state_version = v_next_version,
    updated_at = v_now
  where run.id = p_run_id
  returning run.cleanup_status into v_run.cleanup_status;

  return query
  select p_run_id, v_run.cleanup_status, v_next_version, false;
end;
$$;

revoke all on function public.list_event_operation_runs_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.read_event_operation_dashboard_v1(uuid,uuid)
  from public, anon, authenticated;
revoke all on function public.operate_event_run_v1(uuid,uuid,bigint,uuid,text,text)
  from public, anon, authenticated;
revoke all on function public.advance_event_run_phase_v1(uuid,uuid,bigint,uuid,text)
  from public, anon, authenticated;
revoke all on function public.complete_event_cleanup_requirement_v1(
  uuid,uuid,text,integer,uuid,text
) from public, anon, authenticated;

grant execute on function public.list_event_operation_runs_v1(uuid)
  to service_role;
grant execute on function public.read_event_operation_dashboard_v1(uuid,uuid)
  to service_role;
grant execute on function public.operate_event_run_v1(uuid,uuid,bigint,uuid,text,text)
  to service_role;
grant execute on function public.advance_event_run_phase_v1(uuid,uuid,bigint,uuid,text)
  to service_role;
grant execute on function public.complete_event_cleanup_requirement_v1(
  uuid,uuid,text,integer,uuid,text
) to service_role;

comment on table app_private.event_run_phase_advances is
  'Append-only P4.14 manual phase-advance receipts with optimistic run-version results.';
comment on table app_private.event_cleanup_completion_receipts is
  'Append-only P4.14 operator acknowledgements for typed pinned cleanup requirements.';
comment on table app_private.event_run_chronicle_entries is
  'Immutable archived Event Run Chronicle summary preserving participant/contribution/reward/cleanup history.';
comment on function public.operate_event_run_v1(uuid,uuid,bigint,uuid,text,text) is
  'P4.14 Event Staff lifecycle command wrapper over the authoritative Event Run state machine.';
comment on function public.advance_event_run_phase_v1(uuid,uuid,bigint,uuid,text) is
  'P4.14 idempotent manual phase advance. Active/incomplete current objectives fail, next phase activates.';
comment on function public.complete_event_cleanup_requirement_v1(uuid,uuid,text,integer,uuid,text) is
  'P4.14 idempotent typed cleanup acknowledgement; archive remains blocked until every pinned requirement is complete.';

commit;
