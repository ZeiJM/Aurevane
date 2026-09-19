begin;

create table app_private.event_definition_drafts (
  event_key text primary key check (
    event_key ~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
  ),
  definition jsonb not null check (jsonb_typeof(definition) = 'object'),
  base_version integer check (base_version is null or base_version > 0),
  draft_version bigint not null default 1 check (draft_version > 0),
  updated_by uuid not null references auth.users(id),
  updated_at timestamptz not null default clock_timestamp()
);

alter table app_private.event_definition_drafts enable row level security;
revoke all on table app_private.event_definition_drafts
  from public, anon, authenticated, service_role;

comment on table app_private.event_definition_drafts is
  'Private optimistic Event Builder drafts. Published Event Definition versions remain immutable and separate.';

create or replace function app_private.assert_event_staff_author_v1(
  p_actor_user_id uuid
)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_actor_user_id
      and assignment.role = 'game-owner'
      and assignment.enabled = true
  ) then
    return 'game-owner';
  end if;

  if exists (
    select 1
    from app_private.master_panel_role_assignments as assignment
    where assignment.user_id = p_actor_user_id
      and assignment.role = 'event-staff'
      and assignment.enabled = true
  ) then
    return 'event-staff';
  end if;

  raise exception using errcode = '42501', message = 'EVENT_STAFF_REQUIRED';
end;
$$;

create or replace function app_private.assert_event_production_publish_v1(
  p_actor_user_id uuid,
  p_scope_type text
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
      and grant_row.capability = 'events.production_publish'
      and grant_row.enabled = true
  ) then
    raise exception using errcode = '42501', message = 'EVENT_PRODUCTION_PUBLISH_CAPABILITY_REQUIRED';
  end if;

  if p_scope_type = 'global'
    and not exists (
      select 1
      from app_private.master_panel_capability_grants as grant_row
      where grant_row.user_id = p_actor_user_id
        and grant_row.capability = 'events.global_scope'
        and grant_row.enabled = true
    ) then
    raise exception using errcode = '42501', message = 'EVENT_GLOBAL_SCOPE_CAPABILITY_REQUIRED';
  end if;
end;
$$;

create or replace function app_private.assert_event_operational_scope_v1(
  p_actor_user_id uuid,
  p_scope_type text
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

  if p_scope_type = 'global'
    and not exists (
      select 1
      from app_private.master_panel_capability_grants as grant_row
      where grant_row.user_id = p_actor_user_id
        and grant_row.capability = 'events.global_scope'
        and grant_row.enabled = true
    ) then
    raise exception using errcode = '42501', message = 'EVENT_GLOBAL_SCOPE_CAPABILITY_REQUIRED';
  end if;
end;
$$;

create or replace function app_private.event_definition_contains_forbidden_key_v1(
  p_definition jsonb
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  with recursive walk(value) as (
    select p_definition
    union all
    select child.value
    from walk
    cross join lateral (
      select object_value as value
      from jsonb_each(
        case when jsonb_typeof(walk.value) = 'object' then walk.value else '{}'::jsonb end
      ) as object_entry(object_key, object_value)
      union all
      select array_value
      from jsonb_array_elements(
        case when jsonb_typeof(walk.value) = 'array' then walk.value else '[]'::jsonb end
      ) as array_entry(array_value)
    ) as child
  )
  select exists (
    select 1
    from walk
    cross join lateral jsonb_object_keys(
      case when jsonb_typeof(walk.value) = 'object' then walk.value else '{}'::jsonb end
    ) as object_key(key)
    where object_key.key in ('script','sql','sourceCode','handler','rawSql')
  );
$$;

create or replace function app_private.assert_event_definition_shape_v1(
  p_event_key text,
  p_definition jsonb
)
returns void
language plpgsql
immutable
set search_path = pg_catalog, app_private
as $$
declare
  v_scope_type text;
  v_scope_key text;
begin
  if p_event_key is null
    or p_event_key !~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
    or p_definition is null
    or jsonb_typeof(p_definition) <> 'object'
    or p_definition ->> 'eventKey' <> p_event_key
    or p_definition ->> 'schemaVersion' <> '1'
    or p_definition ->> 'family' not in (
      'world-crisis',
      'regional-event',
      'narrative-event',
      'community-objective',
      'legendary-hunt',
      'expedition-event',
      'pvp-event',
      'seasonal-event',
      'nation-event',
      'profession-event',
      'micro-event',
      'lore-revelation'
    )
    or jsonb_typeof(p_definition -> 'phases') <> 'array'
    or jsonb_array_length(p_definition -> 'phases') < 1
    or app_private.event_definition_contains_forbidden_key_v1(p_definition)
  then
    raise exception using errcode = '22023', message = 'EVENT_DEFINITION_INVALID';
  end if;

  v_scope_type := p_definition #>> '{scope,type}';
  v_scope_key := p_definition #>> '{scope,key}';

  if v_scope_type not in ('global','region','node','cohort') then
    raise exception using errcode = '22023', message = 'EVENT_DEFINITION_SCOPE_INVALID';
  end if;

  if v_scope_type = 'global' and v_scope_key is not null then
    raise exception using errcode = '22023', message = 'EVENT_DEFINITION_SCOPE_INVALID';
  end if;

  if v_scope_type <> 'global'
    and (
      v_scope_key is null
      or v_scope_key !~ '^[a-z0-9][a-z0-9._:-]{1,159}$'
    ) then
    raise exception using errcode = '22023', message = 'EVENT_DEFINITION_SCOPE_INVALID';
  end if;
end;
$$;

revoke all on function app_private.assert_event_staff_author_v1(uuid)
  from public, anon, authenticated, service_role;
revoke all on function app_private.assert_event_production_publish_v1(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.assert_event_operational_scope_v1(uuid,text)
  from public, anon, authenticated, service_role;
revoke all on function app_private.event_definition_contains_forbidden_key_v1(jsonb)
  from public, anon, authenticated, service_role;
revoke all on function app_private.assert_event_definition_shape_v1(text,jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.read_event_definition_draft_v1(
  p_actor_user_id uuid,
  p_event_key text
)
returns table (
  event_key text,
  definition jsonb,
  base_version integer,
  draft_version bigint,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  return query
  select
    draft.event_key,
    draft.definition,
    draft.base_version,
    draft.draft_version,
    draft.updated_by,
    draft.updated_at
  from app_private.event_definition_drafts as draft
  where draft.event_key = p_event_key;
end;
$$;

create or replace function public.save_event_definition_draft_v1(
  p_actor_user_id uuid,
  p_event_key text,
  p_definition jsonb,
  p_base_version integer,
  p_expected_draft_version bigint
)
returns table (
  event_key text,
  definition jsonb,
  base_version integer,
  draft_version bigint,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_existing app_private.event_definition_drafts%rowtype;
  v_current_version integer;
  v_next_draft_version bigint;
  v_now timestamptz := clock_timestamp();
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);
  perform app_private.assert_event_definition_shape_v1(p_event_key, p_definition);

  select version.definition_version
  into v_current_version
  from app_private.event_publications as publication
  join app_private.event_definition_versions as version
    on version.id = publication.version_id
   and version.event_key = publication.event_key
  where publication.event_key = p_event_key;

  if coalesce(v_current_version, 0) <> coalesce(p_base_version, 0) then
    raise exception using errcode = '40001', message = 'EVENT_DRAFT_BASE_VERSION_CONFLICT';
  end if;

  select *
  into v_existing
  from app_private.event_definition_drafts as draft
  where draft.event_key = p_event_key
  for update;

  if found then
    if p_expected_draft_version is null
      or v_existing.draft_version <> p_expected_draft_version then
      raise exception using errcode = '40001', message = 'EVENT_DRAFT_VERSION_CONFLICT';
    end if;
    v_next_draft_version := v_existing.draft_version + 1;
  else
    if p_expected_draft_version is not null then
      raise exception using errcode = '40001', message = 'EVENT_DRAFT_VERSION_CONFLICT';
    end if;
    v_next_draft_version := 1;
  end if;

  insert into app_private.event_definition_drafts (
    event_key,
    definition,
    base_version,
    draft_version,
    updated_by,
    updated_at
  ) values (
    p_event_key,
    p_definition,
    p_base_version,
    v_next_draft_version,
    p_actor_user_id,
    v_now
  )
  on conflict on constraint event_definition_drafts_pkey do update
  set
    definition = excluded.definition,
    base_version = excluded.base_version,
    draft_version = excluded.draft_version,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  return query
  select
    p_event_key,
    p_definition,
    p_base_version,
    v_next_draft_version,
    p_actor_user_id,
    v_now;
end;
$$;

create or replace function public.list_event_definition_versions_v1(
  p_actor_user_id uuid,
  p_event_key text
)
returns table (
  id uuid,
  event_key text,
  definition_version integer,
  definition jsonb,
  published_by uuid,
  published_at timestamptz,
  current boolean
)
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  return query
  select
    version.id,
    version.event_key,
    version.definition_version,
    version.definition,
    version.published_by,
    version.published_at,
    publication.version_id = version.id
  from app_private.event_definition_versions as version
  left join app_private.event_publications as publication
    on publication.event_key = version.event_key
  where version.event_key = p_event_key
  order by version.definition_version desc;
end;
$$;

create or replace function public.publish_event_definition_v1(
  p_actor_user_id uuid,
  p_event_key text,
  p_definition jsonb,
  p_expected_base_version integer
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
  v_current_version integer;
  v_next_version integer;
  v_scope_type text;
  v_family text;
  v_definition jsonb;
  v_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_template_family text;
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);
  perform app_private.assert_event_definition_shape_v1(p_event_key, p_definition);

  v_scope_type := p_definition #>> '{scope,type}';
  v_family := p_definition ->> 'family';
  perform app_private.assert_event_production_publish_v1(p_actor_user_id, v_scope_type);

  if exists (
    select 1
    from jsonb_array_elements_text(
      coalesce(p_definition -> 'rewardPackageRefs', '[]'::jsonb)
    ) as reward(ref)
    left join app_private.event_reward_packages as package
      on package.reward_package_ref = reward.ref
    where package.reward_package_ref is null
  ) then
    raise exception using errcode = '22023', message = 'EVENT_REWARD_PACKAGE_DEPENDENCY_MISSING';
  end if;

  select version.definition_version
  into v_current_version
  from app_private.event_publications as publication
  join app_private.event_definition_versions as version
    on version.id = publication.version_id
   and version.event_key = publication.event_key
  where publication.event_key = p_event_key
  for update of publication;

  if coalesce(v_current_version, 0) <> coalesce(p_expected_base_version, 0) then
    raise exception using errcode = '40001', message = 'EVENT_PUBLISH_BASE_VERSION_CONFLICT';
  end if;

  select template.event_family
  into v_template_family
  from app_private.event_templates as template
  where template.event_key = p_event_key
  for update;

  if found and v_template_family <> v_family then
    raise exception using errcode = '22023', message = 'EVENT_TEMPLATE_FAMILY_CONFLICT';
  end if;

  insert into app_private.event_templates (
    event_key,
    event_family,
    created_by
  ) values (
    p_event_key,
    v_family,
    p_actor_user_id
  )
  on conflict on constraint event_templates_pkey do nothing;

  select coalesce(max(version.definition_version), 0) + 1
  into v_next_version
  from app_private.event_definition_versions as version
  where version.event_key = p_event_key;

  v_definition := jsonb_set(
    p_definition,
    '{contentVersion}',
    to_jsonb(v_next_version),
    true
  );

  insert into app_private.event_definition_versions (
    id,
    event_key,
    definition_version,
    definition,
    published_by,
    published_at
  ) values (
    v_id,
    p_event_key,
    v_next_version,
    v_definition,
    p_actor_user_id,
    v_now
  );

  insert into app_private.event_publications (
    event_key,
    version_id,
    updated_by,
    updated_at
  ) values (
    p_event_key,
    v_id,
    p_actor_user_id,
    v_now
  )
  on conflict on constraint event_publications_pkey do update
  set
    version_id = excluded.version_id,
    updated_by = excluded.updated_by,
    updated_at = excluded.updated_at;

  update app_private.event_definition_drafts as draft
  set
    definition = v_definition,
    base_version = v_next_version,
    draft_version = draft.draft_version + 1,
    updated_by = p_actor_user_id,
    updated_at = v_now
  where draft.event_key = p_event_key;

  return query
  select
    v_id,
    p_event_key,
    v_next_version,
    v_definition,
    p_actor_user_id,
    v_now;
end;
$$;

create or replace function public.schedule_event_run_v1(
  p_actor_user_id uuid,
  p_event_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_scheduled_start_at timestamptz,
  p_scheduled_end_at timestamptz
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
  v_command_name constant text := 'event.schedule.v1';
  v_actor_key text := 'staff:' || p_actor_user_id::text;
  v_existing app_private.idempotency_records%rowtype;
  v_version app_private.event_definition_versions%rowtype;
  v_definition jsonb;
  v_scope_type text;
  v_scope_key text;
  v_first_phase_id text;
  v_run_id uuid := gen_random_uuid();
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  if p_idempotency_key is null
    or p_request_fingerprint is null
    or char_length(p_request_fingerprint) not between 1 and 160
    or p_scheduled_start_at is null
    or p_scheduled_start_at <= statement_timestamp()
    or (
      p_scheduled_end_at is not null
      and p_scheduled_end_at <= p_scheduled_start_at
    ) then
    raise exception using errcode = '22023', message = 'EVENT_SCHEDULE_INVALID';
  end if;

  select * into v_existing
  from app_private.idempotency_records as receipt
  where receipt.actor_key = v_actor_key
    and receipt.command_name = v_command_name
    and receipt.idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_fingerprint <> p_request_fingerprint
      or v_existing.result ->> 'event_key' <> p_event_key then
      raise exception using errcode = '22023', message = 'EVENT_SCHEDULE_IDEMPOTENCY_CONFLICT';
    end if;

    return query
    select
      (v_existing.result ->> 'run_id')::uuid,
      (v_existing.result ->> 'state_version')::bigint,
      true;
    return;
  end if;

  select version.*
  into v_version
  from app_private.event_publications as publication
  join app_private.event_definition_versions as version
    on version.id = publication.version_id
   and version.event_key = publication.event_key
  where publication.event_key = p_event_key
  for update of publication;

  if not found then
    raise exception using errcode = '22023', message = 'EVENT_PUBLICATION_REQUIRED';
  end if;

  v_definition := v_version.definition;
  v_scope_type := v_definition #>> '{scope,type}';
  v_scope_key := v_definition #>> '{scope,key}';
  v_first_phase_id := v_definition #>> '{phases,0,id}';

  perform app_private.assert_event_operational_scope_v1(p_actor_user_id, v_scope_type);

  if v_first_phase_id is null then
    raise exception using errcode = '22023', message = 'EVENT_FIRST_PHASE_REQUIRED';
  end if;

  if exists (
    select 1
    from app_private.event_runs as run
    where run.run_mode = 'production'
      and run.lifecycle_status in ('scheduled','live','paused','resolving')
      and run.scope_type = v_scope_type
      and run.scope_key is not distinct from v_scope_key
      and coalesce(run.scheduled_end_at, 'infinity'::timestamptz) > p_scheduled_start_at
      and coalesce(p_scheduled_end_at, 'infinity'::timestamptz) >
        coalesce(run.scheduled_start_at, run.started_at, run.created_at)
  ) then
    raise exception using errcode = '22023', message = 'EVENT_SCHEDULE_SCOPE_CONFLICT';
  end if;

  insert into app_private.event_runs (
    id,
    event_key,
    definition_version_id,
    run_mode,
    lifecycle_status,
    scope_type,
    scope_key,
    scheduled_start_at,
    scheduled_end_at,
    current_phase_id,
    created_by
  ) values (
    v_run_id,
    p_event_key,
    v_version.id,
    'production',
    'scheduled',
    v_scope_type,
    v_scope_key,
    p_scheduled_start_at,
    p_scheduled_end_at,
    v_first_phase_id,
    p_actor_user_id
  );

  insert into app_private.event_run_phases (
    run_id,
    phase_id,
    ordinal,
    phase_status
  )
  select
    v_run_id,
    phase.value ->> 'id',
    (phase.ordinality - 1)::integer,
    'pending'
  from jsonb_array_elements(v_definition -> 'phases')
    with ordinality as phase(value, ordinality);

  insert into app_private.event_run_objectives (
    run_id,
    phase_id,
    objective_id,
    objective_status,
    progress,
    target
  )
  select
    v_run_id,
    phase.value ->> 'id',
    objective.value ->> 'id',
    'inactive',
    0,
    (objective.value ->> 'target')::bigint
  from jsonb_array_elements(v_definition -> 'phases') as phase(value)
  cross join lateral jsonb_array_elements(
    coalesce(phase.value -> 'objectives', '[]'::jsonb)
  ) as objective(value);

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  ) values (
    v_actor_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object(
      'run_id', v_run_id,
      'event_key', p_event_key,
      'state_version', 1
    )
  );

  return query select v_run_id, 1::bigint, false;
end;
$$;

create or replace function public.cancel_scheduled_event_run_v1(
  p_actor_user_id uuid,
  p_run_id uuid,
  p_expected_state_version bigint,
  p_idempotency_key uuid,
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
begin
  perform app_private.assert_event_staff_author_v1(p_actor_user_id);

  select *
  into v_run
  from app_private.event_runs as run
  where run.id = p_run_id;

  if not found or v_run.lifecycle_status <> 'scheduled' then
    raise exception using errcode = '22023', message = 'EVENT_SCHEDULED_RUN_REQUIRED';
  end if;

  perform app_private.assert_event_operational_scope_v1(p_actor_user_id, v_run.scope_type);

  return query
  select *
  from public.transition_event_run_v1(
    p_run_id,
    p_expected_state_version,
    p_idempotency_key,
    'cancelled',
    p_reason
  );
end;
$$;

revoke all on function public.read_event_definition_draft_v1(uuid,text)
  from public, anon, authenticated;
revoke all on function public.save_event_definition_draft_v1(uuid,text,jsonb,integer,bigint)
  from public, anon, authenticated;
revoke all on function public.list_event_definition_versions_v1(uuid,text)
  from public, anon, authenticated;
revoke all on function public.publish_event_definition_v1(uuid,text,jsonb,integer)
  from public, anon, authenticated;
revoke all on function public.schedule_event_run_v1(uuid,text,uuid,text,timestamptz,timestamptz)
  from public, anon, authenticated;
revoke all on function public.cancel_scheduled_event_run_v1(uuid,uuid,bigint,uuid,text)
  from public, anon, authenticated;

grant execute on function public.read_event_definition_draft_v1(uuid,text)
  to service_role;
grant execute on function public.save_event_definition_draft_v1(uuid,text,jsonb,integer,bigint)
  to service_role;
grant execute on function public.list_event_definition_versions_v1(uuid,text)
  to service_role;
grant execute on function public.publish_event_definition_v1(uuid,text,jsonb,integer)
  to service_role;
grant execute on function public.schedule_event_run_v1(uuid,text,uuid,text,timestamptz,timestamptz)
  to service_role;
grant execute on function public.cancel_scheduled_event_run_v1(uuid,uuid,bigint,uuid,text)
  to service_role;

comment on function public.publish_event_definition_v1(uuid,text,jsonb,integer) is
  'P4.13 Event Builder immutable publication. Event Staff requires explicit Production publication capability; global scope additionally requires global scope capability.';
comment on function public.schedule_event_run_v1(uuid,text,uuid,text,timestamptz,timestamptz) is
  'P4.13 Event Builder idempotent scheduler. Pins current immutable definition, derives scope/phase/objective state and blocks overlapping active scope.';
comment on function public.cancel_scheduled_event_run_v1(uuid,uuid,bigint,uuid,text) is
  'P4.13 protected Event Staff unschedule wrapper around the authoritative lifecycle transition.';

commit;
