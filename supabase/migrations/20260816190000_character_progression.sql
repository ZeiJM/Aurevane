begin;

create or replace function app_private.is_valid_level_progression_curve(
  p_thresholds bigint[],
  p_max_level integer
)
returns boolean
language plpgsql
immutable
strict
set search_path = pg_catalog, app_private
as $$
declare
  v_index integer;
begin
  if p_max_level < 1 or p_max_level > 100 then
    return false;
  end if;

  if array_length(p_thresholds, 1) is distinct from p_max_level then
    return false;
  end if;

  if p_thresholds[1] is null or p_thresholds[1] <> 0 then
    return false;
  end if;

  for v_index in 1..p_max_level loop
    if p_thresholds[v_index] is null or p_thresholds[v_index] < 0 then
      return false;
    end if;

    if v_index > 1 and p_thresholds[v_index] <= p_thresholds[v_index - 1] then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

create or replace function app_private.resolve_level_from_curve(
  p_xp bigint,
  p_thresholds bigint[],
  p_max_level integer
)
returns smallint
language plpgsql
immutable
strict
set search_path = pg_catalog, app_private
as $$
declare
  v_level integer;
begin
  if p_xp < 0 or not app_private.is_valid_level_progression_curve(p_thresholds, p_max_level) then
    raise exception using
      errcode = '22023',
      message = 'invalid progression resolver input';
  end if;

  for v_level in reverse p_max_level..1 loop
    if p_thresholds[v_level] <= p_xp then
      return v_level::smallint;
    end if;
  end loop;

  return 1::smallint;
end;
$$;

revoke all on function app_private.is_valid_level_progression_curve(bigint[], integer) from public;
revoke all on function app_private.is_valid_level_progression_curve(bigint[], integer) from anon;
revoke all on function app_private.is_valid_level_progression_curve(bigint[], integer) from authenticated;
revoke all on function app_private.resolve_level_from_curve(bigint, bigint[], integer) from public;
revoke all on function app_private.resolve_level_from_curve(bigint, bigint[], integer) from anon;
revoke all on function app_private.resolve_level_from_curve(bigint, bigint[], integer) from authenticated;

create table app_private.level_progression_curves (
  version integer primary key,
  label text not null,
  max_level smallint not null,
  cumulative_xp_by_level bigint[] not null,
  created_at timestamptz not null default clock_timestamp(),
  constraint level_progression_curves_version_positive check (version > 0),
  constraint level_progression_curves_label_length check (char_length(label) between 1 and 120),
  constraint level_progression_curves_valid_curve check (
    app_private.is_valid_level_progression_curve(cumulative_xp_by_level, max_level)
  )
);

comment on table app_private.level_progression_curves is
  'Versioned server-only cumulative XP threshold curves. Time gates are intentionally not part of the curve model.';

create table app_private.progression_cycle_level_curves (
  progression_cycle integer primary key,
  curve_version integer not null references app_private.level_progression_curves(version),
  constraint progression_cycle_level_curves_cycle_positive check (progression_cycle > 0)
);

comment on table app_private.progression_cycle_level_curves is
  'Maps each progression cycle to the authoritative Level threshold curve used for XP grants and profile reads.';

revoke all on table app_private.level_progression_curves from public;
revoke all on table app_private.level_progression_curves from anon;
revoke all on table app_private.level_progression_curves from authenticated;
revoke all on table app_private.progression_cycle_level_curves from public;
revoke all on table app_private.progression_cycle_level_curves from anon;
revoke all on table app_private.progression_cycle_level_curves from authenticated;
grant select on table app_private.level_progression_curves to service_role;
grant select on table app_private.progression_cycle_level_curves to service_role;

do $$
declare
  v_level integer;
  v_total bigint := 0;
  v_thresholds bigint[] := array[0::bigint];
  v_step bigint;
begin
  for v_level in 1..99 loop
    v_step := 100::bigint
      + 25::bigint * (v_level - 1)
      + 5::bigint * (v_level - 1) * (v_level - 1);
    v_total := v_total + v_step;
    v_thresholds := array_append(v_thresholds, v_total);
  end loop;

  insert into app_private.level_progression_curves (
    version,
    label,
    max_level,
    cumulative_xp_by_level
  )
  values (
    1,
    'Phase 1 development curve',
    100,
    v_thresholds
  );
end;
$$;

insert into app_private.progression_cycle_level_curves (progression_cycle, curve_version)
values (1, 1);

create table app_private.character_xp_grants (
  id uuid primary key,
  character_id uuid not null references public.characters(id) on delete cascade,
  progression_cycle integer not null,
  curve_version integer not null references app_private.level_progression_curves(version),
  authority_key text not null,
  source_kind text not null,
  source_id text not null,
  reason_tag text not null,
  requested_amount bigint not null,
  applied_amount bigint not null,
  xp_before bigint not null,
  xp_after bigint not null,
  level_before smallint not null,
  level_after smallint not null,
  reached_level smallint,
  seconds_since_cycle_start bigint not null,
  created_at timestamptz not null,
  constraint character_xp_grants_cycle_positive check (progression_cycle > 0),
  constraint character_xp_grants_source_kind check (
    source_kind in ('system', 'gameplay', 'support', 'owner')
  ),
  constraint character_xp_grants_authority_length check (char_length(authority_key) between 1 and 160),
  constraint character_xp_grants_source_id_length check (char_length(source_id) between 1 and 160),
  constraint character_xp_grants_reason_tag_length check (char_length(reason_tag) between 1 and 120),
  constraint character_xp_grants_requested_positive check (requested_amount > 0),
  constraint character_xp_grants_applied_range check (
    applied_amount >= 0 and applied_amount <= requested_amount
  ),
  constraint character_xp_grants_xp_monotonic check (
    xp_before >= 0 and xp_after >= xp_before
  ),
  constraint character_xp_grants_level_range check (
    level_before between 1 and 100 and level_after between level_before and 100
  ),
  constraint character_xp_grants_reached_level_consistent check (
    (reached_level is null and level_after = level_before)
    or (reached_level = level_after and level_after > level_before)
  ),
  constraint character_xp_grants_elapsed_nonnegative check (seconds_since_cycle_start >= 0)
);

comment on table app_private.character_xp_grants is
  'Append-only authoritative XP grant ledger and progression telemetry. Replays reuse the original row instead of duplicating rewards.';

create index character_xp_grants_character_created_idx
  on app_private.character_xp_grants (character_id, created_at desc);
create index character_xp_grants_source_created_idx
  on app_private.character_xp_grants (source_kind, reason_tag, created_at desc);
create index character_xp_grants_milestone_idx
  on app_private.character_xp_grants (reached_level, seconds_since_cycle_start)
  where reached_level is not null;

revoke all on table app_private.character_xp_grants from public;
revoke all on table app_private.character_xp_grants from anon;
revoke all on table app_private.character_xp_grants from authenticated;
grant select on table app_private.character_xp_grants to service_role;

create or replace function public.get_level_progression_curve_v1(p_progression_cycle integer)
returns table (
  curve_version integer,
  max_level integer,
  cumulative_xp_by_level bigint[]
)
language sql
security definer
stable
set search_path = pg_catalog, public, app_private
as $$
  select
    curve.version,
    curve.max_level::integer,
    curve.cumulative_xp_by_level
  from app_private.progression_cycle_level_curves mapping
  join app_private.level_progression_curves curve
    on curve.version = mapping.curve_version
  where mapping.progression_cycle = p_progression_cycle;
$$;

comment on function public.get_level_progression_curve_v1(integer) is
  'Returns the server-configured cumulative Level threshold curve for one progression cycle.';

revoke all on function public.get_level_progression_curve_v1(integer) from public;
revoke all on function public.get_level_progression_curve_v1(integer) from anon;
revoke all on function public.get_level_progression_curve_v1(integer) from authenticated;
grant execute on function public.get_level_progression_curve_v1(integer) to service_role;

create or replace function public.grant_character_xp_v1(
  p_character_id uuid,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_authority_key text,
  p_source_kind text,
  p_source_id text,
  p_reason_tag text,
  p_amount bigint
)
returns table (
  grant_id uuid,
  character_id uuid,
  progression_cycle integer,
  curve_version integer,
  authority_key text,
  source_kind text,
  source_id text,
  reason_tag text,
  requested_amount bigint,
  applied_amount bigint,
  xp_before bigint,
  xp_after bigint,
  level_before smallint,
  level_after smallint,
  reached_level smallint,
  seconds_since_cycle_start bigint,
  created_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_command_name constant text := 'character.grant_xp.v1';
  v_grant_id uuid := gen_random_uuid();
  v_now timestamptz := clock_timestamp();
  v_existing app_private.idempotency_records%rowtype;
  v_rows_inserted integer;
  v_character public.characters%rowtype;
  v_curve app_private.level_progression_curves%rowtype;
  v_resolved_before smallint;
  v_level_after smallint;
  v_max_xp bigint;
  v_applied_amount bigint;
  v_xp_after bigint;
  v_reached_level smallint;
  v_elapsed_seconds bigint;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception using
      errcode = '22023',
      message = 'XP grant amount must be positive';
  end if;

  if p_authority_key is null
    or char_length(p_authority_key) not between 1 and 160
    or p_source_id is null
    or char_length(p_source_id) not between 1 and 160
    or p_reason_tag is null
    or char_length(p_reason_tag) not between 1 and 120
    or p_source_kind is null
    or p_source_kind not in ('system', 'gameplay', 'support', 'owner') then
    raise exception using
      errcode = '22023',
      message = 'XP grant provenance is invalid';
  end if;

  insert into app_private.idempotency_records (
    actor_key,
    command_name,
    idempotency_key,
    request_fingerprint,
    result
  )
  values (
    p_authority_key,
    v_command_name,
    p_idempotency_key,
    p_request_fingerprint,
    jsonb_build_object('grant_id', v_grant_id)
  )
  on conflict (actor_key, command_name, idempotency_key) do nothing;

  get diagnostics v_rows_inserted = row_count;

  if v_rows_inserted = 0 then
    select *
    into v_existing
    from app_private.idempotency_records
    where actor_key = p_authority_key
      and command_name = v_command_name
      and idempotency_key = p_idempotency_key;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'idempotency record unavailable after conflict';
    end if;

    if v_existing.request_fingerprint <> p_request_fingerprint then
      raise exception using
        errcode = '22023',
        message = 'idempotency key reused with a different request fingerprint';
    end if;

    return query
    select
      grant.id,
      grant.character_id,
      grant.progression_cycle,
      grant.curve_version,
      grant.authority_key,
      grant.source_kind,
      grant.source_id,
      grant.reason_tag,
      grant.requested_amount,
      grant.applied_amount,
      grant.xp_before,
      grant.xp_after,
      grant.level_before,
      grant.level_after,
      grant.reached_level,
      grant.seconds_since_cycle_start,
      grant.created_at,
      true
    from app_private.character_xp_grants grant
    where grant.id = (v_existing.result ->> 'grant_id')::uuid;

    if not found then
      raise exception using
        errcode = '40001',
        message = 'idempotent XP grant result unavailable';
    end if;

    return;
  end if;

  select *
  into v_character
  from public.characters
  where id = p_character_id
  for update;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'CHARACTER_NOT_FOUND';
  end if;

  select curve.*
  into v_curve
  from app_private.progression_cycle_level_curves mapping
  join app_private.level_progression_curves curve
    on curve.version = mapping.curve_version
  where mapping.progression_cycle = v_character.progression_cycle;

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'PROGRESSION_CURVE_UNAVAILABLE';
  end if;

  v_resolved_before := app_private.resolve_level_from_curve(
    v_character.xp,
    v_curve.cumulative_xp_by_level,
    v_curve.max_level
  );

  if v_resolved_before <> v_character.level then
    raise exception using
      errcode = 'P0001',
      message = 'CHARACTER_PROGRESSION_INCONSISTENT';
  end if;

  v_max_xp := v_curve.cumulative_xp_by_level[v_curve.max_level];
  if v_character.xp >= v_max_xp then
    v_applied_amount := 0;
    v_xp_after := v_character.xp;
  else
    v_applied_amount := least(p_amount, v_max_xp - v_character.xp);
    v_xp_after := v_character.xp + v_applied_amount;
  end if;

  v_level_after := app_private.resolve_level_from_curve(
    v_xp_after,
    v_curve.cumulative_xp_by_level,
    v_curve.max_level
  );
  v_reached_level := case
    when v_level_after > v_character.level then v_level_after
    else null
  end;
  v_elapsed_seconds := greatest(
    0::bigint,
    floor(extract(epoch from (v_now - v_character.cycle_started_at)))::bigint
  );

  update public.characters
  set
    xp = v_xp_after,
    level = v_level_after
  where id = v_character.id;

  insert into app_private.character_xp_grants (
    id,
    character_id,
    progression_cycle,
    curve_version,
    authority_key,
    source_kind,
    source_id,
    reason_tag,
    requested_amount,
    applied_amount,
    xp_before,
    xp_after,
    level_before,
    level_after,
    reached_level,
    seconds_since_cycle_start,
    created_at
  )
  values (
    v_grant_id,
    v_character.id,
    v_character.progression_cycle,
    v_curve.version,
    p_authority_key,
    p_source_kind,
    p_source_id,
    p_reason_tag,
    p_amount,
    v_applied_amount,
    v_character.xp,
    v_xp_after,
    v_character.level,
    v_level_after,
    v_reached_level,
    v_elapsed_seconds,
    v_now
  );

  return query
  select
    grant.id,
    grant.character_id,
    grant.progression_cycle,
    grant.curve_version,
    grant.authority_key,
    grant.source_kind,
    grant.source_id,
    grant.reason_tag,
    grant.requested_amount,
    grant.applied_amount,
    grant.xp_before,
    grant.xp_after,
    grant.level_before,
    grant.level_after,
    grant.reached_level,
    grant.seconds_since_cycle_start,
    grant.created_at,
    false
  from app_private.character_xp_grants grant
  where grant.id = v_grant_id;
end;
$$;

comment on function public.grant_character_xp_v1(uuid, uuid, text, text, text, text, text, bigint) is
  'Atomically grants bounded XP, resolves Level from the server-configured curve, records provenance/milestone telemetry, and replays duplicate requests safely.';

revoke all on function public.grant_character_xp_v1(uuid, uuid, text, text, text, text, text, bigint) from public;
revoke all on function public.grant_character_xp_v1(uuid, uuid, text, text, text, text, text, bigint) from anon;
revoke all on function public.grant_character_xp_v1(uuid, uuid, text, text, text, text, text, bigint) from authenticated;
grant execute on function public.grant_character_xp_v1(uuid, uuid, text, text, text, text, text, bigint) to service_role;

commit;
