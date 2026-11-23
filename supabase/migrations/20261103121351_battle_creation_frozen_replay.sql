begin;

-- An exact creation retry returns its immutable receipt before live equipment,
-- catalogue or outside-battle preparation. Fresh writes still use the creation RPC.
create function public.get_battle_creation_replay_v1(
 p_user_id uuid,p_idempotency_key uuid,p_request_fingerprint text
) returns table(battle_session_id uuid,battle_version bigint,snapshot jsonb,created_at timestamptz,replayed boolean)
language plpgsql security definer set search_path='' as $$
declare receipt app_private.idempotency_records%rowtype;
begin
 if p_user_id is null or p_idempotency_key is null or p_request_fingerprint is null
 or char_length(p_request_fingerprint) not between 1 and 160 then
  raise exception using errcode='22023',message='BATTLE_INVALID_REPLAY_REQUEST';
 end if;
 select * into receipt from app_private.idempotency_records
 where actor_key=p_user_id::text and command_name='battle.create.v1' and idempotency_key=p_idempotency_key;
 if not found then return; end if;
 if receipt.request_fingerprint is distinct from p_request_fingerprint then
  raise exception using errcode='22023',message='BATTLE_IDEMPOTENCY_CONFLICT';
 end if;
 return query select s.id,1::bigint,snap.snapshot,(receipt.result->>'created_at')::timestamptz,true
 from app_private.battle_sessions s join app_private.battle_snapshots snap
 on snap.battle_session_id=s.id and snap.battle_version=1
 where s.id=(receipt.result->>'battle_session_id')::uuid and s.owner_user_id=p_user_id;
 if not found then raise exception using errcode='42501',message='BATTLE_NOT_AVAILABLE'; end if;
end; $$;
revoke all on function public.get_battle_creation_replay_v1(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.get_battle_creation_replay_v1(uuid,uuid,text) to service_role;
commit;
