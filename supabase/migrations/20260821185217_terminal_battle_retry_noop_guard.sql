begin;

-- Compatibility guard for stale clients that keep retrying intents after a battle
-- has already reached an immutable terminal state. Exact committed retries still
-- resolve through the normal idempotency replay path. New late intents against a
-- completed/abandoned battle receive the current authoritative snapshot as a
-- read-only replay/no-op instead of an error that can amplify into a retry storm.

alter function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)
  rename to commit_battle_intent_v2_inner;

revoke all on function public.commit_battle_intent_v2_inner(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)
  from public, anon, authenticated, service_role;

create function public.commit_battle_intent_v2(
  p_actor_key text,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_user_id uuid,
  p_battle_session_id uuid,
  p_expected_battle_version bigint,
  p_next_snapshot jsonb,
  p_events jsonb
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
begin
  -- Preserve exact idempotent replay semantics when this key already committed.
  return query
  select r.battle_session_id, r.battle_version, r.snapshot, r.committed_at, r.replayed
  from public.get_battle_intent_replay_v1(
    p_actor_key,
    p_idempotency_key,
    p_request_fingerprint,
    p_user_id,
    p_battle_session_id
  ) r;
  if found then
    return;
  end if;

  -- Terminal battles are immutable. Late/retried intents become an authoritative
  -- read-only resync, avoiding stale-version/terminal errors that retrying clients
  -- can amplify into sustained PostgREST load.
  return query
  select
    s.id,
    s.current_version,
    s.current_snapshot,
    s.updated_at,
    true
  from app_private.battle_sessions s
  where s.id = p_battle_session_id
    and s.lifecycle in ('completed', 'abandoned')
    and exists (
      select 1
      from app_private.battle_participants p
      where p.battle_session_id = s.id
        and p.user_id = p_user_id
        and p.participant_role = 'player'
    );
  if found then
    return;
  end if;

  -- Active battles retain the strict authoritative mutation semantics, including
  -- optimistic version checks and transactional idempotency handling.
  return query
  select i.battle_session_id, i.battle_version, i.snapshot, i.committed_at, i.replayed
  from public.commit_battle_intent_v2_inner(
    p_actor_key,
    p_idempotency_key,
    p_request_fingerprint,
    p_user_id,
    p_battle_session_id,
    p_expected_battle_version,
    p_next_snapshot,
    p_events
  ) i;
end;
$$;

comment on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb) is
  'Compatibility guard: exact replay first, terminal battles resync as read-only no-ops, active battles delegate to strict authoritative mutation semantics.';

revoke all on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.commit_battle_intent_v2(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)
  to service_role;

commit;
