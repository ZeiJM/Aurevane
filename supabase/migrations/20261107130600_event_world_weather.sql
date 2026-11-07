begin;

-- Scope is the same global weather fact that World Environment exposes. Keep
-- ungated active and historical objectives as they are.
alter table app_private.event_run_objectives
  add column arrival_weather text check (arrival_weather in ('clear','overcast','rain','storm','fog','wind'));
create index world_environment_audit_effective_time_idx
  on app_private.world_environment_audit (changed_at desc, id desc);

-- Port of the existing deterministic World weather roll, so a committed step can
-- evaluate it within the movement transaction. Match the JS 32-bit arithmetic
-- without signed bigint overflow. The cross-runtime parity test pins this contract.
create function app_private.world_weather_roll_hash_v1(p_input bigint)
returns double precision language plpgsql immutable strict set search_path = '' as $$
declare
  t bigint := (p_input + 1831565813) & 4294967295;
begin
  t := mod((t # (t >> 15))::numeric * (t | 1), 4294967296)::bigint;
  t := t # ((t + mod((t # (t >> 7))::numeric * (t | 61), 4294967296)::bigint) & 4294967295);
  return (t # (t >> 14)) / 4294967296.0::double precision;
end;
$$;

create function app_private.world_weather_fact_v1(p_at_ms bigint, p_settings jsonb)
returns jsonb language plpgsql immutable strict set search_path = '' as $$
declare
  roll_index bigint;
  i bigint;
  draw double precision;
  weather text := p_settings->>'weatherOverride';
  source text := 'master';
begin
  if weather is null or p_at_ms >= (p_settings->>'weatherOverrideUntilMs')::bigint then
    source := 'live';
    weather := 'clear';
    roll_index := floor(p_at_ms::numeric / (60000 * coalesce((p_settings->>'weatherRollMinutes')::int, 360)))::bigint;
    i := roll_index - 96;
    while i <= roll_index loop
      if app_private.world_weather_roll_hash_v1(i) >= 0.5 then
        draw := app_private.world_weather_roll_hash_v1(i + 7919);
        weather := case weather
          when 'clear' then case when draw < 0.4 then 'overcast' when draw < 0.65 then 'wind' when draw < 0.85 then 'fog' else 'rain' end
          when 'overcast' then case when draw < 0.35 then 'clear' when draw < 0.7 then 'rain' when draw < 0.8 then 'fog' when draw < 0.9 then 'wind' else 'storm' end
          when 'rain' then case when draw < 0.4 then 'overcast' when draw < 0.65 then 'storm' when draw < 0.85 then 'clear' else 'fog' end
          when 'storm' then case when draw < 0.5 then 'rain' when draw < 0.9 then 'overcast' else 'clear' end
          when 'fog' then case when draw < 0.5 then 'clear' when draw < 0.85 then 'overcast' else 'rain' end
          when 'wind' then case when draw < 0.4 then 'clear' when draw < 0.75 then 'overcast' when draw < 0.9 then 'rain' else 'storm' end
        end;
      end if;
      i := i + 1;
    end loop;
  end if;
  return jsonb_build_object('type', weather, 'source', source, 'settingsVersion', (p_settings->>'version')::int);
end;
$$;

-- A route can settle multiple steps after their actual arrival. Use the settings
-- in effect at the recorded arrival, never an override activated later.
create function app_private.world_weather_at_v1(p_arrived_at timestamptz)
returns jsonb language sql stable strict set search_path = '' as $$
  select app_private.world_weather_fact_v1(
    floor(extract(epoch from p_arrived_at) * 1000)::bigint,
    coalesce(
      (select a.after_settings from app_private.world_environment_audit a
       where a.changed_at <= p_arrived_at order by a.changed_at desc, a.id desc limit 1),
      (select a.before_settings from app_private.world_environment_audit a order by a.changed_at, a.id limit 1),
      (select app_private.world_environment_json_v1(s) from app_private.world_environment_settings s)
    )
  );
$$;
revoke all on function app_private.world_weather_roll_hash_v1(bigint),
  app_private.world_weather_fact_v1(bigint,jsonb), app_private.world_weather_at_v1(timestamptz)
  from public, anon, authenticated, service_role;

-- Pin the weather option from the same immutable definition as the position.
create or replace function app_private.capture_event_arrival_position_v1()
returns trigger language plpgsql set search_path = '' as $$
begin
  select jsonb_build_object(
    'sectorId', objective#>'{worldNavigation,sectorId}',
    'x', objective#>'{worldNavigation,x}',
    'y', objective#>'{worldNavigation,y}'
  ), objective->>'requiredWeather' into new.arrival_position, new.arrival_weather
  from app_private.event_runs run
  join app_private.event_definition_versions version on version.id = run.definition_version_id
  cross join lateral jsonb_array_elements(version.definition->'phases') phase
  cross join lateral jsonb_array_elements(phase->'objectives') objective
  where run.id = new.run_id and phase->>'id' = new.phase_id
    and objective->>'id' = new.objective_id and objective->>'completion' = 'world-arrival';
  return new;
end;
$$;

-- Only confirmed movement can write credit to an arrival objective or use the
-- reserved source reference that deduplicates those arrivals. Keep the existing
-- ledger, locks, idempotency and receipt in one private implementation.
do $ledger$
declare
  body text := pg_get_functiondef('public.record_event_contribution_v1(text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb)'::regprocedure);
  write_anchor constant text := '  if v_objective.objective_status <> ''active'' then';
begin
  if strpos(body, write_anchor) = 0 or strpos(body, 'p_provenance jsonb)') = 0 then
    raise exception 'EVENT_WORLD_WEATHER_LEDGER_PREDECESSOR_MISSING';
  end if;
  body := replace(body, 'public.record_event_contribution_v1(', 'app_private.record_event_contribution_v1(');
  body := replace(body, 'p_provenance jsonb)', 'p_provenance jsonb, p_confirmed_world_arrival boolean)');
  execute replace(body, write_anchor, $guard$
  if v_objective.arrival_position is not null and p_confirmed_world_arrival is not true then
    raise exception using errcode = '22023', message = 'EVENT_CONTRIBUTION_REQUIRES_CONFIRMED_WORLD_ARRIVAL';
  end if;
$guard$ || write_anchor);
end;
$ledger$;
revoke all on function app_private.record_event_contribution_v1(
  text,uuid,text,uuid,uuid,uuid,text,text,text,text,bigint,jsonb,boolean
) from public, anon, authenticated, service_role;

create or replace function public.record_event_contribution_v1(
  p_actor_key text, p_idempotency_key uuid, p_request_fingerprint text,
  p_run_id uuid, p_user_id uuid, p_character_id uuid, p_phase_id text, p_objective_id text,
  p_source_system text, p_source_reference text, p_amount bigint, p_provenance jsonb
)
returns table (
  contribution_id uuid, participant_contribution_count bigint, participant_contribution_total bigint,
  objective_progress bigint, objective_status text, recorded_at timestamptz,
  replayed boolean, source_deduplicated boolean
)
language plpgsql security definer set search_path = '' as $$
begin
  if p_source_system = 'world-arrival' then
    raise exception using errcode = '22023', message = 'EVENT_WORLD_ARRIVAL_SOURCE_RESERVED';
  end if;
  return query select * from app_private.record_event_contribution_v1(
    p_actor_key, p_idempotency_key, p_request_fingerprint, p_run_id, p_user_id, p_character_id,
    p_phase_id, p_objective_id, p_source_system, p_source_reference, p_amount, p_provenance, false
  );
end;
$$;

do $migration$
declare
  body text;
  edit record;
begin
  for edit in select * from (values
    ('app_private.assert_event_runtime_supported_v1(jsonb)',
      '      if objective ? ''completion'' and (',
      $guard$
      if objective ? 'requiredWeather' and (
        objective->>'completion' is distinct from 'world-arrival'
        or jsonb_typeof(objective->'requiredWeather') is distinct from 'string'
        or objective->>'requiredWeather' not in ('clear','overcast','rain','storm','fog','wind')
      ) then
        raise exception using errcode = '22023', message = 'EVENT_WORLD_ARRIVAL_WEATHER_INVALID';
      end if;
      if objective ? 'completion' and ($guard$),
    ('app_private.record_world_event_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)',
      '  source_key text;',
      E'  source_key text;\n  weather jsonb;\n  weather_locked boolean := false;'),
    ('app_private.record_world_event_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)',
      'select objective.run_id, objective.phase_id, objective.objective_id,',
      $candidates$select objective.run_id, objective.phase_id, objective.objective_id, objective.arrival_weather,
      bool_or(objective.arrival_weather is not null) over () as has_gated_arrival,$candidates$),
    ('app_private.record_world_event_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)',
      '    -- Use the kernel''s lock order.',
      $lock$
    if candidate.has_gated_arrival and not weather_locked then
      -- A waiting settings writer must not sit between locks on Event Runs.
      -- Acquire once before any Run lock, and read the audit in a later statement.
      perform pg_advisory_xact_lock_shared(hashtextextended('world-environment', 0));
      weather_locked := true;
    end if;
    -- Use the kernel's lock order.$lock$),
    ('app_private.record_world_event_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)',
      '    perform public.record_event_contribution_v1(',
      $credit$
    weather := null;
    if candidate.arrival_weather is not null then
      weather := app_private.world_weather_at_v1(candidate.arrived_at);
      if weather->>'type' is distinct from candidate.arrival_weather then continue; end if;
    end if;
    perform app_private.record_event_contribution_v1($credit$),
    ('app_private.record_world_event_arrivals_v1(uuid,uuid,jsonb,bigint,bigint)',
      'jsonb_build_object(''position'', candidate.position, ''arrivedAt'', candidate.arrived_at)',
      $provenance$jsonb_build_object('position', candidate.position, 'arrivedAt', candidate.arrived_at)
        || case when weather is null then '{}'::jsonb else jsonb_build_object('weather', weather) end, true$provenance$),
    ('public.read_world_state_before_ferry_v1(uuid,uuid,jsonb)',
      '''navigation'',objective->''worldNavigation'',',
      $projection$'navigation',objective->'worldNavigation',
     'requiredWeather',(select pinned.arrival_weather from app_private.event_run_objectives pinned
       where pinned.run_id = r.id and pinned.phase_id = r.current_phase_id
         and pinned.objective_id = objective->>'id'),$projection$)
  ) as edits(signature, before_text, after_text)
  loop
    body := pg_get_functiondef(edit.signature::regprocedure);
    if strpos(body, edit.before_text) = 0 then
      raise exception 'EVENT_WORLD_WEATHER_PREDECESSOR_MISSING: %', edit.signature;
    end if;
    execute replace(body, edit.before_text, edit.after_text);
  end loop;
end;
$migration$;

commit;
