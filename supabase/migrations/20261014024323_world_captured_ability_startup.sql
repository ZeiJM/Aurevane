begin;

-- Extend world admission without replacing its ordered locks, movement/build
-- rechecks, participant ownership checks or route interruption transaction.
-- Existing callers and historical encounters continue to use the v1 interface.
create function public.start_world_encounter_v2(
  p_user_id uuid,
  p_character_id uuid,
  p_target_id uuid,
  p_expected_version bigint,
  p_target_version bigint,
  p_snapshot jsonb,
  p_build_versions jsonb,
  p_start_snapshot jsonb,
  p_initial_events jsonb,
  p_privacy_journal jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, app_private, public
as $$
declare
  v_result jsonb;
  v_session_id uuid;
  v_created_at timestamptz;
begin
  v_result := public.start_world_encounter_v1(
    p_user_id, p_character_id, p_target_id, p_expected_version, p_target_version,
    p_start_snapshot, p_build_versions
  );
  v_session_id := (v_result ->> 'battleSessionId')::uuid;
  select s.created_at into strict v_created_at
  from app_private.battle_sessions s where s.id = v_session_id;

  -- Any failure rolls back the predecessor's lobby, members, encounter and
  -- interrupted routes as well as all startup state and receipts. Retries still
  -- pass through v1's world-version and active-battle authority before appending.
  perform app_private.append_battle_startup_events_v1(
    v_session_id, p_start_snapshot, p_snapshot,
    p_initial_events, p_privacy_journal, v_created_at
  );
  return v_result;
end;
$$;

revoke all on function public.start_world_encounter_v2(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb)
  from public, anon, authenticated;
grant execute on function public.start_world_encounter_v2(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb,jsonb,jsonb,jsonb)
  to service_role;

commit;
