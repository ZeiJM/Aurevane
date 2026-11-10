begin;

-- Keep the same service-only scene scope when registration cannot take its lock.
-- The server clips this approved prefix to the observer's known terrain.
do $migration$
declare
  definition text := pg_get_functiondef('public.read_world_scene_players_v1(uuid,uuid,bigint,text[],jsonb)'::regprocedure);
  previous_payload constant text := '      ) as payload';
  movement_payload constant text := $payload$      ) || case when w.character_id is null then '{}'::jsonb else jsonb_build_object(
        'movement', jsonb_build_object(
          'version', (w.state->>'version')::bigint,
          'serverNow', floor(extract(epoch from v_now) * 1000),
          'nextStepAt', w.state->'nextStepAt',
          'route', (select coalesce(jsonb_agg(step order by ord), '[]'::jsonb)
            from jsonb_array_elements(w.state->'route') with ordinality as r(step, ord) where ord <= 12)
        )
      ) end as payload$payload$;
begin
  if length(definition) - length(replace(definition, previous_payload, '')) <> length(previous_payload) then
    raise exception 'WORLD_SCENE_FALLBACK_PAYLOAD_PREDECESSOR_MISSING';
  end if;
  execute replace(definition, previous_payload, movement_payload);
end;
$migration$;

commit;
