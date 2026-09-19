begin;

-- Preserve Event participant/claim history when player or character records are later deleted.
alter table app_private.event_participants
  drop constraint if exists event_participants_character_id_fkey;
alter table app_private.event_participants
  drop constraint if exists event_participants_user_id_fkey;
alter table app_private.event_contributions
  drop constraint if exists event_contributions_user_id_fkey;
alter table app_private.event_reward_claim_reservations
  drop constraint if exists event_reward_claim_reservations_user_id_fkey;

create table app_private.event_reward_budget_policies (
  budget_ref text primary key check (
    budget_ref ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  reward_type text not null check (reward_type = 'character-xp'),
  max_per_claim bigint not null check (max_per_claim > 0),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);

create table app_private.event_reward_packages (
  reward_package_ref text primary key check (
    reward_package_ref ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  package_version integer not null check (package_version > 0),
  budget_ref text not null references app_private.event_reward_budget_policies(budget_ref)
    on update restrict on delete restrict,
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);

create or replace function app_private.validate_event_reward_package_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
declare
  v_reward jsonb;
  v_amount numeric;
  v_budget app_private.event_reward_budget_policies%rowtype;
begin
  if (new.definition ->> 'schemaVersion') <> '1'
    or new.definition ->> 'rewardPackageRef' <> new.reward_package_ref
    or (new.definition ->> 'packageVersion') !~ '^[1-9][0-9]*$'
    or (new.definition ->> 'packageVersion')::numeric <> new.package_version
    or new.definition ->> 'budgetRef' <> new.budget_ref
    or jsonb_typeof(new.definition -> 'rewards') <> 'array'
    or jsonb_array_length(new.definition -> 'rewards') <> 1 then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_INVALID';
  end if;

  select * into v_budget
  from app_private.event_reward_budget_policies as policy
  where policy.budget_ref = new.budget_ref;

  if not found or v_budget.reward_type <> 'character-xp' then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_BUDGET_UNAVAILABLE';
  end if;

  v_reward := new.definition -> 'rewards' -> 0;
  if jsonb_typeof(v_reward) <> 'object'
    or v_reward ->> 'type' <> 'character-xp'
    or jsonb_typeof(v_reward -> 'amount') <> 'number'
    or (v_reward ->> 'amount') !~ '^[1-9][0-9]{0,18}$' then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_OPERATION_UNSUPPORTED';
  end if;

  v_amount := (v_reward ->> 'amount')::numeric;
  if v_amount > 9223372036854775807::numeric
    or v_amount > v_budget.max_per_claim::numeric then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_BUDGET_EXCEEDED';
  end if;

  return new;
end;
$$;

create trigger validate_event_reward_package_v1
before insert on app_private.event_reward_packages
for each row execute function app_private.validate_event_reward_package_v1();

create or replace function app_private.prevent_event_reward_catalog_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
begin
  raise exception using errcode = '55000', message = 'EVENT_REWARD_CATALOG_IMMUTABLE';
end;
$$;

create trigger prevent_event_reward_budget_mutation_v1
before update or delete on app_private.event_reward_budget_policies
for each row execute function app_private.prevent_event_reward_catalog_mutation_v1();

create trigger prevent_event_reward_package_mutation_v1
before update or delete on app_private.event_reward_packages
for each row execute function app_private.prevent_event_reward_catalog_mutation_v1();

alter table app_private.event_reward_claim_reservations
  add column claimed_at timestamptz,
  add constraint event_reward_claim_package_fk
    foreign key (reward_package_ref)
    references app_private.event_reward_packages(reward_package_ref)
    on update restrict on delete restrict;

create table app_private.event_reward_claim_execution_entries (
  reservation_id uuid primary key
    references app_private.event_reward_claim_reservations(id)
    on update restrict on delete restrict,
  reward_ordinal integer not null check (reward_ordinal = 0),
  reward_type text not null check (reward_type = 'character-xp'),
  receipt_id uuid not null unique,
  applied_amount bigint not null check (applied_amount >= 0),
  executed_at timestamptz not null default clock_timestamp()
);

create table app_private.event_run_cleanup_state (
  run_id uuid primary key references app_private.event_runs(id) on update restrict on delete restrict,
  cleanup_status text not null check (cleanup_status in ('pending','completed')),
  state_version bigint not null default 1 check (state_version > 0),
  prepared_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz
);

create table app_private.event_run_cleanup_items (
  run_id uuid not null references app_private.event_run_cleanup_state(run_id)
    on update restrict on delete restrict,
  phase_id text not null check (char_length(phase_id) between 2 and 160),
  effect_ordinal integer not null check (effect_ordinal >= 0),
  effect_type text not null check (
    effect_type in (
      'map-marker','event-node','encounter-pool','quest-package','npc-presentation',
      'temporary-vendor','world-pulse','ambience','reward-modifier','region-presentation'
    )
  ),
  reference_key text not null check (
    reference_key ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  enabled boolean not null,
  item_status text not null default 'pending' check (item_status in ('pending','completed')),
  completion_key uuid,
  receipt jsonb,
  completed_at timestamptz,
  primary key (run_id, phase_id, effect_ordinal),
  check (
    (item_status = 'pending' and completion_key is null and receipt is null and completed_at is null)
    or
    (
      item_status = 'completed'
      and completion_key is not null
      and receipt is not null
      and jsonb_typeof(receipt) = 'object'
      and receipt <> '{}'::jsonb
      and completed_at is not null
    )
  )
);

alter table app_private.event_reward_budget_policies enable row level security;
alter table app_private.event_reward_packages enable row level security;
alter table app_private.event_reward_claim_execution_entries enable row level security;
alter table app_private.event_run_cleanup_state enable row level security;
alter table app_private.event_run_cleanup_items enable row level security;

revoke all on table app_private.event_reward_budget_policies
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_reward_packages
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_reward_claim_execution_entries
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_run_cleanup_state
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_run_cleanup_items
  from public, anon, authenticated, service_role;

grant select on table app_private.event_reward_budget_policies to service_role;
grant select on table app_private.event_reward_packages to service_role;
grant select on table app_private.event_reward_claim_execution_entries to service_role;
grant select on table app_private.event_run_cleanup_state to service_role;
grant select on table app_private.event_run_cleanup_items to service_role;

create or replace function app_private.prepare_event_run_cleanup_v1(
  p_run_id uuid,
  p_requires_cleanup boolean
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_run app_private.event_runs%rowtype;
  v_definition jsonb;
  v_items integer;
begin
  if exists (
    select 1 from app_private.event_run_cleanup_state as state
    where state.run_id = p_run_id
  ) then
    return;
  end if;

  select * into v_run
  from app_private.event_runs as run
  where run.id = p_run_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_RUN_NOT_FOUND';
  end if;

  insert into app_private.event_run_cleanup_state (
    run_id, cleanup_status
  ) values (
    p_run_id, 'pending'
  );

  if p_requires_cleanup then
    select version.definition into v_definition
    from app_private.event_definition_versions as version
    where version.id = v_run.definition_version_id
      and version.event_key = v_run.event_key;

    if not found then
      raise exception using errcode = '22023', message = 'EVENT_DEFINITION_NOT_FOUND';
    end if;

    if v_definition ? 'phases' and jsonb_typeof(v_definition -> 'phases') <> 'array' then
      raise exception using errcode = '22023', message = 'EVENT_CLEANUP_DEFINITION_INVALID';
    end if;

    insert into app_private.event_run_cleanup_items (
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
    from jsonb_array_elements(coalesce(v_definition -> 'phases', '[]'::jsonb))
      with ordinality as phase(value, ordinality)
    cross join lateral jsonb_array_elements(
      case
        when jsonb_typeof(phase.value -> 'cleanupEffects') = 'array'
          then phase.value -> 'cleanupEffects'
        else '[]'::jsonb
      end
    ) with ordinality as effect(value, ordinality);
  end if;

  select count(*)::integer into v_items
  from app_private.event_run_cleanup_items as item
  where item.run_id = p_run_id;

  if v_items = 0 then
    update app_private.event_run_cleanup_state as state
    set
      cleanup_status = 'completed',
      state_version = state.state_version + 1,
      completed_at = clock_timestamp()
    where state.run_id = p_run_id;
  end if;
end;
$$;

create or replace function public.record_event_cleanup_item_v1(
  p_run_id uuid,
  p_phase_id text,
  p_effect_ordinal integer,
  p_completion_key uuid,
  p_receipt jsonb
)
returns table (
  cleanup_status text,
  item_status text,
  state_version bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_state app_private.event_run_cleanup_state%rowtype;
  v_item app_private.event_run_cleanup_items%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if p_phase_id is null or char_length(p_phase_id) not between 2 and 160
    or p_effect_ordinal is null or p_effect_ordinal < 0
    or p_completion_key is null
    or p_receipt is null
    or jsonb_typeof(p_receipt) <> 'object'
    or p_receipt = '{}'::jsonb then
    raise exception using errcode = '22023', message = 'EVENT_CLEANUP_RECEIPT_INVALID';
  end if;

  select * into v_state
  from app_private.event_run_cleanup_state as state
  where state.run_id = p_run_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_CLEANUP_NOT_PREPARED';
  end if;

  select * into v_item
  from app_private.event_run_cleanup_items as item
  where item.run_id = p_run_id
    and item.phase_id = p_phase_id
    and item.effect_ordinal = p_effect_ordinal
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_CLEANUP_ITEM_NOT_FOUND';
  end if;

  if v_item.item_status = 'completed' then
    if v_item.completion_key <> p_completion_key or v_item.receipt <> p_receipt then
      raise exception using errcode = '22023', message = 'EVENT_CLEANUP_RECEIPT_CONFLICT';
    end if;

    return query
    select v_state.cleanup_status, v_item.item_status, v_state.state_version, true;
    return;
  end if;

  update app_private.event_run_cleanup_items as item
  set
    item_status = 'completed',
    completion_key = p_completion_key,
    receipt = p_receipt,
    completed_at = v_now
  where item.run_id = p_run_id
    and item.phase_id = p_phase_id
    and item.effect_ordinal = p_effect_ordinal;

  if not exists (
    select 1
    from app_private.event_run_cleanup_items as pending
    where pending.run_id = p_run_id
      and pending.item_status = 'pending'
  ) then
    update app_private.event_run_cleanup_state as state
    set
      cleanup_status = 'completed',
      state_version = state.state_version + 1,
      completed_at = v_now
    where state.run_id = p_run_id
    returning * into v_state;
  else
    select * into v_state
    from app_private.event_run_cleanup_state as state
    where state.run_id = p_run_id;
  end if;

  return query
  select v_state.cleanup_status, 'completed'::text, v_state.state_version, false;
end;
$$;

create or replace function public.prepare_event_reward_claim_execution_v1(
  p_reservation_id uuid
)
returns table (
  reservation_id uuid,
  run_id uuid,
  character_id uuid,
  user_id uuid,
  reward_package_ref text,
  package_definition jsonb,
  claimed_at timestamptz,
  execution_receipt_id uuid,
  execution_applied_amount bigint
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  return query
  select
    reservation.id,
    reservation.run_id,
    reservation.character_id,
    reservation.user_id,
    reservation.reward_package_ref,
    package.definition,
    reservation.claimed_at,
    execution.receipt_id,
    execution.applied_amount
  from app_private.event_reward_claim_reservations as reservation
  join app_private.event_reward_packages as package
    on package.reward_package_ref = reservation.reward_package_ref
  left join app_private.event_reward_claim_execution_entries as execution
    on execution.reservation_id = reservation.id
  where reservation.id = p_reservation_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_NOT_FOUND';
  end if;
end;
$$;

create or replace function public.record_event_reward_claim_execution_v1(
  p_reservation_id uuid,
  p_reward_ordinal integer,
  p_reward_type text,
  p_receipt_id uuid,
  p_applied_amount bigint
)
returns table (
  claimed_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_reservation app_private.event_reward_claim_reservations%rowtype;
  v_package app_private.event_reward_packages%rowtype;
  v_existing app_private.event_reward_claim_execution_entries%rowtype;
  v_expected_amount bigint;
  v_claimed_at timestamptz;
begin
  if p_reward_ordinal <> 0
    or p_reward_type <> 'character-xp'
    or p_receipt_id is null
    or p_applied_amount is null
    or p_applied_amount < 0 then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_RECEIPT_INVALID';
  end if;

  select * into v_reservation
  from app_private.event_reward_claim_reservations as reservation
  where reservation.id = p_reservation_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_CLAIM_NOT_FOUND';
  end if;

  select * into v_package
  from app_private.event_reward_packages as package
  where package.reward_package_ref = v_reservation.reward_package_ref;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_UNAVAILABLE';
  end if;

  v_expected_amount := (v_package.definition -> 'rewards' -> 0 ->> 'amount')::bigint;
  if p_applied_amount > v_expected_amount then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_AMOUNT_INVALID';
  end if;

  select * into v_existing
  from app_private.event_reward_claim_execution_entries as execution
  where execution.reservation_id = p_reservation_id;

  if found then
    if v_existing.reward_ordinal <> p_reward_ordinal
      or v_existing.reward_type <> p_reward_type
      or v_existing.receipt_id <> p_receipt_id
      or v_existing.applied_amount <> p_applied_amount then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_RECEIPT_CONFLICT';
    end if;

    if v_reservation.claimed_at is null then
      raise exception using errcode = '40001', message = 'EVENT_REWARD_EXECUTION_STATE_INVALID';
    end if;

    return query select v_reservation.claimed_at, true;
    return;
  end if;

  insert into app_private.event_reward_claim_execution_entries (
    reservation_id,
    reward_ordinal,
    reward_type,
    receipt_id,
    applied_amount
  ) values (
    p_reservation_id,
    p_reward_ordinal,
    p_reward_type,
    p_receipt_id,
    p_applied_amount
  );

  update app_private.event_reward_claim_reservations as reservation
  set claimed_at = coalesce(reservation.claimed_at, clock_timestamp())
  where reservation.id = p_reservation_id
  returning reservation.claimed_at into v_claimed_at;

  return query select v_claimed_at, false;
end;
$$;

-- New claim reservations require an immutable approved Reward Package.
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

  perform 1
  from app_private.event_reward_packages as package
  where package.reward_package_ref = p_reward_package_ref;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_UNAVAILABLE';
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

-- Lifecycle transition now initializes and enforces cleanup before end/archive.
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
  v_cleanup app_private.event_run_cleanup_state%rowtype;
  v_allowed boolean;
  v_next_version bigint;
  v_requires_cleanup boolean;
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

  if p_reason is null or char_length(p_reason) < 3 or char_length(p_reason) > 240 or btrim(p_reason) <> p_reason then
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

  v_requires_cleanup := v_run.run_mode = 'production' and v_run.started_at is not null;

  if p_to_status in ('resolving','cancelled','emergency-stopped','ended','archived') then
    perform app_private.prepare_event_run_cleanup_v1(p_run_id, v_requires_cleanup);
  end if;

  if p_to_status in ('ended','archived') then
    select * into v_cleanup
    from app_private.event_run_cleanup_state as state
    where state.run_id = p_run_id;

    if not found or v_cleanup.cleanup_status <> 'completed' then
      raise exception using errcode = '22023', message = 'EVENT_RUN_CLEANUP_INCOMPLETE';
    end if;
  end if;

  v_next_version := v_run.state_version + 1;

  update app_private.event_runs as run
  set
    lifecycle_status = p_to_status,
    state_version = v_next_version,
    updated_at = clock_timestamp(),
    started_at = case when p_to_status = 'live' and run.started_at is null then clock_timestamp() else run.started_at end,
    paused_at = case when p_to_status = 'paused' then clock_timestamp() else run.paused_at end,
    resolving_at = case when p_to_status = 'resolving' then clock_timestamp() else run.resolving_at end,
    ended_at = case when p_to_status = 'ended' then clock_timestamp() else run.ended_at end,
    archived_at = case when p_to_status = 'archived' then clock_timestamp() else run.archived_at end,
    cancelled_at = case when p_to_status = 'cancelled' then clock_timestamp() else run.cancelled_at end,
    emergency_stopped_at = case when p_to_status = 'emergency-stopped' then clock_timestamp() else run.emergency_stopped_at end
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

revoke all on function public.prepare_event_reward_claim_execution_v1(uuid)
  from public, anon, authenticated;
revoke all on function public.record_event_reward_claim_execution_v1(uuid,integer,text,uuid,bigint)
  from public, anon, authenticated;
revoke all on function public.record_event_cleanup_item_v1(uuid,text,integer,uuid,jsonb)
  from public, anon, authenticated;
revoke all on function public.reserve_event_reward_claim_v1(text,uuid,text,uuid,uuid,uuid,text,jsonb)
  from public, anon, authenticated;
revoke all on function public.transition_event_run_v1(uuid,bigint,uuid,text,text)
  from public, anon, authenticated;

grant execute on function public.prepare_event_reward_claim_execution_v1(uuid) to service_role;
grant execute on function public.record_event_reward_claim_execution_v1(uuid,integer,text,uuid,bigint)
  to service_role;
grant execute on function public.record_event_cleanup_item_v1(uuid,text,integer,uuid,jsonb)
  to service_role;
grant execute on function public.reserve_event_reward_claim_v1(text,uuid,text,uuid,uuid,uuid,text,jsonb)
  to service_role;
grant execute on function public.transition_event_run_v1(uuid,bigint,uuid,text,text)
  to service_role;

comment on table app_private.event_reward_budget_policies is
  'Immutable Owner-approved Event reward budget policies. P4.12 v1 supports Character XP only.';
comment on table app_private.event_reward_packages is
  'Immutable versioned Event Reward Packages. New reward meaning requires a new package reference/version.';
comment on table app_private.event_reward_claim_execution_entries is
  'External authoritative reward-service receipts. One v1 Character XP operation per claim reservation.';
comment on table app_private.event_run_cleanup_state is
  'Server-owned cleanup barrier. End/archive is blocked until required typed cleanup items complete.';
comment on table app_private.event_run_cleanup_items is
  'Typed cleanup work derived from the Event Run pinned immutable definition; completion requires a service receipt.';
comment on function public.prepare_event_reward_claim_execution_v1(uuid) is
  'Service-only immutable reward execution plan for a reserved Event claim.';
comment on function public.record_event_reward_claim_execution_v1(uuid,integer,text,uuid,bigint) is
  'Service-only receipt commit after the normal authoritative reward service succeeds.';
comment on function public.record_event_cleanup_item_v1(uuid,text,integer,uuid,jsonb) is
  'Service-only idempotent cleanup receipt; does not itself execute arbitrary world mutations.';

commit;
