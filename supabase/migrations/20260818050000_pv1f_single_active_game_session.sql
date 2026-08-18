begin;

create table if not exists app_private.account_game_session_leases (
  user_id uuid primary key references auth.users(id) on delete cascade,
  auth_session_id text not null check (char_length(auth_session_id) between 1 and 200),
  claimed_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp()
);

comment on table app_private.account_game_session_leases is
  'Server-only single-active-game-session lease. The most recently claimed authenticated session owns gameplay for the account.';

revoke all on table app_private.account_game_session_leases from public, anon, authenticated;
grant select on table app_private.account_game_session_leases to service_role;

create or replace function app_private.abandon_active_battles_for_user_v1(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  update app_private.battle_sessions
  set
    lifecycle = 'abandoned',
    current_snapshot = jsonb_set(
      jsonb_set(
        current_snapshot,
        '{tactical,battle,lifecycle}',
        to_jsonb('abandoned'::text),
        true
      ),
      '{tactical,battle,currentTurn}',
      'null'::jsonb,
      true
    ),
    updated_at = clock_timestamp()
  where owner_user_id = p_user_id
    and lifecycle = 'active';
end;
$$;

revoke all on function app_private.abandon_active_battles_for_user_v1(uuid) from public, anon, authenticated;

create or replace function public.claim_active_game_session_v1(
  p_user_id uuid,
  p_auth_session_id text
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_previous_session_id text;
  v_replaced boolean := false;
begin
  if p_auth_session_id is null or char_length(p_auth_session_id) not between 1 and 200 then
    raise exception using errcode = '22023', message = 'ACTIVE_GAME_SESSION_INVALID';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select auth_session_id
  into v_previous_session_id
  from app_private.account_game_session_leases
  where user_id = p_user_id
  for update;

  if found then
    v_replaced := v_previous_session_id <> p_auth_session_id;

    update app_private.account_game_session_leases
    set
      auth_session_id = p_auth_session_id,
      claimed_at = case when v_replaced then clock_timestamp() else claimed_at end,
      last_seen_at = clock_timestamp()
    where user_id = p_user_id;
  else
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
    );
  end if;

  if v_replaced then
    perform app_private.abandon_active_battles_for_user_v1(p_user_id);
  end if;

  return v_replaced;
end;
$$;

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
begin
  if p_auth_session_id is null or char_length(p_auth_session_id) not between 1 and 200 then
    return false;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  select auth_session_id
  into v_current_session_id
  from app_private.account_game_session_leases
  where user_id = p_user_id
  for update;

  if not found then
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
    );
    return true;
  end if;

  if v_current_session_id <> p_auth_session_id then
    return false;
  end if;

  update app_private.account_game_session_leases
  set last_seen_at = clock_timestamp()
  where user_id = p_user_id;

  return true;
end;
$$;

revoke all on function public.claim_active_game_session_v1(uuid, text) from public, anon, authenticated;
revoke all on function public.ensure_active_game_session_v1(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_active_game_session_v1(uuid, text) to service_role;
grant execute on function public.ensure_active_game_session_v1(uuid, text) to service_role;

-- Normalize any existing duplicate active sessions before the hard uniqueness constraint is installed.
with ranked as (
  select
    id,
    row_number() over (
      partition by owner_user_id
      order by updated_at desc, created_at desc, id desc
    ) as position
  from app_private.battle_sessions
  where lifecycle = 'active'
)
update app_private.battle_sessions s
set
  lifecycle = 'abandoned',
  current_snapshot = jsonb_set(
    jsonb_set(
      s.current_snapshot,
      '{tactical,battle,lifecycle}',
      to_jsonb('abandoned'::text),
      true
    ),
    '{tactical,battle,currentTurn}',
    'null'::jsonb,
    true
  ),
  updated_at = clock_timestamp()
from ranked r
where s.id = r.id
  and r.position > 1;

create or replace function app_private.enforce_single_active_battle_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  if new.lifecycle <> 'active' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.owner_user_id::text, 1));

  update app_private.battle_sessions
  set
    lifecycle = 'abandoned',
    current_snapshot = jsonb_set(
      jsonb_set(
        current_snapshot,
        '{tactical,battle,lifecycle}',
        to_jsonb('abandoned'::text),
        true
      ),
      '{tactical,battle,currentTurn}',
      'null'::jsonb,
      true
    ),
    updated_at = clock_timestamp()
  where owner_user_id = new.owner_user_id
    and lifecycle = 'active'
    and id <> new.id;

  return new;
end;
$$;

drop trigger if exists battle_sessions_single_active_v1 on app_private.battle_sessions;
create trigger battle_sessions_single_active_v1
before insert or update of lifecycle on app_private.battle_sessions
for each row execute function app_private.enforce_single_active_battle_v1();

create unique index if not exists battle_sessions_one_active_per_owner_idx
  on app_private.battle_sessions (owner_user_id)
  where lifecycle = 'active';

commit;
