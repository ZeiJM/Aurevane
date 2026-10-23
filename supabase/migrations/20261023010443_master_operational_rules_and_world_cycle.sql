-- Reason-free operational saves retain private actor/time/before/after history and internal CAS.
-- Existing records, legacy RPCs and captured gameplay policies are not rewritten.
begin;
alter table app_private.world_environment_settings add column day_length_minutes integer not null default 1440 check (day_length_minutes between 1 and 10080);
alter table app_private.world_environment_audit alter column reason drop not null;
alter table app_private.battlefield_elevation_policy_versions alter column reason drop not null;
create or replace function app_private.world_environment_json_v1(s app_private.world_environment_settings)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'version', s.version,
    'dayLengthMinutes', s.day_length_minutes,
    'timeOffsetMinutes', s.time_offset_minutes,
    'frozenMinuteOfDay', s.frozen_minute_of_day,
    'weatherOverride', s.weather_override,
    'weatherOverrideUntilMs', case when s.weather_override_until is null then null
      else floor(extract(epoch from s.weather_override_until) * 1000)::bigint end
  );
$$;

create function public.set_world_environment_v2(p_actor uuid, p_expected_version integer, p_settings jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_current app_private.world_environment_settings%rowtype;
  v_offset integer;
  v_day integer;
  v_keep_weather boolean;
  v_frozen integer;
  v_weather text;
  v_until timestamptz;
  v_until_ms numeric;
  v_before jsonb;
  v_after jsonb;
begin
  perform app_private.assert_game_owner_v1(p_actor);
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' or p_expected_version is null then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  if exists (select 1 from jsonb_object_keys(p_settings) k
      where k not in ('dayLengthMinutes','timeOffsetMinutes','frozenMinuteOfDay','weatherOverride','weatherOverrideUntilMs')) then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  if not (p_settings ?& array['dayLengthMinutes','timeOffsetMinutes','frozenMinuteOfDay'])
    or (p_settings ? 'weatherOverride') <> (p_settings ? 'weatherOverrideUntilMs')
    or jsonb_typeof(p_settings->'dayLengthMinutes') is distinct from 'number'
    or (p_settings->>'dayLengthMinutes') !~ '^[0-9]{1,5}$' then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
  v_day := (p_settings->>'dayLengthMinutes')::integer;
  if v_day not between 1 and 10080 then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
  v_keep_weather := not (p_settings ? 'weatherOverride');
  if jsonb_typeof(p_settings->'timeOffsetMinutes') is distinct from 'number'  or (p_settings->>'timeOffsetMinutes') !~ '^-?[0-9]{1,4}$' then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  v_offset := (p_settings->>'timeOffsetMinutes')::integer;
  if v_offset not between -1440 and 1440 then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
  if coalesce(jsonb_typeof(p_settings->'frozenMinuteOfDay'), 'null') not in ('null','number') then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  if jsonb_typeof(p_settings->'frozenMinuteOfDay') = 'number' then
    if (p_settings->>'frozenMinuteOfDay') !~ '^[0-9]{1,4}$' then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
    v_frozen := (p_settings->>'frozenMinuteOfDay')::integer;
    if v_frozen not between 0 and 1439 then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
  end if;
  if coalesce(jsonb_typeof(p_settings->'weatherOverride'), 'null') not in ('null','string') then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  if jsonb_typeof(p_settings->'weatherOverride') = 'string' then
    v_weather := p_settings->>'weatherOverride';
    if v_weather not in ('clear','overcast','rain','storm','fog','wind') then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
  end if;
  if coalesce(jsonb_typeof(p_settings->'weatherOverrideUntilMs'), 'null') not in ('null','number') then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  if jsonb_typeof(p_settings->'weatherOverrideUntilMs') = 'number' then
    if v_weather is null or (p_settings->>'weatherOverrideUntilMs') !~ '^[0-9]{1,15}$' then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
    v_until_ms := (p_settings->>'weatherOverrideUntilMs')::numeric;
    v_until := to_timestamp(v_until_ms / 1000.0);
    if v_until <= clock_timestamp() or v_until > clock_timestamp() + interval '400 days' then
      raise exception 'INVALID_WORLD_ENVIRONMENT';
    end if;
  end if;
  if not v_keep_weather and v_weather is not null and v_until is null then raise exception 'INVALID_WORLD_ENVIRONMENT'; end if;
  perform pg_advisory_xact_lock(hashtextextended('world-environment', 0));
  select * into v_current from app_private.world_environment_settings for update;
  if v_current.version <> p_expected_version then raise exception 'WORLD_ENVIRONMENT_VERSION_CONFLICT'; end if;
  if v_keep_weather then
    v_weather := v_current.weather_override;
    v_until := v_current.weather_override_until;
  end if;
  v_before := app_private.world_environment_json_v1(v_current);
  update app_private.world_environment_settings set
    version = v_current.version + 1,
    day_length_minutes = v_day,
    time_offset_minutes = v_offset,
    frozen_minute_of_day = v_frozen,
    weather_override = v_weather,
    weather_override_until = v_until,
    updated_by = p_actor,
    updated_at = clock_timestamp()
  where singleton returning * into v_current;
  v_after := app_private.world_environment_json_v1(v_current);
  insert into app_private.world_environment_audit(version, actor_user_id, before_settings, after_settings)
  values (v_current.version, p_actor, v_before, v_after);
  return v_after;
end;
$$;

create function public.publish_battlefield_elevation_policy_v2(p_actor_user_id uuid,p_expected_version integer,p_chances jsonb)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_version integer;
  v_one integer;
  v_two integer;
  v_three integer;
begin
  perform app_private.assert_game_owner_v1(p_actor_user_id);
  if p_chances is null or jsonb_typeof(p_chances) <> 'object' then
    raise exception 'INVALID_ELEVATION_POLICY';
  end if;
  if (select count(*) from jsonb_object_keys(p_chances)) <> 3 or not (p_chances ?& array['level1BasisPoints','level2BasisPoints','level3BasisPoints']) or
    exists (select 1 from jsonb_each(p_chances) item where jsonb_typeof(item.value) <> 'number' or item.value::text !~ '^[0-9]{1,5}$') then
    raise exception 'INVALID_ELEVATION_POLICY';
  end if;
  v_one := (p_chances->>'level1BasisPoints')::integer;
  v_two := (p_chances->>'level2BasisPoints')::integer;
  v_three := (p_chances->>'level3BasisPoints')::integer;
  if v_one not between 0 and 10000 or v_two not between 0 and 10000 or v_three not between 0 and 10000 or v_one+v_two+v_three <> 10000 then
    raise exception 'INVALID_ELEVATION_POLICY';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('battlefield-elevation-policy',0));
  select max(version) into v_version from app_private.battlefield_elevation_policy_versions;
  if p_expected_version is null or v_version <> p_expected_version then raise exception 'ELEVATION_POLICY_VERSION_CONFLICT'; end if;
  insert into app_private.battlefield_elevation_policy_versions(version,level1_basis_points,level2_basis_points,level3_basis_points,published_by)
  values (v_version+1,v_one,v_two,v_three,p_actor_user_id);
  return jsonb_build_object('version',v_version+1,'level1BasisPoints',v_one,'level2BasisPoints',v_two,'level3BasisPoints',v_three);
end;
$$;

revoke all on function public.set_world_environment_v2(uuid,integer,jsonb) from public,anon,authenticated;
revoke all on function public.publish_battlefield_elevation_policy_v2(uuid,integer,jsonb) from public,anon,authenticated;
grant execute on function public.set_world_environment_v2(uuid,integer,jsonb) to service_role;
grant execute on function public.publish_battlefield_elevation_policy_v2(uuid,integer,jsonb) to service_role;
commit;
