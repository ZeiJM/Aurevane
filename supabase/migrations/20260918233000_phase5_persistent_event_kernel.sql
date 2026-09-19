begin;

create table app_private.event_templates (
  event_key text primary key check (char_length(event_key) between 3 and 160),
  event_family text not null check (
    event_family in (
      'world-crisis','regional-event','narrative-event','community-objective',
      'legendary-hunt','expedition-event','pvp-event','seasonal-event',
      'nation-event','profession-event','micro-event','lore-revelation'
    )
  ),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp()
);

create table app_private.event_definition_versions (
  id uuid primary key default gen_random_uuid(),
  event_key text not null references app_private.event_templates(event_key) on delete restrict,
  definition_version integer not null check (definition_version > 0),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  published_by uuid not null references auth.users(id),
  published_at timestamptz not null default clock_timestamp(),
  unique (event_key, definition_version),
  unique (id, event_key)
);

create table app_private.event_publications (
  event_key text primary key references app_private.event_templates(event_key) on delete restrict,
  version_id uuid not null,
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (version_id, event_key)
    references app_private.event_definition_versions(id, event_key)
    on update restrict on delete restrict
);

create table app_private.event_runs (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  definition_version_id uuid not null,
  run_mode text not null check (run_mode in ('preview','production')),
  lifecycle_status text not null check (
    lifecycle_status in (
      'preview','scheduled','live','paused','resolving',
      'ended','archived','cancelled','emergency-stopped'
    )
  ),
  scope_type text not null check (scope_type in ('global','region','node','cohort')),
  scope_key text,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  current_phase_id text,
  state_version bigint not null default 1 check (state_version > 0),
  started_at timestamptz,
  paused_at timestamptz,
  resolving_at timestamptz,
  ended_at timestamptz,
  archived_at timestamptz,
  cancelled_at timestamptz,
  emergency_stopped_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  foreign key (definition_version_id, event_key)
    references app_private.event_definition_versions(id, event_key)
    on update restrict on delete restrict,
  check (
    (scope_type = 'global' and scope_key is null)
    or
    (scope_type <> 'global' and scope_key is not null and char_length(scope_key) between 3 and 160)
  ),
  check (
    scheduled_end_at is null
    or scheduled_start_at is null
    or scheduled_end_at > scheduled_start_at
  ),
  check (
    (
      run_mode = 'preview'
      and lifecycle_status in ('preview','cancelled','archived')
    )
    or
    (run_mode = 'production' and lifecycle_status <> 'preview')
  )
);

create table app_private.event_run_phases (
  run_id uuid not null references app_private.event_runs(id) on delete cascade,
  phase_id text not null check (char_length(phase_id) between 2 and 160),
  ordinal integer not null check (ordinal >= 0),
  phase_status text not null check (phase_status in ('pending','live','completed','skipped')),
  started_at timestamptz,
  completed_at timestamptz,
  state_version bigint not null default 1 check (state_version > 0),
  primary key (run_id, phase_id),
  unique (run_id, ordinal)
);

create table app_private.event_run_objectives (
  run_id uuid not null,
  phase_id text not null,
  objective_id text not null check (char_length(objective_id) between 2 and 160),
  objective_status text not null check (
    objective_status in ('inactive','active','completed','failed')
  ),
  progress bigint not null default 0 check (progress >= 0),
  target bigint not null check (target > 0),
  state_version bigint not null default 1 check (state_version > 0),
  updated_at timestamptz not null default clock_timestamp(),
  primary key (run_id, phase_id, objective_id),
  foreign key (run_id, phase_id)
    references app_private.event_run_phases(run_id, phase_id)
    on delete cascade
);

create table app_private.event_run_transitions (
  id bigint generated always as identity primary key,
  run_id uuid not null references app_private.event_runs(id) on delete cascade,
  idempotency_key uuid not null,
  from_status text not null,
  to_status text not null,
  resulting_state_version bigint not null check (resulting_state_version > 0),
  reason text not null check (char_length(reason) between 3 and 240 and btrim(reason) = reason),
  occurred_at timestamptz not null default clock_timestamp(),
  unique (run_id, idempotency_key),
  unique (run_id, resulting_state_version)
);

create index event_runs_recovery_idx
  on app_private.event_runs(lifecycle_status, scheduled_start_at, scheduled_end_at)
  where lifecycle_status in ('scheduled','live','paused','resolving');

create or replace function app_private.prevent_event_definition_version_mutation_v1()
returns trigger
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
begin
  raise exception using errcode = '55000', message = 'EVENT_DEFINITION_VERSION_IMMUTABLE';
end;
$$;

create trigger prevent_event_definition_version_mutation_v1
before update or delete on app_private.event_definition_versions
for each row execute function app_private.prevent_event_definition_version_mutation_v1();

alter table app_private.event_templates enable row level security;
alter table app_private.event_definition_versions enable row level security;
alter table app_private.event_publications enable row level security;
alter table app_private.event_runs enable row level security;
alter table app_private.event_run_phases enable row level security;
alter table app_private.event_run_objectives enable row level security;
alter table app_private.event_run_transitions enable row level security;

revoke all on table app_private.event_templates from public, anon, authenticated, service_role;
revoke all on table app_private.event_definition_versions from public, anon, authenticated, service_role;
revoke all on table app_private.event_publications from public, anon, authenticated, service_role;
revoke all on table app_private.event_runs from public, anon, authenticated, service_role;
revoke all on table app_private.event_run_phases from public, anon, authenticated, service_role;
revoke all on table app_private.event_run_objectives from public, anon, authenticated, service_role;
revoke all on table app_private.event_run_transitions from public, anon, authenticated, service_role;

grant select, insert on table app_private.event_templates to service_role;
grant select, insert on table app_private.event_definition_versions to service_role;
grant select, insert, update on table app_private.event_publications to service_role;
grant select, insert, update on table app_private.event_runs to service_role;
grant select, insert, update on table app_private.event_run_phases to service_role;
grant select, insert, update on table app_private.event_run_objectives to service_role;
grant select, insert on table app_private.event_run_transitions to service_role;

create or replace function public.read_current_event_definition_v1(
  p_event_key text
)
returns table (
  id uuid,
  event_key text,
  definition_version integer,
  definition jsonb,
  published_by uuid,
  published_at timestamptz
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    version.id,
    version.event_key,
    version.definition_version,
    version.definition,
    version.published_by,
    version.published_at
  from app_private.event_publications as publication
  join app_private.event_definition_versions as version
    on publication.version_id = version.id
  where publication.event_key = p_event_key
    and version.event_key = p_event_key
  limit 1;
$$;

create or replace function public.list_recoverable_event_runs_v1()
returns table (
  run_id uuid,
  event_key text,
  lifecycle_status text,
  state_version bigint,
  scheduled_start_at timestamptz,
  scheduled_end_at timestamptz,
  current_phase_id text
)
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select
    run.id,
    run.event_key,
    run.lifecycle_status,
    run.state_version,
    run.scheduled_start_at,
    run.scheduled_end_at,
    run.current_phase_id
  from app_private.event_runs as run
  where run.lifecycle_status in ('scheduled','live','paused','resolving')
    and (
      run.lifecycle_status <> 'scheduled'
      or run.scheduled_start_at is null
      or run.scheduled_start_at <= statement_timestamp()
    )
  order by coalesce(run.scheduled_start_at, run.created_at), run.id;
$$;

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
begin
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

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_RUN_NOT_FOUND';
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

revoke all on function public.read_current_event_definition_v1(text)
  from public, anon, authenticated;
revoke all on function public.list_recoverable_event_runs_v1()
  from public, anon, authenticated;
revoke all on function public.transition_event_run_v1(uuid,bigint,uuid,text,text)
  from public, anon, authenticated;

grant execute on function public.read_current_event_definition_v1(text) to service_role;
grant execute on function public.list_recoverable_event_runs_v1() to service_role;
grant execute on function public.transition_event_run_v1(uuid,bigint,uuid,text,text) to service_role;

comment on table app_private.event_definition_versions is
  'Immutable published persistent-event definitions. Event runs pin one exact version.';
comment on table app_private.event_runs is
  'Persistent authoritative event occurrences with optimistic lifecycle state versioning.';
comment on function public.list_recoverable_event_runs_v1() is
  'Service-only restart recovery projection for scheduled/durable event runs.';
comment on function public.transition_event_run_v1(uuid,bigint,uuid,text,text) is
  'Service-only idempotent persistent-event lifecycle transition with server-owned clock.';

commit;
