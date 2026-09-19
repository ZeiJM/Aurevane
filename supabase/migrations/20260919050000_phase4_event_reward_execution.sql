begin;

-- Event participation/claim history is durable provenance and must survive account/character deletion.
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
    budget_ref ~ '^[a-z0-9][a-z0-9._:-]{1,159}
create table app_private.event_reward_claim_executions (
  reservation_id uuid primary key
    references app_private.event_reward_claim_reservations(id) on delete restrict,
  run_id uuid not null,
  character_id uuid not null,
  reward_package_ref text not null
    references app_private.event_reward_packages(reward_package_ref) on update restrict on delete restrict,
  xp_grant_id uuid not null unique
    references app_private.character_xp_grants(id) on delete restrict,
  requested_amount bigint not null check (requested_amount > 0),
  applied_amount bigint not null check (applied_amount >= 0 and applied_amount <= requested_amount),
  executed_at timestamptz not null default clock_timestamp(),
  foreign key (run_id, character_id, reward_package_ref)
    references app_private.event_reward_claim_reservations(
      run_id, character_id, reward_package_ref
    )
    on update restrict on delete restrict
);

comment on table app_private.event_reward_claim_executions is
  'Append-only Event reward execution receipts. One claim reservation can execute at most once; XP application is delegated to grant_character_xp_v1.';

create index event_reward_claim_executions_run_idx
  on app_private.event_reward_claim_executions(run_id, executed_at);
create index event_reward_claim_executions_character_idx
  on app_private.event_reward_claim_executions(character_id, executed_at);

alter table app_private.event_reward_budget_policies enable row level security;
alter table app_private.event_reward_packages enable row level security;
alter table app_private.event_reward_claim_executions enable row level security;

revoke all on table app_private.event_reward_budget_policies
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_reward_packages
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_reward_claim_executions
  from public, anon, authenticated, service_role;

grant select on table app_private.event_reward_budget_policies to service_role;
grant select on table app_private.event_reward_packages to service_role;
grant select on table app_private.event_reward_claim_executions to service_role;

create or replace function public.execute_event_reward_claim_v1(
  p_reservation_id uuid,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_authority_key text
)
returns table (
  reservation_id uuid,
  reward_package_ref text,
  xp_grant_id uuid,
  requested_amount bigint,
  applied_amount bigint,
  executed_at timestamptz,
  replayed boolean,
  claim_deduplicated boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_command_name constant text := 'event.reward-claim.execute.v1';
  v_existing app_private.idempotency_records%rowtype;
  v_reservation app_private.event_reward_claim_reservations%rowtype;
  v_run app_private.event_runs%rowtype;
  v_package app_private.event_reward_packages%rowtype;
  v_execution app_private.event_reward_claim_executions%rowtype;
  v_xp record;
  v_executed_at timestamptz := clock_timestamp();
  v_xp_fingerprint text;
begin
  if p_reservation_id is null
    or p_idempotency_key is null
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160
    or p_authority_key is null
    or char_length(p_authority_key) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_INVALID';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_authority_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'reservation_id')::uuid <> p_reservation_id then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'xp_grant_id')::uuid,
      (v_existing.result ->> 'requested_amount')::bigint,
      (v_existing.result ->> 'applied_amount')::bigint,
      (v_existing.result ->> 'executed_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_reservation
  from app_private.event_reward_claim_reservations as reservation
  where reservation.id = p_reservation_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_RESERVATION_NOT_FOUND';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_authority_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'reservation_id')::uuid <> p_reservation_id then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'xp_grant_id')::uuid,
      (v_existing.result ->> 'requested_amount')::bigint,
      (v_existing.result ->> 'applied_amount')::bigint,
      (v_existing.result ->> 'executed_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_execution
  from app_private.event_reward_claim_executions as execution
  where execution.reservation_id = p_reservation_id;

  if found then
    insert into app_private.idempotency_records (
      actor_key, command_name, idempotency_key, request_fingerprint, result
    ) values (
      p_authority_key,
      v_command_name,
      p_idempotency_key,
      p_request_fingerprint,
      jsonb_build_object(
        'reservation_id', v_execution.reservation_id,
        'reward_package_ref', v_execution.reward_package_ref,
        'xp_grant_id', v_execution.xp_grant_id,
        'requested_amount', v_execution.requested_amount,
        'applied_amount', v_execution.applied_amount,
        'executed_at', v_execution.executed_at,
        'claim_deduplicated', true
      )
    );

    return query
    select
      v_execution.reservation_id,
      v_execution.reward_package_ref,
      v_execution.xp_grant_id,
      v_execution.requested_amount,
      v_execution.applied_amount,
      v_execution.executed_at,
      false,
      true;
    return;
  end if;

  select * into v_run
  from app_private.event_runs as run
  where run.id = v_reservation.run_id
  for update;

  if not found
    or v_run.run_mode <> 'production'
    or v_run.lifecycle_status not in ('ended', 'archived') then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_RUN_NOT_TERMINAL';
  end if;

  perform 1
  from public.characters as character
  where character.id = v_reservation.character_id
    and character.user_id = v_reservation.user_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_CHARACTER_NOT_FOUND';
  end if;

  select * into v_package
  from app_private.event_reward_packages as package
  where package.reward_package_ref = v_reservation.reward_package_ref;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_UNAVAILABLE';
  end if;

  if v_package.reward_kind <> 'character-xp' then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_KIND_UNSUPPORTED';
  end if;

  v_xp_fingerprint := md5(
    concat_ws(
      '|',
      'event-reward-v1',
      v_reservation.id::text,
      v_reservation.run_id::text,
      v_reservation.character_id::text,
      v_package.reward_package_ref,
      v_package.package_version::text,
      v_package.amount::text
    )
  );

  select * into v_xp
  from public.grant_character_xp_v1(
    v_reservation.character_id,
    v_reservation.id,
    v_xp_fingerprint,
    'system:event-reward-service',
    'gameplay',
    'event.reward:' || v_reservation.id::text,
    'event.reward',
    v_package.amount
  );

  if not found or v_xp.grant_id is null then
    raise exception using errcode = '55000', message = 'EVENT_REWARD_XP_GRANT_UNAVAILABLE';
  end if;

  insert into app_private.event_reward_claim_executions (
    reservation_id,
    run_id,
    character_id,
    reward_package_ref,
    xp_grant_id,
    requested_amount,
    applied_amount,
    executed_at
  ) values (
    v_reservation.id,
    v_reservation.run_id,
    v_reservation.character_id,
    v_reservation.reward_package_ref,
    v_xp.grant_id,
    v_package.amount,
    v_xp.applied_amount,
    v_executed_at
  )
  returning * into v_execution;

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    p_authority_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'reservation_id', v_execution.reservation_id,
      'reward_package_ref', v_execution.reward_package_ref,
      'xp_grant_id', v_execution.xp_grant_id,
      'requested_amount', v_execution.requested_amount,
      'applied_amount', v_execution.applied_amount,
      'executed_at', v_execution.executed_at,
      'claim_deduplicated', false
    )
  );

  return query
  select
    v_execution.reservation_id,
    v_execution.reward_package_ref,
    v_execution.xp_grant_id,
    v_execution.requested_amount,
    v_execution.applied_amount,
    v_execution.executed_at,
    false,
    false;
end;
$$;

revoke all on function public.execute_event_reward_claim_v1(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.execute_event_reward_claim_v1(uuid,uuid,text,text)
  to service_role;

comment on function public.execute_event_reward_claim_v1(uuid,uuid,text,text) is
  'P4.12 service-only Event reward execution. V1 supports immutable Character XP packages and delegates application/idempotency to the normal XP grant service.';

commit;

  ),
  reward_kind text not null check (reward_kind = 'character-xp'),
  max_per_claim bigint not null check (max_per_claim > 0),
  approved_by uuid not null,
  approved_at timestamptz not null default clock_timestamp()
);

create table app_private.event_reward_packages (
  reward_package_ref text primary key check (
    reward_package_ref ~ '^[a-z0-9][a-z0-9._:-]{1,159}
create table app_private.event_reward_claim_executions (
  reservation_id uuid primary key
    references app_private.event_reward_claim_reservations(id) on delete restrict,
  run_id uuid not null,
  character_id uuid not null,
  reward_package_ref text not null
    references app_private.event_reward_packages(reward_package_ref) on update restrict on delete restrict,
  xp_grant_id uuid not null unique
    references app_private.character_xp_grants(id) on delete restrict,
  requested_amount bigint not null check (requested_amount > 0),
  applied_amount bigint not null check (applied_amount >= 0 and applied_amount <= requested_amount),
  executed_at timestamptz not null default clock_timestamp(),
  foreign key (run_id, character_id, reward_package_ref)
    references app_private.event_reward_claim_reservations(
      run_id, character_id, reward_package_ref
    )
    on update restrict on delete restrict
);

comment on table app_private.event_reward_claim_executions is
  'Append-only Event reward execution receipts. One claim reservation can execute at most once; XP application is delegated to grant_character_xp_v1.';

create index event_reward_claim_executions_run_idx
  on app_private.event_reward_claim_executions(run_id, executed_at);
create index event_reward_claim_executions_character_idx
  on app_private.event_reward_claim_executions(character_id, executed_at);

alter table app_private.event_reward_packages enable row level security;
alter table app_private.event_reward_claim_executions enable row level security;

revoke all on table app_private.event_reward_packages
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_reward_claim_executions
  from public, anon, authenticated, service_role;

grant select on table app_private.event_reward_packages to service_role;
grant select on table app_private.event_reward_claim_executions to service_role;

create or replace function public.execute_event_reward_claim_v1(
  p_reservation_id uuid,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_authority_key text
)
returns table (
  reservation_id uuid,
  reward_package_ref text,
  xp_grant_id uuid,
  requested_amount bigint,
  applied_amount bigint,
  executed_at timestamptz,
  replayed boolean,
  claim_deduplicated boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_command_name constant text := 'event.reward-claim.execute.v1';
  v_existing app_private.idempotency_records%rowtype;
  v_reservation app_private.event_reward_claim_reservations%rowtype;
  v_run app_private.event_runs%rowtype;
  v_package app_private.event_reward_packages%rowtype;
  v_execution app_private.event_reward_claim_executions%rowtype;
  v_xp record;
  v_executed_at timestamptz := clock_timestamp();
  v_xp_fingerprint text;
begin
  if p_reservation_id is null
    or p_idempotency_key is null
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160
    or p_authority_key is null
    or char_length(p_authority_key) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_INVALID';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_authority_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'reservation_id')::uuid <> p_reservation_id then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'xp_grant_id')::uuid,
      (v_existing.result ->> 'requested_amount')::bigint,
      (v_existing.result ->> 'applied_amount')::bigint,
      (v_existing.result ->> 'executed_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_reservation
  from app_private.event_reward_claim_reservations as reservation
  where reservation.id = p_reservation_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_RESERVATION_NOT_FOUND';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_authority_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'reservation_id')::uuid <> p_reservation_id then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'xp_grant_id')::uuid,
      (v_existing.result ->> 'requested_amount')::bigint,
      (v_existing.result ->> 'applied_amount')::bigint,
      (v_existing.result ->> 'executed_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_execution
  from app_private.event_reward_claim_executions as execution
  where execution.reservation_id = p_reservation_id;

  if found then
    insert into app_private.idempotency_records (
      actor_key, command_name, idempotency_key, request_fingerprint, result
    ) values (
      p_authority_key,
      v_command_name,
      p_idempotency_key,
      p_request_fingerprint,
      jsonb_build_object(
        'reservation_id', v_execution.reservation_id,
        'reward_package_ref', v_execution.reward_package_ref,
        'xp_grant_id', v_execution.xp_grant_id,
        'requested_amount', v_execution.requested_amount,
        'applied_amount', v_execution.applied_amount,
        'executed_at', v_execution.executed_at,
        'claim_deduplicated', true
      )
    );

    return query
    select
      v_execution.reservation_id,
      v_execution.reward_package_ref,
      v_execution.xp_grant_id,
      v_execution.requested_amount,
      v_execution.applied_amount,
      v_execution.executed_at,
      false,
      true;
    return;
  end if;

  select * into v_run
  from app_private.event_runs as run
  where run.id = v_reservation.run_id
  for update;

  if not found
    or v_run.run_mode <> 'production'
    or v_run.lifecycle_status not in ('ended', 'archived') then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_RUN_NOT_TERMINAL';
  end if;

  perform 1
  from public.characters as character
  where character.id = v_reservation.character_id
    and character.user_id = v_reservation.user_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_CHARACTER_NOT_FOUND';
  end if;

  select * into v_package
  from app_private.event_reward_packages as package
  where package.reward_package_ref = v_reservation.reward_package_ref;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_UNAVAILABLE';
  end if;

  if v_package.reward_kind <> 'character-xp' then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_KIND_UNSUPPORTED';
  end if;

  v_xp_fingerprint := md5(
    concat_ws(
      '|',
      'event-reward-v1',
      v_reservation.id::text,
      v_reservation.run_id::text,
      v_reservation.character_id::text,
      v_package.reward_package_ref,
      v_package.package_version::text,
      v_package.amount::text
    )
  );

  select * into v_xp
  from public.grant_character_xp_v1(
    v_reservation.character_id,
    v_reservation.id,
    v_xp_fingerprint,
    'system:event-reward-service',
    'gameplay',
    'event.reward:' || v_reservation.id::text,
    'event.reward',
    v_package.amount
  );

  if not found or v_xp.grant_id is null then
    raise exception using errcode = '55000', message = 'EVENT_REWARD_XP_GRANT_UNAVAILABLE';
  end if;

  insert into app_private.event_reward_claim_executions (
    reservation_id,
    run_id,
    character_id,
    reward_package_ref,
    xp_grant_id,
    requested_amount,
    applied_amount,
    executed_at
  ) values (
    v_reservation.id,
    v_reservation.run_id,
    v_reservation.character_id,
    v_reservation.reward_package_ref,
    v_xp.grant_id,
    v_package.amount,
    v_xp.applied_amount,
    v_executed_at
  )
  returning * into v_execution;

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    p_authority_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'reservation_id', v_execution.reservation_id,
      'reward_package_ref', v_execution.reward_package_ref,
      'xp_grant_id', v_execution.xp_grant_id,
      'requested_amount', v_execution.requested_amount,
      'applied_amount', v_execution.applied_amount,
      'executed_at', v_execution.executed_at,
      'claim_deduplicated', false
    )
  );

  return query
  select
    v_execution.reservation_id,
    v_execution.reward_package_ref,
    v_execution.xp_grant_id,
    v_execution.requested_amount,
    v_execution.applied_amount,
    v_execution.executed_at,
    false,
    false;
end;
$$;

revoke all on function public.execute_event_reward_claim_v1(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.execute_event_reward_claim_v1(uuid,uuid,text,text)
  to service_role;

comment on function public.execute_event_reward_claim_v1(uuid,uuid,text,text) is
  'P4.12 service-only Event reward execution. V1 supports immutable Character XP packages and delegates application/idempotency to the normal XP grant service.';

commit;

  ),
  package_version integer not null check (package_version > 0),
  budget_ref text not null references app_private.event_reward_budget_policies(budget_ref)
    on update restrict on delete restrict,
  reward_kind text not null check (reward_kind = 'character-xp'),
  amount bigint not null check (amount > 0),
  published_by uuid not null,
  published_at timestamptz not null default clock_timestamp()
);

comment on table app_private.event_reward_budget_policies is
  'Immutable Owner-approved Event reward budget policies. P4.12 v1 supports Character XP only.';
comment on table app_private.event_reward_packages is
  'Immutable Event Reward Package catalog. P4.12 v1 supports only budget-approved Character XP and delegates application to the normal XP grant service.';

create or replace function app_private.validate_event_reward_package_budget_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $
declare
  v_budget app_private.event_reward_budget_policies%rowtype;
begin
  select * into v_budget
  from app_private.event_reward_budget_policies as policy
  where policy.budget_ref = new.budget_ref;

  if not found or v_budget.reward_kind <> new.reward_kind then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_BUDGET_UNAVAILABLE';
  end if;

  if new.amount > v_budget.max_per_claim then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_BUDGET_EXCEEDED';
  end if;

  return new;
end;
$;

create trigger validate_event_reward_package_budget_v1
before insert on app_private.event_reward_packages
for each row execute function app_private.validate_event_reward_package_budget_v1();

create or replace function app_private.prevent_event_reward_package_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $
begin
  raise exception using errcode = '55000', message = 'EVENT_REWARD_PACKAGE_IMMUTABLE';
end;
$;

create trigger prevent_event_reward_package_mutation_v1
before update or delete on app_private.event_reward_packages
for each row execute function app_private.prevent_event_reward_package_mutation_v1();

create or replace function app_private.prevent_event_reward_budget_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $
begin
  raise exception using errcode = '55000', message = 'EVENT_REWARD_BUDGET_IMMUTABLE';
end;
$;

create trigger prevent_event_reward_budget_mutation_v1
before update or delete on app_private.event_reward_budget_policies
for each row execute function app_private.prevent_event_reward_budget_mutation_v1();

create table app_private.event_reward_claim_executions (
  reservation_id uuid primary key
    references app_private.event_reward_claim_reservations(id) on delete restrict,
  run_id uuid not null,
  character_id uuid not null,
  reward_package_ref text not null
    references app_private.event_reward_packages(reward_package_ref) on update restrict on delete restrict,
  xp_grant_id uuid not null unique
    references app_private.character_xp_grants(id) on delete restrict,
  requested_amount bigint not null check (requested_amount > 0),
  applied_amount bigint not null check (applied_amount >= 0 and applied_amount <= requested_amount),
  executed_at timestamptz not null default clock_timestamp(),
  foreign key (run_id, character_id, reward_package_ref)
    references app_private.event_reward_claim_reservations(
      run_id, character_id, reward_package_ref
    )
    on update restrict on delete restrict
);

comment on table app_private.event_reward_claim_executions is
  'Append-only Event reward execution receipts. One claim reservation can execute at most once; XP application is delegated to grant_character_xp_v1.';

create index event_reward_claim_executions_run_idx
  on app_private.event_reward_claim_executions(run_id, executed_at);
create index event_reward_claim_executions_character_idx
  on app_private.event_reward_claim_executions(character_id, executed_at);

alter table app_private.event_reward_packages enable row level security;
alter table app_private.event_reward_claim_executions enable row level security;

revoke all on table app_private.event_reward_packages
  from public, anon, authenticated, service_role;
revoke all on table app_private.event_reward_claim_executions
  from public, anon, authenticated, service_role;

grant select on table app_private.event_reward_packages to service_role;
grant select on table app_private.event_reward_claim_executions to service_role;

create or replace function public.execute_event_reward_claim_v1(
  p_reservation_id uuid,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_authority_key text
)
returns table (
  reservation_id uuid,
  reward_package_ref text,
  xp_grant_id uuid,
  requested_amount bigint,
  applied_amount bigint,
  executed_at timestamptz,
  replayed boolean,
  claim_deduplicated boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
#variable_conflict use_column
declare
  v_command_name constant text := 'event.reward-claim.execute.v1';
  v_existing app_private.idempotency_records%rowtype;
  v_reservation app_private.event_reward_claim_reservations%rowtype;
  v_run app_private.event_runs%rowtype;
  v_package app_private.event_reward_packages%rowtype;
  v_execution app_private.event_reward_claim_executions%rowtype;
  v_xp record;
  v_executed_at timestamptz := clock_timestamp();
  v_xp_fingerprint text;
begin
  if p_reservation_id is null
    or p_idempotency_key is null
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160
    or p_authority_key is null
    or char_length(p_authority_key) not between 1 and 160 then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_INVALID';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_authority_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'reservation_id')::uuid <> p_reservation_id then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'xp_grant_id')::uuid,
      (v_existing.result ->> 'requested_amount')::bigint,
      (v_existing.result ->> 'applied_amount')::bigint,
      (v_existing.result ->> 'executed_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_reservation
  from app_private.event_reward_claim_reservations as reservation
  where reservation.id = p_reservation_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_RESERVATION_NOT_FOUND';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = p_authority_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or (v_existing.result ->> 'reservation_id')::uuid <> p_reservation_id then
      raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'reservation_id')::uuid,
      v_existing.result ->> 'reward_package_ref',
      (v_existing.result ->> 'xp_grant_id')::uuid,
      (v_existing.result ->> 'requested_amount')::bigint,
      (v_existing.result ->> 'applied_amount')::bigint,
      (v_existing.result ->> 'executed_at')::timestamptz,
      true,
      (v_existing.result ->> 'claim_deduplicated')::boolean;
    return;
  end if;

  select * into v_execution
  from app_private.event_reward_claim_executions as execution
  where execution.reservation_id = p_reservation_id;

  if found then
    insert into app_private.idempotency_records (
      actor_key, command_name, idempotency_key, request_fingerprint, result
    ) values (
      p_authority_key,
      v_command_name,
      p_idempotency_key,
      p_request_fingerprint,
      jsonb_build_object(
        'reservation_id', v_execution.reservation_id,
        'reward_package_ref', v_execution.reward_package_ref,
        'xp_grant_id', v_execution.xp_grant_id,
        'requested_amount', v_execution.requested_amount,
        'applied_amount', v_execution.applied_amount,
        'executed_at', v_execution.executed_at,
        'claim_deduplicated', true
      )
    );

    return query
    select
      v_execution.reservation_id,
      v_execution.reward_package_ref,
      v_execution.xp_grant_id,
      v_execution.requested_amount,
      v_execution.applied_amount,
      v_execution.executed_at,
      false,
      true;
    return;
  end if;

  select * into v_run
  from app_private.event_runs as run
  where run.id = v_reservation.run_id
  for update;

  if not found
    or v_run.run_mode <> 'production'
    or v_run.lifecycle_status not in ('ended', 'archived') then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_RUN_NOT_TERMINAL';
  end if;

  perform 1
  from public.characters as character
  where character.id = v_reservation.character_id
    and character.user_id = v_reservation.user_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_EXECUTION_CHARACTER_NOT_FOUND';
  end if;

  select * into v_package
  from app_private.event_reward_packages as package
  where package.reward_package_ref = v_reservation.reward_package_ref;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_UNAVAILABLE';
  end if;

  if v_package.reward_kind <> 'character-xp' then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_KIND_UNSUPPORTED';
  end if;

  v_xp_fingerprint := md5(
    concat_ws(
      '|',
      'event-reward-v1',
      v_reservation.id::text,
      v_reservation.run_id::text,
      v_reservation.character_id::text,
      v_package.reward_package_ref,
      v_package.package_version::text,
      v_package.amount::text
    )
  );

  select * into v_xp
  from public.grant_character_xp_v1(
    v_reservation.character_id,
    v_reservation.id,
    v_xp_fingerprint,
    'system:event-reward-service',
    'gameplay',
    'event.reward:' || v_reservation.id::text,
    'event.reward',
    v_package.amount
  );

  if not found or v_xp.grant_id is null then
    raise exception using errcode = '55000', message = 'EVENT_REWARD_XP_GRANT_UNAVAILABLE';
  end if;

  insert into app_private.event_reward_claim_executions (
    reservation_id,
    run_id,
    character_id,
    reward_package_ref,
    xp_grant_id,
    requested_amount,
    applied_amount,
    executed_at
  ) values (
    v_reservation.id,
    v_reservation.run_id,
    v_reservation.character_id,
    v_reservation.reward_package_ref,
    v_xp.grant_id,
    v_package.amount,
    v_xp.applied_amount,
    v_executed_at
  )
  returning * into v_execution;

  insert into app_private.idempotency_records (
    actor_key, command_name, idempotency_key, request_fingerprint, result
  ) values (
    p_authority_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'reservation_id', v_execution.reservation_id,
      'reward_package_ref', v_execution.reward_package_ref,
      'xp_grant_id', v_execution.xp_grant_id,
      'requested_amount', v_execution.requested_amount,
      'applied_amount', v_execution.applied_amount,
      'executed_at', v_execution.executed_at,
      'claim_deduplicated', false
    )
  );

  return query
  select
    v_execution.reservation_id,
    v_execution.reward_package_ref,
    v_execution.xp_grant_id,
    v_execution.requested_amount,
    v_execution.applied_amount,
    v_execution.executed_at,
    false,
    false;
end;
$$;

revoke all on function public.execute_event_reward_claim_v1(uuid,uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.execute_event_reward_claim_v1(uuid,uuid,text,text)
  to service_role;

comment on function public.execute_event_reward_claim_v1(uuid,uuid,text,text) is
  'P4.12 service-only Event reward execution. V1 supports immutable Character XP packages and delegates application/idempotency to the normal XP grant service.';

commit;
