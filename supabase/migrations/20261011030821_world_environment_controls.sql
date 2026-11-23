-- Owner-controlled World environment (shared day/night clock offset/freeze and weather override).
-- Private singleton + immutable audit; service-role-only narrow RPCs mirror existing Owner combat settings.
begin;
create table app_private.world_environment_settings (
  singleton boolean primary key default true check (singleton),
  version integer not null check (version >= 0),
  time_offset_minutes integer not null default 0 check (time_offset_minutes between -1440 and 1440),
  frozen_minute_of_day integer check (frozen_minute_of_day between 0 and 1439),
  weather_override text check (weather_override in ('clear','overcast','rain','storm','fog','wind')),
  weather_override_until timestamptz,
  updated_by uuid,
  updated_at timestamptz not null default clock_timestamp(),
  check (weather_override is not null or weather_override_until is null)
);
alter table app_private.world_environment_settings enable row level security;
revoke all on table app_private.world_environment_settings from public, anon, authenticated, service_role;
insert into app_private.world_environment_settings(singleton, version) values (true, 0);

create table app_private.world_environment_audit (
  id bigint generated always as identity primary key,
  version integer not null,
  actor_user_id uuid not null,
  reason text not null check (char_length(btrim(reason)) between 8 and 240),
  before_settings jsonb not null,
  after_settings jsonb not null,
  changed_at timestamptz not null default clock_timestamp()
);
alter table app_private.world_environment_audit enable row level security;
revoke all on table app_private.world_environment_audit from public, anon, authenticated, service_role;
create function app_private.world_environment_audit_immutable_v1()
returns trigger language plpgsql set search_path = pg_catalog as $$
begin raise exception 'WORLD_ENVIRONMENT_AUDIT_IMMUTABLE'; end;
$$;
create trigger world_environment_audit_immutable
  before update or delete on app_private.world_environment_audit
  for each row execute function app_private.world_environment_audit_immutable_v1();
create trigger world_environment_audit_no_truncate
  before truncate on app_private.world_environment_audit
  for each statement execute function app_private.world_environment_audit_immutable_v1();

create function app_private.world_environment_json_v1(s app_private.world_environment_settings)
returns jsonb language sql immutable set search_path = pg_catalog as $$
  select jsonb_build_object(
    'version', s.version,
    'timeOffsetMinutes', s.time_offset_minutes,
    'frozenMinuteOfDay', s.frozen_minute_of_day,
    'weatherOverride', s.weather_override,
    'weatherOverrideUntilMs', case when s.weather_override_until is null then null
      else floor(extract(epoch from s.weather_override_until) * 1000)::bigint end
  );
$$;

create function public.read_world_environment_v1()
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, app_private
as $$
  select app_private.world_environment_json_v1(s) from app_private.world_environment_settings s;
$$;

create function public.read_world_environment_history_v1(p_limit integer default 20)
returns jsonb language sql stable security definer
set search_path = pg_catalog, public, app_private
as $$
  select coalesce(jsonb_agg(row order by id desc), '[]'::jsonb) from (
    select a.id, jsonb_build_object(
      'id', a.id, 'version', a.version, 'actorUserId', a.actor_user_id, 'reason', a.reason,
      'before', a.before_settings, 'after', a.after_settings,
      'changedAtMs', floor(extract(epoch from a.changed_at) * 1000)::bigint
    ) as row
    from app_private.world_environment_audit a
    order by a.id desc limit least(greatest(coalesce(p_limit, 20), 1), 100)
  ) q;
$$;

create function public.set_world_environment_v1(p_actor uuid, p_expected_version integer, p_settings jsonb, p_reason text)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_current app_private.world_environment_settings%rowtype;
  v_offset integer;
  v_frozen integer;
  v_weather text;
  v_until timestamptz;
  v_until_ms numeric;
  v_before jsonb;
  v_after jsonb;
begin
  perform app_private.assert_game_owner_v1(p_actor);
  if p_settings is null or jsonb_typeof(p_settings) <> 'object' or p_reason is null
    or char_length(btrim(p_reason)) not between 8 and 240 or p_expected_version is null then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  if exists (select 1 from jsonb_object_keys(p_settings) k
      where k not in ('timeOffsetMinutes','frozenMinuteOfDay','weatherOverride','weatherOverrideUntilMs')) then
    raise exception 'INVALID_WORLD_ENVIRONMENT';
  end if;
  if jsonb_typeof(p_settings->'timeOffsetMinutes') <> 'number' or (p_settings->>'timeOffsetMinutes') !~ '^-?[0-9]{1,4}$' then
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
  perform pg_advisory_xact_lock(hashtextextended('world-environment', 0));
  select * into v_current from app_private.world_environment_settings for update;
  if v_current.version <> p_expected_version then raise exception 'WORLD_ENVIRONMENT_VERSION_CONFLICT'; end if;
  v_before := app_private.world_environment_json_v1(v_current);
  update app_private.world_environment_settings set
    version = v_current.version + 1,
    time_offset_minutes = v_offset,
    frozen_minute_of_day = v_frozen,
    weather_override = v_weather,
    weather_override_until = v_until,
    updated_by = p_actor,
    updated_at = clock_timestamp()
  where singleton returning * into v_current;
  v_after := app_private.world_environment_json_v1(v_current);
  insert into app_private.world_environment_audit(version, actor_user_id, reason, before_settings, after_settings)
  values (v_current.version, p_actor, btrim(p_reason), v_before, v_after);
  return v_after;
end;
$$;

revoke all on function app_private.world_environment_json_v1(app_private.world_environment_settings) from public, anon, authenticated;
revoke all on function app_private.world_environment_audit_immutable_v1() from public, anon, authenticated;
revoke all on function public.read_world_environment_v1() from public, anon, authenticated;
revoke all on function public.read_world_environment_history_v1(integer) from public, anon, authenticated;
revoke all on function public.set_world_environment_v1(uuid, integer, jsonb, text) from public, anon, authenticated;
grant execute on function public.read_world_environment_v1() to service_role;
grant execute on function public.read_world_environment_history_v1(integer) to service_role;
grant execute on function public.set_world_environment_v1(uuid, integer, jsonb, text) to service_role;
commit;
