begin;

create or replace function app_private.is_valid_battle_snapshot_v1(
  p_snapshot jsonb,
  p_battle_id text,
  p_rules_version integer,
  p_content_version integer,
  p_lifecycle text default null
)
returns boolean
language sql
immutable
set search_path = pg_catalog
as $$
  select case
    when jsonb_typeof(p_snapshot) is distinct from 'object' then false
    when (p_snapshot #>> '{tactical,battle,battleId}') is null then false
    when (p_snapshot #>> '{tactical,battle,battleId}') is distinct from p_battle_id then false
    when (p_snapshot #>> '{tactical,battle,rulesVersion}') is null then false
    when (p_snapshot #>> '{tactical,battle,rulesVersion}') !~ '^[1-9][0-9]*$' then false
    when (p_snapshot #>> '{tactical,battle,rulesVersion}')::numeric is distinct from p_rules_version::numeric then false
    when (p_snapshot #>> '{tactical,battle,contentVersion}') is null then false
    when (p_snapshot #>> '{tactical,battle,contentVersion}') !~ '^[1-9][0-9]*$' then false
    when (p_snapshot #>> '{tactical,battle,contentVersion}')::numeric is distinct from p_content_version::numeric then false
    when p_lifecycle is not null
      and (p_snapshot #>> '{tactical,battle,lifecycle}') is distinct from p_lifecycle then false
    when jsonb_typeof(p_snapshot #> '{tactical,battle,combatants}') is distinct from 'array' then false
    when jsonb_array_length(p_snapshot #> '{tactical,battle,combatants}') < 2 then false
    when jsonb_typeof(p_snapshot #> '{tactical,battle,rng}') is distinct from 'object' then false
    else true
  end;
$$;

comment on function app_private.is_valid_battle_snapshot_v1(jsonb, text, integer, integer, text) is
  'Fail-closed structural/identity guard for authoritative P2.4 battle snapshots.';

revoke all on function app_private.is_valid_battle_snapshot_v1(jsonb, text, integer, integer, text)
  from public, anon, authenticated;

create or replace function app_private.assert_battle_session_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
begin
  if not app_private.is_valid_battle_snapshot_v1(
    new.current_snapshot,
    new.battle_id,
    new.rules_version,
    new.content_version,
    new.lifecycle
  ) then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_SNAPSHOT';
  end if;

  return new;
end;
$$;

create or replace function app_private.assert_battle_history_snapshot_v1()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare
  v_session app_private.battle_sessions%rowtype;
begin
  select * into v_session
  from app_private.battle_sessions
  where id = new.battle_session_id;

  if not found then
    raise exception using errcode = '23503', message = 'BATTLE_SESSION_NOT_FOUND';
  end if;

  if not app_private.is_valid_battle_snapshot_v1(
    new.snapshot,
    v_session.battle_id,
    v_session.rules_version,
    v_session.content_version,
    null
  ) then
    raise exception using errcode = '22023', message = 'BATTLE_INVALID_SNAPSHOT';
  end if;

  return new;
end;
$$;

revoke all on function app_private.assert_battle_session_snapshot_v1()
  from public, anon, authenticated;
revoke all on function app_private.assert_battle_history_snapshot_v1()
  from public, anon, authenticated;

drop trigger if exists battle_sessions_snapshot_guard_v1 on app_private.battle_sessions;
create trigger battle_sessions_snapshot_guard_v1
before insert or update of battle_id, rules_version, content_version, lifecycle, current_snapshot
on app_private.battle_sessions
for each row execute function app_private.assert_battle_session_snapshot_v1();

drop trigger if exists battle_snapshots_snapshot_guard_v1 on app_private.battle_snapshots;
create trigger battle_snapshots_snapshot_guard_v1
before insert or update of battle_session_id, snapshot
on app_private.battle_snapshots
for each row execute function app_private.assert_battle_history_snapshot_v1();

commit;
