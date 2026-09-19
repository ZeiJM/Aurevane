begin;

create table app_private.event_operations_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null check (
    action in ('lifecycle','phase-advance','cleanup')
  ),
  correlation_key uuid not null,
  actor_user_id uuid not null,
  run_id uuid not null references app_private.event_runs(id) on update restrict on delete restrict,
  command text,
  phase_id text,
  effect_ordinal integer,
  expected_state_version bigint,
  reason text not null check (
    char_length(reason) between 3 and 240
    and btrim(reason) = reason
  ),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result <> '{}'::jsonb
  ),
  occurred_at timestamptz not null default clock_timestamp(),
  unique (action, correlation_key),
  check (
    (
      action = 'lifecycle'
      and command is not null
      and phase_id is null
      and effect_ordinal is null
      and expected_state_version is not null
    )
    or
    (
      action = 'phase-advance'
      and command is null
      and phase_id is null
      and effect_ordinal is null
      and expected_state_version is not null
    )
    or
    (
      action = 'cleanup'
      and command is null
      and phase_id is not null
      and effect_ordinal is not null
      and effect_ordinal >= 0
      and expected_state_version is null
    )
  )
);

alter table app_private.event_operations_audit enable row level security;

revoke all on table app_private.event_operations_audit
  from public, anon, authenticated, service_role;
grant select on table app_private.event_operations_audit to service_role;

create or replace function app_private.prevent_event_operations_audit_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, app_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'EVENT_OPERATIONS_AUDIT_IMMUTABLE';
end;
$$;

create trigger prevent_event_operations_audit_mutation_v1
before update or delete on app_private.event_operations_audit
for each row execute function app_private.prevent_event_operations_audit_mutation_v1();

create or replace function app_private.assert_confirmed_event_operation_v1(
  p_reason text,
  p_confirmed boolean
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, app_private
as $$
begin
  if p_confirmed is distinct from true then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_CONFIRMATION_REQUIRED';
  end if;

  if p_reason is null
    or char_length(p_reason) not between 3 and 240
    or btrim(p_reason) <> p_reason
  then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATION_REASON_REQUIRED';
  end if;
end;
$$;

revoke all on function app_private.assert_confirmed_event_operation_v1(text,boolean)
  from public, anon, authenticated, service_role;

create or replace function public.operate_event_run_v2(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
  p_command text,
  p_reason text,
  p_confirmed boolean
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
#variable_conflict use_column
declare
  v_result record;
  v_audit app_private.event_operations_audit%rowtype;
begin
  perform app_private.assert_confirmed_event_operation_v1(p_reason, p_confirmed);

  select *
  into v_result
  from public.operate_event_run_v1(
    p_actor_user_id,
    p_run_id,
    p_expected_state_version,
    p_idempotency_key,
    p_command,
    p_reason
  );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_OPERATION_RESULT_UNAVAILABLE';
  end if;

  insert into app_private.event_operations_audit (
    action,
    correlation_key,
    actor_user_id,
    run_id,
    command,
    expected_state_version,
    reason,
    result
  ) values (
    'lifecycle',
    p_idempotency_key,
    p_actor_user_id,
    p_run_id,
    p_command,
    p_expected_state_version,
    p_reason,
    jsonb_build_object(
      'lifecycle_status', v_result.lifecycle_status,
      'state_version', v_result.state_version
    )
  )
  on conflict (action, correlation_key) do nothing;

  select *
  into v_audit
  from app_private.event_operations_audit as audit
  where audit.action = 'lifecycle'
    and audit.correlation_key = p_idempotency_key;

  if not found
    or v_audit.actor_user_id <> p_actor_user_id
    or v_audit.run_id <> p_run_id
    or v_audit.command <> p_command
    or v_audit.expected_state_version <> p_expected_state_version
    or v_audit.reason <> p_reason
    or v_audit.result ->> 'lifecycle_status' <> v_result.lifecycle_status
    or (v_audit.result ->> 'state_version')::bigint <> v_result.state_version
  then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATIONS_AUDIT_CONFLICT';
  end if;

  return query
  select
    v_result.run_id,
    v_result.lifecycle_status,
    v_result.state_version,
    v_result.replayed;
end;
$$;

create or replace function public.advance_event_run_phase_v2(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
  p_reason text,
  p_confirmed boolean
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
#variable_conflict use_column
declare
  v_result record;
  v_audit app_private.event_operations_audit%rowtype;
begin
  perform app_private.assert_confirmed_event_operation_v1(p_reason, p_confirmed);

  select *
  into v_result
  from public.advance_event_run_phase_v1(
    p_actor_user_id,
    p_run_id,
    p_expected_state_version,
    p_idempotency_key,
    p_reason
  );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_PHASE_ADVANCE_RESULT_UNAVAILABLE';
  end if;

  insert into app_private.event_operations_audit (
    action,
    correlation_key,
    actor_user_id,
    run_id,
    expected_state_version,
    reason,
    result
  ) values (
    'phase-advance',
    p_idempotency_key,
    p_actor_user_id,
    p_run_id,
    p_expected_state_version,
    p_reason,
    jsonb_build_object(
      'current_phase_id', v_result.current_phase_id,
      'state_version', v_result.state_version
    )
  )
  on conflict (action, correlation_key) do nothing;

  select *
  into v_audit
  from app_private.event_operations_audit as audit
  where audit.action = 'phase-advance'
    and audit.correlation_key = p_idempotency_key;

  if not found
    or v_audit.actor_user_id <> p_actor_user_id
    or v_audit.run_id <> p_run_id
    or v_audit.expected_state_version <> p_expected_state_version
    or v_audit.reason <> p_reason
    or v_audit.result ->> 'current_phase_id' <> v_result.current_phase_id
    or (v_audit.result ->> 'state_version')::bigint <> v_result.state_version
  then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATIONS_AUDIT_CONFLICT';
  end if;

  return query
  select
    v_result.run_id,
    v_result.current_phase_id,
    v_result.state_version,
    v_result.replayed;
end;
$$;

create or replace function public.complete_event_cleanup_requirement_v2(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_phase_id text,
  p_effect_ordinal integer,
  p_completion_key uuid,
  p_reason text,
  p_confirmed boolean
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
#variable_conflict use_column
declare
  v_result record;
  v_audit app_private.event_operations_audit%rowtype;
begin
  perform app_private.assert_confirmed_event_operation_v1(p_reason, p_confirmed);

  select *
  into v_result
  from public.complete_event_cleanup_requirement_v1(
    p_actor_user_id,
    p_run_id,
    p_phase_id,
    p_effect_ordinal,
    p_completion_key,
    p_reason
  );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_CLEANUP_COMPLETION_RESULT_UNAVAILABLE';
  end if;

  insert into app_private.event_operations_audit (
    action,
    correlation_key,
    actor_user_id,
    run_id,
    phase_id,
    effect_ordinal,
    reason,
    result
  ) values (
    'cleanup',
    p_completion_key,
    p_actor_user_id,
    p_run_id,
    p_phase_id,
    p_effect_ordinal,
    p_reason,
    jsonb_build_object(
      'cleanup_status', v_result.cleanup_status,
      'state_version', v_result.state_version
    )
  )
  on conflict (action, correlation_key) do nothing;

  select *
  into v_audit
  from app_private.event_operations_audit as audit
  where audit.action = 'cleanup'
    and audit.correlation_key = p_completion_key;

  if not found
    or v_audit.actor_user_id <> p_actor_user_id
    or v_audit.run_id <> p_run_id
    or v_audit.phase_id <> p_phase_id
    or v_audit.effect_ordinal <> p_effect_ordinal
    or v_audit.reason <> p_reason
    or v_audit.result ->> 'cleanup_status' <> v_result.cleanup_status
    or (v_audit.result ->> 'state_version')::bigint <> v_result.state_version
  then
    raise exception using
      errcode = '22023',
      message = 'EVENT_OPERATIONS_AUDIT_CONFLICT';
  end if;

  return query
  select
    v_result.run_id,
    v_result.cleanup_status,
    v_result.state_version,
    v_result.replayed;
end;
$$;

revoke execute on function public.operate_event_run_v1(
  uuid,uuid,bigint,uuid,text,text
) from service_role;
revoke execute on function public.advance_event_run_phase_v1(
  uuid,uuid,bigint,uuid,text
) from service_role;
revoke execute on function public.complete_event_cleanup_requirement_v1(
  uuid,uuid,text,integer,uuid,text
) from service_role;

revoke all on function public.operate_event_run_v2(
  uuid,uuid,bigint,uuid,text,text,boolean
) from public, anon, authenticated;
revoke all on function public.advance_event_run_phase_v2(
  uuid,uuid,bigint,uuid,text,boolean
) from public, anon, authenticated;
revoke all on function public.complete_event_cleanup_requirement_v2(
  uuid,uuid,text,integer,uuid,text,boolean
) from public, anon, authenticated;

grant execute on function public.operate_event_run_v2(
  uuid,uuid,bigint,uuid,text,text,boolean
) to service_role;
grant execute on function public.advance_event_run_phase_v2(
  uuid,uuid,bigint,uuid,text,boolean
) to service_role;
grant execute on function public.complete_event_cleanup_requirement_v2(
  uuid,uuid,text,integer,uuid,text,boolean
) to service_role;

comment on table app_private.event_operations_audit is
  'Append-only P4.14 audit for confirmed staff lifecycle, manual phase and cleanup actions. Recovery/internal automatic transitions remain separately receipted by their authoritative state tables.';
comment on function public.operate_event_run_v2(
  uuid,uuid,bigint,uuid,text,text,boolean
) is
  'Audited P4.14 staff lifecycle operation requiring reason and fresh explicit confirmation.';
comment on function public.advance_event_run_phase_v2(
  uuid,uuid,bigint,uuid,text,boolean
) is
  'Audited P4.14 manual phase advance requiring reason and fresh explicit confirmation.';
comment on function public.complete_event_cleanup_requirement_v2(
  uuid,uuid,text,integer,uuid,text,boolean
) is
  'Audited P4.14 cleanup acknowledgement requiring reason and fresh explicit confirmation.';

commit;
