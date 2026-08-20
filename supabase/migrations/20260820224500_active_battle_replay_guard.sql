begin;

create or replace function public.is_existing_battle_create_replay_v1(
  p_user_id uuid,
  p_idempotency_key uuid,
  p_battle_session_id uuid
)
returns boolean
language sql
security definer
set search_path = pg_catalog, app_private
stable
as $$
  select exists (
    select 1
    from app_private.idempotency_records i
    join app_private.battle_sessions s
      on s.id = (i.result ->> 'battle_session_id')::uuid
    where i.actor_key = p_user_id::text
      and i.command_name = 'battle.create.v1'
      and i.idempotency_key = p_idempotency_key
      and s.id = p_battle_session_id
      and s.owner_user_id = p_user_id
  );
$$;

revoke all on function public.is_existing_battle_create_replay_v1(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.is_existing_battle_create_replay_v1(uuid, uuid, uuid)
  to service_role;

commit;
