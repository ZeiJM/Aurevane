begin;

-- CSR-0 privacy provenance stays in the server-only app_private boundary. Browser-facing
-- session/event RPCs intentionally remain unchanged; later CSR tickets will consume this
-- journal to project viewer-relative state and history without inferring privacy after the fact.
create table app_private.battle_privacy_journal (
  battle_session_id uuid not null,
  battle_version bigint not null check (battle_version > 1),
  journal jsonb not null check (jsonb_typeof(journal) = 'object'),
  created_at timestamptz not null,
  primary key (battle_session_id, battle_version),
  constraint battle_privacy_journal_snapshot_fk
    foreign key (battle_session_id, battle_version)
    references app_private.battle_snapshots (battle_session_id, battle_version)
    on delete cascade
);

comment on table app_private.battle_privacy_journal is
  'Server-private append-only visibility provenance for committed battle command event batches. Absence denotes pre-CSR legacy/public history.';
comment on column app_private.battle_privacy_journal.journal is
  'Versioned privacy journal payload. Actor/team identity is stamped from the immutable command-start snapshot by commit_battle_intent_v3.';

revoke all on table app_private.battle_privacy_journal
  from public, anon, authenticated;

create function app_private.is_battle_privacy_visibility_v1(p_visibility jsonb)
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select
    jsonb_typeof(p_visibility) = 'object'
    and (
      (
        p_visibility ->> 'kind' = 'public'
        and not (p_visibility ? 'teamId')
      )
      or (
        p_visibility ->> 'kind' = 'team-only'
        and nullif(btrim(p_visibility ->> 'teamId'), '') is not null
      )
    );
$$;

revoke all on function app_private.is_battle_privacy_visibility_v1(jsonb)
  from public, anon, authenticated, service_role;

create function public.commit_battle_intent_v3(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
  p_battle_session_id uuid,
  p_expected_battle_version bigint,
  p_next_snapshot jsonb,
  p_events jsonb,
  p_privacy_journal jsonb
)
returns table (
  battle_session_id uuid,
  battle_version bigint,
  snapshot jsonb,
  committed_at timestamptz,
  replayed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_battle_session_id uuid;
  v_battle_version bigint;
  v_snapshot jsonb;
  v_committed_at timestamptz;
  v_replayed boolean;
  v_previous_snapshot jsonb;
  v_actor_combatant_id text;
  v_actor_team_id text;
  v_command_visibility jsonb := '{"kind":"public"}'::jsonb;
  v_event_visibility_overrides jsonb := '[]'::jsonb;
  v_override jsonb;
  v_event_index integer;
  v_seen_event_indexes integer[] := array[]::integer[];
begin
  -- Preserve every hardened v2 authorization, stale-version, idempotency, and terminal
  -- no-op rule. If validation below raises, PostgreSQL rolls this whole v3 call back,
  -- including any v2 mutation, so snapshot/events/journal remain atomic.
  select
    r.battle_session_id,
    r.battle_version,
    r.snapshot,
    r.committed_at,
    r.replayed
  into
    v_battle_session_id,
    v_battle_version,
    v_snapshot,
    v_committed_at,
    v_replayed
  from public.commit_battle_intent_v2(
    p_actor_key,
    p_idempotency_key,
    p_request_fingerprint,
    p_user_id,
    p_battle_session_id,
    p_expected_battle_version,
    p_next_snapshot,
    p_events
  ) r;

  if not found then
    return;
  end if;

  -- Exact idempotent replay and terminal read-only replay never append provenance.
  -- A successful earlier v3 mutation already owns its immutable journal row; a legacy
  -- v2 mutation intentionally remains legacy/public rather than being backfilled later.
  if v_replayed then
    return query
    select
      v_battle_session_id,
      v_battle_version,
      v_snapshot,
      v_committed_at,
      true;
    return;
  end if;

  select snap.snapshot
  into v_previous_snapshot
  from app_private.battle_snapshots snap
  where snap.battle_session_id = p_battle_session_id
    and snap.battle_version = p_expected_battle_version;

  v_actor_combatant_id := v_previous_snapshot #>> '{tactical,battle,currentTurn,combatantId}';

  if nullif(btrim(v_actor_combatant_id), '') is null then
    raise exception using errcode = '22023', message = 'BATTLE_PRIVACY_JOURNAL_AUTHORITY_INVALID';
  end if;

  select combatant.value ->> 'teamId'
  into v_actor_team_id
  from jsonb_array_elements(v_previous_snapshot #> '{tactical,battle,combatants}') combatant(value)
  where combatant.value ->> 'id' = v_actor_combatant_id
  limit 1;

  if nullif(btrim(v_actor_team_id), '') is null then
    raise exception using errcode = '22023', message = 'BATTLE_PRIVACY_JOURNAL_AUTHORITY_INVALID';
  end if;

  if p_privacy_journal is not null then
    if jsonb_typeof(p_privacy_journal) <> 'object'
      or jsonb_typeof(p_privacy_journal -> 'schemaVersion') <> 'number'
      or p_privacy_journal ->> 'schemaVersion' <> '1'
      or not app_private.is_battle_privacy_visibility_v1(
        p_privacy_journal -> 'commandVisibility'
      )
      or jsonb_typeof(p_privacy_journal -> 'eventVisibilityOverrides') <> 'array' then
      raise exception using errcode = '22023', message = 'BATTLE_PRIVACY_JOURNAL_INVALID';
    end if;

    v_command_visibility := p_privacy_journal -> 'commandVisibility';
    v_event_visibility_overrides := p_privacy_journal -> 'eventVisibilityOverrides';

    for v_override in
      select item.value
      from jsonb_array_elements(v_event_visibility_overrides) item(value)
    loop
      if jsonb_typeof(v_override) <> 'object'
        or jsonb_typeof(v_override -> 'eventIndex') <> 'number'
        or (v_override ->> 'eventIndex') !~ '^[0-9]+$'
        or not app_private.is_battle_privacy_visibility_v1(v_override -> 'visibility') then
        raise exception using errcode = '22023', message = 'BATTLE_PRIVACY_JOURNAL_INVALID';
      end if;

      begin
        v_event_index := (v_override ->> 'eventIndex')::integer;
      exception when numeric_value_out_of_range then
        raise exception using errcode = '22023', message = 'BATTLE_PRIVACY_JOURNAL_INVALID';
      end;

      if v_event_index >= jsonb_array_length(p_events)
        or v_event_index = any(v_seen_event_indexes) then
        raise exception using errcode = '22023', message = 'BATTLE_PRIVACY_JOURNAL_INVALID';
      end if;

      v_seen_event_indexes := array_append(v_seen_event_indexes, v_event_index);
    end loop;
  end if;

  insert into app_private.battle_privacy_journal (
    battle_session_id,
    battle_version,
    journal,
    created_at
  )
  values (
    v_battle_session_id,
    v_battle_version,
    jsonb_build_object(
      'schemaVersion', 1,
      'actorCombatantId', v_actor_combatant_id,
      'actorTeamId', v_actor_team_id,
      'commandVisibility', v_command_visibility,
      'eventVisibilityOverrides', v_event_visibility_overrides,
      'eventCount', jsonb_array_length(p_events)
    ),
    v_committed_at
  );

  return query
  select
    v_battle_session_id,
    v_battle_version,
    v_snapshot,
    v_committed_at,
    false;
end;
$$;

comment on function public.commit_battle_intent_v3(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb, jsonb) is
  'Authoritative battle intent commit with atomic server-private privacy provenance. Null privacy input records a public baseline; explicit input supplies resolver-time command/event visibility decisions while actor/team identity is stamped from command-start state.';

revoke all on function public.commit_battle_intent_v3(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_battle_intent_v3(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb, jsonb)
  to service_role;

commit;
