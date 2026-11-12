-- Shared random Void selection on the existing World environment singleton.
-- Historical warpedPhase/ferry trips/discoveries stay untouched. Future arrivals
-- opt in to world_void_rotation_v1 explicitly; existing expeditions never relocate.
begin;

alter table app_private.world_environment_settings
  add column void_realm_override text check (void_realm_override in (
    'ivory-veil','amber-drowned','cinder-choir','glass-tides',
    'hollow-orchard','starfall-basin','violet-estuary','clockwound-waste')),
  add column void_realm_override_until_ms bigint check (void_realm_override_until_ms >= 0),
  add constraint world_void_override_pair check (
    (void_realm_override is null) = (void_realm_override_until_ms is null));

create or replace function app_private.world_environment_json_v1(s app_private.world_environment_settings)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'version', s.version,
    'dayLengthMinutes', s.day_length_minutes,
    'weatherRollMinutes', s.weather_roll_minutes,
    'warpedShiftMinutes', s.warped_shift_minutes,
    'voidRealmOverride', s.void_realm_override,
    'voidRealmOverrideUntilMs', s.void_realm_override_until_ms,
    'timeOffsetMinutes', s.time_offset_minutes,
    'frozenMinuteOfDay', s.frozen_minute_of_day,
    'weatherOverride', s.weather_override,
    'weatherOverrideUntilMs', case when s.weather_override_until is null then null
      else floor(extract(epoch from s.weather_override_until) * 1000)::bigint end
  );
$$;

-- Same seeded draw as resolveVoidRotation; order is a versioned mapping, not a
-- visual color cycle. Every interval can select any of the eight maps again.
create function app_private.world_void_realm_at_phase_v1(p_phase bigint)
returns text language sql immutable strict set search_path = pg_catalog as $$
  with seed as (
    select (mod(mod(p_phase,2147483647) + 2147483647,2147483647) * 48271 + 131071) % 2147483647 n
  )
  select (array['ivory-veil','amber-drowned','cinder-choir','glass-tides',
    'hollow-orchard','starfall-basin','violet-estuary','clockwound-waste'])[
    ((n*n+104729) % 2147483647 % 8 + 1)::integer] from seed;
$$;

-- Backend-only current selection. Call after acquiring the world-environment
-- advisory lock when an arrival must serialize with a concurrent Master force.
create function app_private.world_void_rotation_v1(p_at_ms bigint)
returns jsonb language sql stable strict set search_path = pg_catalog as $$
  with schedule as (
    select s.*, floor(p_at_ms::numeric / (s.warped_shift_minutes::bigint * 60000))::bigint phase
    from app_private.world_environment_settings s where s.singleton
  )
  select jsonb_build_object(
    'realmId', case when void_realm_override is not null and p_at_ms < void_realm_override_until_ms
      then void_realm_override else app_private.world_void_realm_at_phase_v1(phase) end,
    'source', case when void_realm_override is not null and p_at_ms < void_realm_override_until_ms
      then 'master' else 'live' end,
    'nextRollAt', (phase + 1) * (warped_shift_minutes::bigint * 60000)
  ) from schedule;
$$;
revoke all on function app_private.world_void_realm_at_phase_v1(bigint) from public, anon, authenticated, service_role;
revoke all on function app_private.world_void_rotation_v1(bigint) from public, anon, authenticated, service_role;

-- Extend both existing signatures in place, preserving separate Owner/delegated
-- selected-character authorization, advisory/row locks, version CAS, and audit.
-- Expiry is calculated by the database inside that same transaction: clients
-- cannot extend overrides, and keep-current cannot revive an expired selection.
do $migration$
declare
  fn record;
  definition text;
  patch record;
  patched integer := 0;
begin
  for fn in
    select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'set_world_environment_v2'
  loop
    definition := pg_get_functiondef(fn.oid);
    for patch in select * from (values
      ('  v_warped integer;', '  v_warped integer;' || chr(10) || '  v_void text;' || chr(10) || '  v_void_until bigint;' || chr(10) || '  v_void_now bigint;' || chr(10) || '  v_void_next bigint;'),
      ($from$'warpedShiftMinutes','timeOffsetMinutes'$from$, $to$'warpedShiftMinutes','voidRealm','timeOffsetMinutes'$to$),
      ($from$  v_keep_weather := not (p_settings ? 'weatherOverride');$from$, $to$  if p_settings ? 'voidRealm' then
    if jsonb_typeof(p_settings->'voidRealm') not in ('null','string')
      or (jsonb_typeof(p_settings->'voidRealm') = 'string' and p_settings->>'voidRealm' not in (
        'unchanged','ivory-veil','amber-drowned','cinder-choir','glass-tides',
        'hollow-orchard','starfall-basin','violet-estuary','clockwound-waste')) then
      raise exception 'INVALID_WORLD_ENVIRONMENT';
    end if;
  end if;
  v_keep_weather := not (p_settings ? 'weatherOverride');$to$),
      ($from$  v_before := app_private.world_environment_json_v1(v_current);$from$, $to$  v_void_now := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  v_void_next := (floor(v_void_now::numeric / (coalesce(v_warped,v_current.warped_shift_minutes)::bigint * 60000))::bigint + 1)
    * (coalesce(v_warped,v_current.warped_shift_minutes)::bigint * 60000);
  if p_settings ? 'voidRealm' and jsonb_typeof(p_settings->'voidRealm') = 'null' then
    v_void := null;
    v_void_until := null;
  elsif p_settings ? 'voidRealm' and p_settings->>'voidRealm' <> 'unchanged' then
    v_void := p_settings->>'voidRealm';
    v_void_until := v_void_next;
  elsif v_current.void_realm_override is not null and v_current.void_realm_override_until_ms > v_void_now then
    v_void := v_current.void_realm_override;
    v_void_until := least(v_current.void_realm_override_until_ms,v_void_next);
  end if;
  v_before := app_private.world_environment_json_v1(v_current);$to$),
      ('    and v_current.time_offset_minutes = v_offset', '    and v_current.void_realm_override is not distinct from v_void' || chr(10) || '    and v_current.void_realm_override_until_ms is not distinct from v_void_until' || chr(10) || '    and v_current.time_offset_minutes = v_offset'),
      ('    time_offset_minutes = v_offset,', '    void_realm_override = v_void,' || chr(10) || '    void_realm_override_until_ms = v_void_until,' || chr(10) || '    time_offset_minutes = v_offset,')
    ) as edits(before_text, after_text)
    loop
      if strpos(definition, patch.before_text) = 0 then
        raise exception 'Expected world environment write fragment missing from %', fn.oid::regprocedure;
      end if;
      definition := replace(definition, patch.before_text, patch.after_text);
    end loop;
    execute definition;
    patched := patched + 1;
  end loop;
  if patched <> 2 then raise exception 'Expected two world environment writers, found %', patched; end if;
end;
$migration$;
commit;
