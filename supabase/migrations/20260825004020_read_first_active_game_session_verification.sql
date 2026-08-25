create or replace function public.ensure_active_game_session_v1(
  p_user_id uuid,
  p_auth_session_id text
)
returns boolean
language plpgsql
security definer
set search_path to 'pg_catalog', 'app_private'
as $function$
declare
  v_current_session_id text;
  v_last_seen_at timestamptz;
begin
  if p_user_id is null
    or p_auth_session_id is null
    or char_length(p_auth_session_id) not between 1 and 200 then
    return false;
  end if;

  -- Verification is a hot read path. Read the existing lease first so normal authenticated
  -- requests do not perform an INSERT ... ON CONFLICT against the same per-account row/index.
  select auth_session_id, last_seen_at
  into v_current_session_id, v_last_seen_at
  from app_private.account_game_session_leases
  where user_id = p_user_id;

  if not found then
    -- Preserve first-use/legacy bootstrap semantics without overwriting a concurrent claim.
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
  end if;

  if not found or v_current_session_id <> p_auth_session_id then
    return false;
  end if;

  -- Keep the existing coarse heartbeat, but only after a successful read-only identity check.
  -- The predicate makes concurrent stale-heartbeat attempts collapse to at most one actual write.
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
$function$;
