begin;

create table app_private.event_authoring_audit (
  id uuid primary key default gen_random_uuid(),
  action text not null check (action in ('publish','schedule','unschedule')),
  correlation_key uuid not null,
  actor_user_id uuid not null,
  event_key text not null check (
    event_key ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  run_id uuid,
  reason text not null check (
    char_length(reason) between 3 and 240
    and btrim(reason) = reason
  ),
  result jsonb not null check (
    jsonb_typeof(result) = 'object'
    and result <> '{}'::jsonb
  ),
  occurred_at timestamptz not null default clock_timestamp(),
  unique (action, correlation_key)
);

alter table app_private.event_authoring_audit enable row level security;

revoke all on table app_private.event_authoring_audit
  from public, anon, authenticated, service_role;
grant select on table app_private.event_authoring_audit to service_role;

create or replace function app_private.prevent_event_authoring_audit_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, app_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'EVENT_AUTHORING_AUDIT_IMMUTABLE';
end;
$$;

create trigger prevent_event_authoring_audit_mutation_v1
before update or delete on app_private.event_authoring_audit
for each row execute function app_private.prevent_event_authoring_audit_mutation_v1();

create or replace function app_private.assert_sensitive_event_action_v1(
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
      message = 'EVENT_ACTION_CONFIRMATION_REQUIRED';
  end if;

  if p_reason is null
    or char_length(p_reason) not between 3 and 240
    or btrim(p_reason) <> p_reason
  then
    raise exception using
      errcode = '22023',
      message = 'EVENT_ACTION_REASON_REQUIRED';
  end if;
end;
$$;

revoke all on function app_private.assert_sensitive_event_action_v1(text,boolean)
  from public, anon, authenticated, service_role;

create or replace function public.publish_event_definition_v2(
  p_actor_user_id uuid,
  p_event_key text,
  p_definition jsonb,
  p_expected_base_version integer,
  p_correlation_key uuid,
  p_reason text,
  p_confirmed boolean
)
returns table (
  id uuid,
  event_key text,
  definition_version integer,
  definition jsonb,
  published_by uuid,
  published_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_existing app_private.event_authoring_audit%rowtype;
  v_published record;
begin
  perform app_private.assert_sensitive_event_action_v1(p_reason, p_confirmed);
  perform app_private.assert_event_production_publish_v1(
    p_actor_user_id,
    p_definition #>> '{scope,type}'
  );

  if p_correlation_key is null then
    raise exception using errcode = '22023', message = 'EVENT_ACTION_CORRELATION_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('aurevane:event-authoring-audit:publish:' || p_correlation_key::text, 0)
  );

  select *
  into v_existing
  from app_private.event_authoring_audit as audit
  where audit.action = 'publish'
    and audit.correlation_key = p_correlation_key;

  if found then
    if v_existing.event_key <> p_event_key
      or v_existing.actor_user_id <> p_actor_user_id
      or v_existing.reason <> p_reason
      or (v_existing.result -> 'request_definition') is distinct from p_definition
      or (v_existing.result ->> 'expected_base_version') is distinct from
        coalesce(p_expected_base_version::text, 'null')
    then
      raise exception using
        errcode = '22023',
        message = 'EVENT_AUTHORING_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      version.id,
      version.event_key,
      version.definition_version,
      version.definition,
      version.published_by,
      version.published_at
    from app_private.event_definition_versions as version
    where version.id = (v_existing.result ->> 'version_id')::uuid;

    if not found then
      raise exception using
        errcode = '55000',
        message = 'EVENT_AUTHORING_AUDIT_RESULT_UNAVAILABLE';
    end if;
    return;
  end if;

  select *
  into v_published
  from public.publish_event_definition_v1(
    p_actor_user_id,
    p_event_key,
    p_definition,
    p_expected_base_version
  );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_PUBLICATION_RESULT_UNAVAILABLE';
  end if;

  insert into app_private.event_authoring_audit (
    action,
    correlation_key,
    actor_user_id,
    event_key,
    run_id,
    reason,
    result
  ) values (
    'publish',
    p_correlation_key,
    p_actor_user_id,
    p_event_key,
    null,
    p_reason,
    jsonb_build_object(
      'version_id', v_published.id,
      'definition_version', v_published.definition_version,
      'request_definition', p_definition,
      'expected_base_version', coalesce(p_expected_base_version::text, 'null')
    )
  );

  return query
  select
    v_published.id,
    v_published.event_key,
    v_published.definition_version,
    v_published.definition,
    v_published.published_by,
    v_published.published_at;
end;
$$;

create or replace function public.schedule_event_run_v2(
  p_actor_user_id uuid,
  p_event_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz,
  p_reason text,
  p_confirmed boolean
)
returns table (
  run_id uuid,
  state_version bigint,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_existing app_private.event_authoring_audit%rowtype;
  v_scheduled record;
  v_replay_scope_type text;
begin
  perform app_private.assert_sensitive_event_action_v1(p_reason, p_confirmed);
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'EVENT_ACTION_CORRELATION_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('aurevane:event-authoring-audit:schedule:' || p_idempotency_key::text, 0)
  );

  select *
  into v_existing
  from app_private.event_authoring_audit as audit
  where audit.action = 'schedule'
    and audit.correlation_key = p_idempotency_key;

  if found then
    select run.scope_type
    into v_replay_scope_type
    from app_private.event_runs as run
    where run.id = v_existing.run_id;

    if not found then
      raise exception using
        errcode = '55000',
        message = 'EVENT_AUTHORING_AUDIT_RESULT_UNAVAILABLE';
    end if;

    perform app_private.assert_event_operational_scope_v1(
      p_actor_user_id,
      v_replay_scope_type
    );

    if v_existing.event_key <> p_event_key
      or v_existing.actor_user_id <> p_actor_user_id
      or v_existing.reason <> p_reason
      or v_existing.result ->> 'request_fingerprint' <> p_request_fingerprint
      or (v_existing.result ->> 'scheduled_start_at')::timestamptz
        is distinct from p_scheduled_start_at
      or (v_existing.result ->> 'scheduled_end_at') is distinct from
        coalesce(p_scheduled_end_at::text, 'null')
    then
      raise exception using
        errcode = '22023',
        message = 'EVENT_AUTHORING_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'run_id')::uuid,
      (v_existing.result ->> 'state_version')::bigint,
      true;
    return;
  end if;

  select *
  into v_scheduled
  from public.schedule_event_run_v1(
    p_actor_user_id,
    p_event_key,
    p_idempotency_key,
    p_request_fingerprint,
    p_scheduled_start_at,
    p_scheduled_end_at
  );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_SCHEDULE_RESULT_UNAVAILABLE';
  end if;

  insert into app_private.event_authoring_audit (
    action,
    correlation_key,
    actor_user_id,
    event_key,
    run_id,
    reason,
    result
  ) values (
    'schedule',
    p_idempotency_key,
    p_actor_user_id,
    p_event_key,
    v_scheduled.run_id,
    p_reason,
    jsonb_build_object(
      'run_id', v_scheduled.run_id,
      'state_version', v_scheduled.state_version,
      'request_fingerprint', p_request_fingerprint,
      'scheduled_start_at', p_scheduled_start_at,
      'scheduled_end_at', coalesce(p_scheduled_end_at::text, 'null')
    )
  );

  return query
  select v_scheduled.run_id, v_scheduled.state_version, v_scheduled.replayed;
end;
$$;

create or replace function public.cancel_scheduled_event_run_v2(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
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
declare
  v_existing app_private.event_authoring_audit%rowtype;
  v_event_key text;
  v_replay_scope_type text;
  v_transition record;
begin
  perform app_private.assert_sensitive_event_action_v1(p_reason, p_confirmed);
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  if p_idempotency_key is null then
    raise exception using errcode = '22023', message = 'EVENT_ACTION_CORRELATION_REQUIRED';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('aurevane:event-authoring-audit:unschedule:' || p_idempotency_key::text, 0)
  );

  select *
  into v_existing
  from app_private.event_authoring_audit as audit
  where audit.action = 'unschedule'
    and audit.correlation_key = p_idempotency_key;

  if found then
    select run.scope_type
    into v_replay_scope_type
    from app_private.event_runs as run
    where run.id = p_run_id;

    if not found then
      raise exception using
        errcode = '55000',
        message = 'EVENT_AUTHORING_AUDIT_RESULT_UNAVAILABLE';
    end if;

    perform app_private.assert_event_operational_scope_v1(
      p_actor_user_id,
      v_replay_scope_type
    );

    if v_existing.run_id <> p_run_id
      or v_existing.actor_user_id <> p_actor_user_id
      or v_existing.reason <> p_reason
      or (v_existing.result ->> 'expected_state_version')::bigint
        <> p_expected_state_version
    then
      raise exception using
        errcode = '22023',
        message = 'EVENT_AUTHORING_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      p_run_id,
      v_existing.result ->> 'lifecycle_status',
      (v_existing.result ->> 'state_version')::bigint,
      true;
    return;
  end if;

  select run.event_key
  into v_event_key
  from app_private.event_runs as run
  where run.id = p_run_id;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_SCHEDULED_RUN_REQUIRED';
  end if;

  select *
  into v_transition
  from public.cancel_scheduled_event_run_v1(
    p_actor_user_id,
    p_run_id,
    p_expected_state_version,
    p_idempotency_key,
    p_reason
  );

  if not found then
    raise exception using
      errcode = '55000',
      message = 'EVENT_UNSCHEDULE_RESULT_UNAVAILABLE';
  end if;

  insert into app_private.event_authoring_audit (
    action,
    correlation_key,
    actor_user_id,
    event_key,
    run_id,
    reason,
    result
  ) values (
    'unschedule',
    p_idempotency_key,
    p_actor_user_id,
    v_event_key,
    p_run_id,
    p_reason,
    jsonb_build_object(
      'lifecycle_status', v_transition.lifecycle_status,
      'state_version', v_transition.state_version,
      'expected_state_version', p_expected_state_version
    )
  );

  return query
  select
    v_transition.run_id,
    v_transition.lifecycle_status,
    v_transition.state_version,
    v_transition.replayed;
end;
$$;

revoke execute on function public.publish_event_definition_v1(uuid,text,jsonb,integer)
  from service_role;
revoke execute on function public.schedule_event_run_v1(uuid,text,uuid,text,timestamptz,timestamptz)
  from service_role;
revoke execute on function public.cancel_scheduled_event_run_v1(uuid,uuid,bigint,uuid,text)
  from service_role;

revoke all on function public.publish_event_definition_v2(
  uuid,text,jsonb,integer,uuid,text,boolean
) from public, anon, authenticated;
revoke all on function public.schedule_event_run_v2(
  uuid,text,uuid,text,timestamptz,timestamptz,text,boolean
) from public, anon, authenticated;
revoke all on function public.cancel_scheduled_event_run_v2(
  uuid,uuid,bigint,uuid,text,boolean
) from public, anon, authenticated;

grant execute on function public.publish_event_definition_v2(
  uuid,text,jsonb,integer,uuid,text,boolean
) to service_role;
grant execute on function public.schedule_event_run_v2(
  uuid,text,uuid,text,timestamptz,timestamptz,text,boolean
) to service_role;
grant execute on function public.cancel_scheduled_event_run_v2(
  uuid,uuid,bigint,uuid,text,boolean
) to service_role;

comment on table app_private.event_authoring_audit is
  'Append-only audit of sensitive P4.13 Event publication/scheduling actions with explicit operator reason, confirmation correlation and immutable result provenance.';
comment on function public.publish_event_definition_v2(
  uuid,text,jsonb,integer,uuid,text,boolean
) is
  'Audited P4.13 immutable publication. Requires explicit confirmation, operator reason and the normal Production publication capability.';
comment on function public.schedule_event_run_v2(
  uuid,text,uuid,text,timestamptz,timestamptz,text,boolean
) is
  'Audited P4.13 scheduler. Requires explicit confirmation/reason and preserves idempotent pinned-run behavior.';
comment on function public.cancel_scheduled_event_run_v2(
  uuid,uuid,bigint,uuid,text,boolean
) is
  'Audited P4.13 unschedule operation. Requires explicit confirmation/reason and preserves lifecycle idempotency.';

commit;
