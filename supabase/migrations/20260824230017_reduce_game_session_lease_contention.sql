create or replace function public.ensure_active_game_session_v1(
  p_user_id uuid,
  p_auth_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_current_session_id text;
  v_last_seen_at timestamptz;
begin
  if p_user_id is null
    or p_auth_session_id is null
    or char_length(p_auth_session_id) not between 1 and 200 then
    return false;
  end if;

  -- Verification is a very hot path. Do not serialize every authenticated request on the
  -- per-account advisory lock and row lock used by claim_active_game_session_v1.
  -- If no lease exists yet, initialize it without overwriting a concurrent claim.
  insert into app_private.account_game_session_leases (
    user_id,
    auth_session_id,
    claimed_at,
    last_seen_at
  ) values (
    p_user_id,
    p_auth_session_id,
    clock_timestamp(),
    clock_timestamp()
  )
  on conflict (user_id) do nothing;

  select auth_session_id, last_seen_at
  into v_current_session_id, v_last_seen_at
  from app_private.account_game_session_leases
  where user_id = p_user_id;

  if not found or v_current_session_id <> p_auth_session_id then
    return false;
  end if;

  -- Heartbeat at most once every 30 seconds instead of writing the lease row on every
  -- page/API request. The session identity is still checked on every call.
  if v_last_seen_at < clock_timestamp() - interval '30 seconds' then
    update app_private.account_game_session_leases
    set last_seen_at = clock_timestamp()
    where user_id = p_user_id
      and auth_session_id = p_auth_session_id
      and last_seen_at < clock_timestamp() - interval '30 seconds';
  end if;

  -- Re-check identity so a concurrent claim by a newer login cannot be accepted after it wins.
  return exists (
    select 1
    from app_private.account_game_session_leases
    where user_id = p_user_id
      and auth_session_id = p_auth_session_id
  );
end;
$$;

revoke all on function public.ensure_active_game_session_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.ensure_active_game_session_v1(uuid, text) to service_role;

comment on function public.ensure_active_game_session_v1(uuid, text) is
  'Verifies the active gameplay session without per-request locking; lease heartbeat writes are throttled to at most once per 30 seconds.';
