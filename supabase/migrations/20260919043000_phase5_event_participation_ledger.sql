begin;

create table app_private.event_participants (
  run_id uuid not null references app_private.event_runs(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  first_participated_at timestamptz not null default clock_timestamp(),
  last_contributed_at timestamptz,
  contribution_count bigint not null default 0 check (contribution_count >= 0),
  contribution_total bigint not null default 0 check (contribution_total >= 0),
  primary key (run_id, character_id)
);

create table app_private.event_contributions (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  character_id uuid not null,
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  phase_id text not null,
  objective_id text not null,
  source_system text not null check (
    source_system ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  source_reference text not null check (
    source_reference ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  amount bigint not null check (amount > 0),
  provenance jsonb not null check (
    jsonb_typeof(provenance) = 'object' and provenance <> '{}'::jsonb
  ),
  recorded_at timestamptz not null default clock_timestamp(),
  foreign key (run_id, character_id)
    references app_private.event_participants(run_id, character_id)
    on delete cascade,
  foreign key (run_id, phase_id, objective_id)
    references app_private.event_run_objectives(run_id, phase_id, objective_id)
    on delete cascade,
  unique (run_id, source_system, source_reference)
);

create table app_private.event_reward_claim_reservations (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null,
  character_id uuid not null,
  user_id uuid not null references public.player_profiles(user_id) on delete cascade,
  reward_package_ref text not null check (
    reward_package_ref ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  eligibility_provenance jsonb not null check (
    jsonb_typeof(eligibility_provenance) = 'object'
    and eligibility_provenance <> '{}'::jsonb
  ),
  reserved_at timestamptz not null default clock_timestamp(),
  foreign key (run_id, character_id)
    references app_private.event_participants(run_id, character_id)
    on delete cascade,
  unique (run_id, character_id, reward_package_ref)
);

create index event_participants_user_run_idx
  on app_private.event_participants(user_id, run_id);
create index event_contributions_participant_recorded_idx
  on app_private.event_contributions(run_id, character_id, recorded_at);
create index event_reward_claim_reservations_user_idx
  on app_private.event_reward_claim_reservations(user_id, reserved_at);

alter table app_private.event_participants enable row level security;
alter table app_private.event_contributions enable row level security;
alter table app_private.event_reward_claim_reservations enable row level security;

revoke all on table app_private.event_participants
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_contributions
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_reward_claim_reservations
  from public, anon, authenticated, service_role;

grant select on table app_private.event_participants to service_role;
grant select on table app_private.event_contributions to service_role;
grant select on table app_private.event_reward_claim_reservations to service_role;

create or replace function public.record_event_contribution_v1(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_run_id uuid,
  p_user_id uuid,
  p_character_id uuid,
  p_phase_id text,
  p_objective_id text,
  p_source_system text,
  p_source_reference text,
  p_amount bigint,
  p_provenance jsonb
)
returns table (
  contribution_id uuid,
  participant_contribution_count bigint,
  participant_contribution_total bigint,
  objective_progress bigint,
  objective_status text,
  recorded_at timestamptz,
  replayed boolean,
  source_deduplicated boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_command_name constant text := 'event.contribution.v1';
  v_existing app_private.idempotency_records%rowtype;
  v_run app_private.event_runs%rowtype;
  v_source app_private.event_contributions%rowtype;
  v_participant app_private.event_participants%rowtype;
  v_objective app_private.event_run_objectives%rowtype;
  v_contribution_id uuid := gen_random_uuid();
  v_recorded_at timestamptz := clock_timestamp();
  v_new_progress bigint;
  v_new_status text;
begin
  if p_actor_key is null or char_length(p_actor_key) not between 1 and 160
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160
    or p_source_system is null
    or p_source_system !~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
    or p_source_reference is null
    or p_source_reference !~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
    or p_amount is null or p_amount <= 0
    or p_provenance is null
    or jsonb_typeof(p_provenance) <> 'object'
    or p_provenance = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'EVENT_CONTRIBUTION_INVALID';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_actor_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'run_id')::uuid <> p_run_id
      or (v_existing.result ->> 'character_id')::uuid <> p_character_id then
      raise exception using errcode = '22023', message = 'EVENT_CONTRIBUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'contribution_id')::uuid,
      (v_existing.result ->> 'participant_contribution_count')::bigint,
      (v_existing.result ->> 'participant_contribution_total')::bigint,
      (v_existing.result ->> 'objective_progress')::bigint,
      v_existing.result ->> 'objective_status',
      (v_existing.result ->> 'recorded_at')::timestamptz,
      true,
      (v_existing.result ->> 'source_deduplicated')::boolean;
    return;
  end if;

  select * into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_RUN_NOT_FOUND';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_actor_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'run_id')::uuid <> p_run_id
      or (v_existing.result ->> 'character_id')::uuid <> p_character_id then
      raise exception using errcode = '22023', message = 'EVENT_CONTRIBUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'contribution_id')::uuid,
      (v_existing.result ->> 'participant_contribution_count')::bigint,
      (v_existing.result ->> 'participant_contribution_total')::bigint,
      (v_existing.result ->> 'objective_progress')::bigint,
      v_existing.result ->> 'objective_status',
      (v_existing.result ->> 'recorded_at')::timestamptz,
      true,
      (v_existing.result ->> 'source_deduplicated')::boolean;
    return;
  end if;

  select * into v_source
  from app_private.event_contributions as contribution
  where contribution.run_id = p_run_id
    and contribution.source_system = p_source_system
    and contribution.source_reference = p_source_reference;

  if found then
    if v_source.user_id <> p_user_id
      or v_source.character_id <> p_character_id
      or v_source.phase_id <> p_phase_id
      or v_source.objective_id <> p_objective_id
      or v_source.amount <> p_amount
      or v_source.provenance <> p_provenance then
      raise exception using errcode = '22023', message = 'EVENT_CONTRIBUTION_SOURCE_CONFLICT';
    end if;

    select * into v_participant
    from app_private.event_participants as participant
    where participant.run_id = p_run_id
      and participant.character_id = p_character_id;

    select * into v_objective
    from app_private.event_run_objectives as objective
    where objective.run_id = p_run_id
      and objective.phase_id = p_phase_id
      and objective.objective_id = p_objective_id;

    insert into app_private.idempotency_records (
      actor_key, command_name, idempotency_key, request_fingerprint, result
    ) values (
      p_actor_key,
      v_command_name,
      p_idempotency_key,
      p_request_fingerprint,
      jsonb_build_object(
        'run_id', p_run_id,
        'character_id', p_character_id,
        'contribution_id', v_source.id,
        'participant_contribution_count', v_participant.contribution_count,
        'participant_contribution_total', v_participant.contribution_total,
        'objective_progress', v_objective.progress,
        'objective_status', v_objective.objective_status,
        'recorded_at', v_source.recorded_at,
        'source_deduplicated', true
      )
    );

    return query
    select
      v_source.id,
      v_participant.contribution_count,
      v_participant.contribution_total,
      v_objective.progress,
      v_objective.objective_status,
      v_source.recorded_at,
      false,
      true;
    return;
  end if;

  if v_run.run_mode <> 'production' or v_run.lifecycle_status <> 'live' then
    raise exception using errcode = '22023', message = 'EVENT_CONTRIBUTION_RUN_NOT_LIVE';
  end if;

  perform 1
  from app_private.event_run_phases as phase
  where phase.run_id = p_run_id
    and phase.phase_id = p_phase_id
    and phase.phase_status = 'live'
    and v_run.current_phase_id = p_phase_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_CONTRIBUTION_PHASE_NOT_LIVE';
  end if;

  perform 1
  from public.characters as character
  where character.id = p_character_id
    and character.user_id = p_user_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_PARTICIPANT_CHARACTER_NOT_FOUND';
  end if;

  select * into v_objective
  from app_private.event_run_objectives as objective
  where objective.run_id = p_run_id
    and objective.phase_id = p_phase_id
    and objective.objective_id = p_objective_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_OBJECTIVE_NOT_FOUND';
  end if;

  if v_objective.objective_status <> 'active' then
    raise exception using errcode = '22023', message = 'EVENT_OBJECTIVE_NOT_ACTIVE';
  end if;

  insert into app_private.event_participants (
    run_id,
    character_id,
    user_id,
    first_participated_at
  ) values (
    p_run_id,
    p_character_id,
    p_user_id,
    v_recorded_at
  )
  on conflict (run_id, character_id) do nothing;

  select * into v_participant
  from app_private.event_participants as participant
  where participant.run_id = p_run_id
    and participant.character_id = p_character_id
  for update;

  if v_participant.user_id <> p_user_id then
    raise exception using errcode = '22023', message = 'EVENT_PARTICIPANT_ACCOUNT_CONFLICT';
  end if;

  insert into app_private.event_contributions (
    id,
    run_id,
    character_id,
    user_id,
    phase_id,
    objective_id,
    source_system,
    source_reference,
    amount,
    provenance,
    recorded_at
  ) values (
    v_contribution_id,
    p_run_id,
    p_character_id,
    p_user_id,
    p_phase_id,
    p_objective_id,
    p_source_system,
    p_source_reference,
    p_amount,
    p_provenance,
    v_recorded_at
  );

  v_new_progress := least(
    v_objective.target::numeric,
    v_objective.progress::numeric + p_amount::numeric
  )::bigint;
  v_new_status := case
    when v_new_progress >= v_objective.target then 'completed'
    else v_objective.objective_status
  end;

  update app_private.event_run_objectives as objective
  set
    progress = v_new_progress,
    objective_status = v_new_status,
    state_version = objective.state_version + 1,
    updated_at = v_recorded_at
  where objective.run_id = p_run_id
    and objective.phase_id = p_phase_id
    and objective.objective_id = p_objective_id;

  update app_private.event_participants as participant
  set
    contribution_count = participant.contribution_count + 1,
    contribution_total = participant.contribution_total + p_amount,
    last_contributed_at = v_recorded_at
  where participant.run_id = p_run_id
    and participant.character_id = p_character_id
  returning * into v_participant;

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    p_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'run_id', p_run_id,
      'character_id', p_character_id,
      'contribution_id', v_contribution_id,
      'participant_contribution_count', v_participant.contribution_count,
      'participant_contribution_total', v_participant.contribution_total,
      'objective_progress', v_new_progress,
      'objective_status', v_new_status,
      'recorded_at', v_recorded_at,
      'source_deduplicated', false
    )
  );

  return query
  select
    v_contribution_id,
    v_participant.contribution_count,
    v_participant.contribution_total,
    v_new_progress,
    v_new_status,
    v_recorded_at,
    false,
    false;
end;
$$;

create or replace function public.reserve_event_reward_claim_v1(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_run_id uuid,
  p_user_id uuid,
  p_character_id uuid,
  p_reward_package_ref text,
  p_eligibility_provenance jsonb
)
returns table (
  reservation_id uuid,
  reward_package_ref text,
  reserved_at timestamptz,
  replayed boolean,
  claim_deduplicated boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_command_name constant text := 'event.reward-claim.reserve.v1';
  v_existing app_private.idempotency_records%rowtype;
  v_run app_private.event_runs%rowtype;
  v_reservation app_private.event_reward_claim_reservations%rowtype;
  v_participant app_private.event_participants%rowtype;
  v_definition jsonb;
  v_reservation_id uuid := gen_random_uuid();
  v_reserved_at timestamptz := clock_timestamp();
begin
  if p_actor_key is null or char_length(p_actor_key) not between 1 and 160
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160
    or p_reward_package_ref is null
    or p_reward_package_ref !~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
    or p_eligibility_provenance is null
    or jsonb_typeof(p_eligibility_provenance) <> 'object'
    or p_eligibility_provenance = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_INVALID';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_actor_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'run_id')::uuid <> p_run_id
      or (v_existing.result ->> 'character_id')::uuid <> p_character_id
      or v_existing.result ->> 'reward_package_ref' <> p_reward_package_ref then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'reserved_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_RUN_NOT_FOUND';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_actor_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'run_id')::uuid <> p_run_id
      or (v_existing.result ->> 'character_id')::uuid <> p_character_id
      or v_existing.result ->> 'reward_package_ref' <> p_reward_package_ref then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'reserved_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_reservation
  from app_private.event_reward_claim_reservations as reservation
  where reservation.run_id = p_run_id
    and reservation.character_id = p_character_id
    and reservation.reward_package_ref = p_reward_package_ref;

  if found then
    if v_reservation.user_id <> p_user_id
      or v_reservation.eligibility_provenance <> p_eligibility_provenance then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_CONFLICT';
    end if;

    insert into app_private.idempotency_records (
      actor_key, command_name, idempotency_key, request_fingerprint, result
    ) values (
      p_actor_key,
      v_command_name,
      p_idempotency_key,
      p_request_fingerprint,
      jsonb_build_object(
        'run_id', p_run_id,
        'character_id', p_character_id,
        'reservation_id', v_reservation.id,
        'reward_package_ref', v_reservation.reward_package_ref,
        'reserved_at', v_reservation.reserved_at,
        'claim_deduplicated', true
      )
    );

    return query
    select
      v_reservation.id,
      v_reservation.reward_package_ref,
      v_reservation.reserved_at,
      false,
      true;
    return;
  end if;

  if v_run.run_mode <> 'production' or v_run.lifecycle_status <> 'ended' then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_RUN_NOT_ENDED';
  end if;

  perform 1
  from public.characters as character
  where character.id = p_character_id
    and character.user_id = p_user_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_PARTICIPANT_CHARACTER_NOT_FOUND';
  end if;

  select * into v_participant
  from app_private.event_participants as participant
  where participant.run_id = p_run_id
    and participant.character_id = p_character_id;

  if not found or v_participant.user_id <> p_user_id
    or v_participant.contribution_count < 1 then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_PARTICIPANT_REQUIRED';
  end if;

  select version.definition into v_definition
  from app_private.event_definition_versions as version
  where version.id = v_run.definition_version_id
    and version.event_key = v_run.event_key;

  if not found or not exists (
    select 1
    from jsonb_array_elements_text(coalesce(v_definition -> 'rewardPackageRefs', '[]'::jsonb))
      as reward(ref)
    where reward.ref = p_reward_package_ref
  ) then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_NOT_PINNED';
  end if;

  insert into app_private.event_reward_claim_reservations (
    id,
    run_id,
    character_id,
    user_id,
    reward_package_ref,
    eligibility_provenance,
    reserved_at
  ) values (
    v_reservation_id,
    p_run_id,
    p_character_id,
    p_user_id,
    p_reward_package_ref,
    p_eligibility_provenance,
    v_reserved_at
  );

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    p_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'run_id', p_run_id,
      'character_id', p_character_id,
      'reservation_id', v_reservation_id,
      'reward_package_ref', p_reward_package_ref,
      'reserved_at', v_reserved_at,
      'claim_deduplicated', false
    )
  );

  return query
  select
    v_reservation_id,
    p_reward_package_ref,
    v_reserved_at,
    false,
    false;
end;
$$;

revoke all on function public.record_event_contribution_v1(
  text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb
) from public, anon, authenticated;
revoke all on function public.reserve_event_reward_claim_v1(
  text,uuid,text,uuid,uuid,uuid,text,jsonb
) from public, anon, authenticated;

grant execute on function public.record_event_contribution_v1(
  text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb
) to service_role;
grant execute on function public.reserve_event_reward_claim_v1(
  text,uuid,text,uuid,uuid,uuid,text,jsonb
) to service_role;

comment on table app_private.event_participants is
  'Run-scoped authoritative participant ledger. Recurring Event Runs never share participant or claim state.';
comment on table app_private.event_contributions is
  'Deduplicated authoritative Event contribution provenance validated by source-system identity.';
comment on table app_private.event_reward_claim_reservations is
  'Idempotent reward-claim boundary only. Reward Package execution is intentionally not performed here.';
comment on function public.record_event_contribution_v1(
  text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb
) is
  'Service-only contribution commit: run/objective authority, source dedupe, participant ledger and idempotent objective progress.';
comment on function public.reserve_event_reward_claim_v1(
  text,uuid,text,uuid,uuid,uuid,text,jsonb
) is
  'Service-only idempotent Event reward claim reservation against the run-pinned definition; does not execute rewards.';

commit;
