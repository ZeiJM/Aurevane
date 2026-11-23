begin;

create table app_private.cartographic_drift_cycle_ledger (
  definition_id text not null,
  definition_content_version integer not null,
  generation_version integer not null,
  cycle_key text not null,
  variant_id text not null,
  variant_content_version integer not null,
  resolution_id text not null,
  resolved_at timestamptz not null,
  primary key (definition_id, cycle_key),
  constraint cartographic_drift_definition_id_format check (
    definition_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint cartographic_drift_definition_version_positive check (
    definition_content_version > 0
  ),
  constraint cartographic_drift_generation_version_positive check (
    generation_version > 0
  ),
  constraint cartographic_drift_cycle_key_format check (
    cycle_key ~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$'
  ),
  constraint cartographic_drift_variant_id_format check (
    variant_id ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
  ),
  constraint cartographic_drift_variant_version_positive check (
    variant_content_version > 0
  ),
  constraint cartographic_drift_resolution_id_format check (
    resolution_id ~ '^sha256:[0-9a-f]{64}$'
  )
);

comment on table app_private.cartographic_drift_cycle_ledger is
  'Private immutable Phase-5 Cartographic Drift resolved-cycle ledger. Stores authored resolution identity only; never stores the private server seed.';

alter table app_private.cartographic_drift_cycle_ledger enable row level security;

revoke all on table app_private.cartographic_drift_cycle_ledger
  from public, anon, authenticated, service_role;
grant select on table app_private.cartographic_drift_cycle_ledger to service_role;

create or replace function app_private.prevent_cartographic_drift_cycle_ledger_mutation_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  raise exception using
    errcode = '55000',
    message = 'CARTOGRAPHIC_DRIFT_LEDGER_IMMUTABLE';
end;
$$;

revoke all on function app_private.prevent_cartographic_drift_cycle_ledger_mutation_v1()
  from public, anon, authenticated, service_role;

create trigger cartographic_drift_cycle_ledger_immutable
before update or delete on app_private.cartographic_drift_cycle_ledger
for each row
execute function app_private.prevent_cartographic_drift_cycle_ledger_mutation_v1();

create or replace function public.record_cartographic_drift_cycle_resolution_v1(
  p_definition_id text,
  p_definition_content_version integer,
  p_generation_version integer,
  p_cycle_key text,
  p_variant_id text,
  p_variant_content_version integer,
  p_resolution_id text,
  p_resolved_at timestamptz
)
returns table (
  definition_id text,
  definition_content_version integer,
  generation_version integer,
  cycle_key text,
  variant_id text,
  variant_content_version integer,
  resolution_id text,
  resolved_at timestamptz,
  inserted boolean
)
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_existing app_private.cartographic_drift_cycle_ledger%rowtype;
begin
  if p_definition_id is null
    or p_definition_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or p_definition_content_version is null
    or p_definition_content_version <= 0
    or p_generation_version is null
    or p_generation_version <= 0
    or p_cycle_key is null
    or p_cycle_key !~ '^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,159}$'
    or p_variant_id is null
    or p_variant_id !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
    or p_variant_content_version is null
    or p_variant_content_version <= 0
    or p_resolution_id is null
    or p_resolution_id !~ '^sha256:[0-9a-f]{64}$'
    or p_resolved_at is null
  then
    raise exception using
      errcode = '22023',
      message = 'CARTOGRAPHIC_DRIFT_RESOLUTION_INVALID';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('aurevane:cartographic-drift:' || p_definition_id || ':' || p_cycle_key, 0)
  );

  select *
  into v_existing
  from app_private.cartographic_drift_cycle_ledger as ledger
  where ledger.definition_id = p_definition_id
    and ledger.cycle_key = p_cycle_key;

  if found then
    return query
    select
      v_existing.definition_id,
      v_existing.definition_content_version,
      v_existing.generation_version,
      v_existing.cycle_key,
      v_existing.variant_id,
      v_existing.variant_content_version,
      v_existing.resolution_id,
      v_existing.resolved_at,
      false;
    return;
  end if;

  insert into app_private.cartographic_drift_cycle_ledger (
    definition_id,
    definition_content_version,
    generation_version,
    cycle_key,
    variant_id,
    variant_content_version,
    resolution_id,
    resolved_at
  ) values (
    p_definition_id,
    p_definition_content_version,
    p_generation_version,
    p_cycle_key,
    p_variant_id,
    p_variant_content_version,
    p_resolution_id,
    p_resolved_at
  )
  returning * into v_existing;

  return query
  select
    v_existing.definition_id,
    v_existing.definition_content_version,
    v_existing.generation_version,
    v_existing.cycle_key,
    v_existing.variant_id,
    v_existing.variant_content_version,
    v_existing.resolution_id,
    v_existing.resolved_at,
    true;
end;
$$;

revoke all on function public.record_cartographic_drift_cycle_resolution_v1(
  text, integer, integer, text, text, integer, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.record_cartographic_drift_cycle_resolution_v1(
  text, integer, integer, text, text, integer, text, timestamptz
) to service_role;

comment on function public.record_cartographic_drift_cycle_resolution_v1(
  text, integer, integer, text, text, integer, text, timestamptz
) is
  'Records one immutable authored Cartographic Drift resolution per definition/cycle. Identical or conflicting replays return the existing row; application authority decides whether an existing row matches the candidate.';

commit;
