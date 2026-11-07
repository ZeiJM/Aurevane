-- A real-time schedule applies to new expeditions only. Ferry arrival pins the
-- selected phase in the already versioned character world state.
begin;

alter table app_private.world_environment_settings
  add column warped_shift_minutes integer not null default 1440
  check (warped_shift_minutes between 1 and 10080);

create or replace function app_private.world_environment_json_v1(s app_private.world_environment_settings)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'version', s.version,
    'dayLengthMinutes', s.day_length_minutes,
    'weatherRollMinutes', s.weather_roll_minutes,
    'warpedShiftMinutes', s.warped_shift_minutes,
    'timeOffsetMinutes', s.time_offset_minutes,
    'frozenMinuteOfDay', s.frozen_minute_of_day,
    'weatherOverride', s.weather_override,
    'weatherOverrideUntilMs', case when s.weather_override_until is null then null
      else floor(extract(epoch from s.weather_override_until) * 1000)::bigint end
  );
$$;

-- Extend both entry points without changing their separate owner/delegated
-- authorization, locks, CAS or audit. Fail the migration if the baseline body
-- changed, instead of installing a settings writer that silently drops a key.
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
      ('  v_roll integer;', '  v_roll integer;' || chr(10) || '  v_warped integer;'),
      ($from$'weatherRollMinutes','timeOffsetMinutes'$from$, $to$'weatherRollMinutes','warpedShiftMinutes','timeOffsetMinutes'$to$),
      ($from$  v_keep_weather := not (p_settings ? 'weatherOverride');$from$, $to$  if p_settings ? 'warpedShiftMinutes' then
    if jsonb_typeof(p_settings->'warpedShiftMinutes') is distinct from 'number'
      or (p_settings->>'warpedShiftMinutes') !~ '^[0-9]{1,5}$' then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
    v_warped := (p_settings->>'warpedShiftMinutes')::integer;
    if v_warped not between 1 and 10080 then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
  end if;
  v_keep_weather := not (p_settings ? 'weatherOverride');$to$),
      ('    and v_current.time_offset_minutes = v_offset', '    and v_current.warped_shift_minutes = coalesce(v_warped,v_current.warped_shift_minutes)' || chr(10) || '    and v_current.time_offset_minutes = v_offset'),
      ('    time_offset_minutes = v_offset,', '    warped_shift_minutes = coalesce(v_warped, v_current.warped_shift_minutes),' || chr(10) || '    time_offset_minutes = v_offset,')
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
