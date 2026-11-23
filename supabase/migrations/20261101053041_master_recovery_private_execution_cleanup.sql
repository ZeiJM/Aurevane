begin;

-- NoContest discards private execution ledgers along with their active effects.
-- Patch the current definition so later page authority, conflict codes, all other
-- recovery guards, ownership and the existing service-only ACL remain intact.
do $migration$
declare
  definition text;
  forbidden_keys text := $guard$or p_terminal_snapshot ?| array['pendingSummons','pendingEffects','groundAreas','terrainOverlays','turnOrigin','turnTriggerState','percentageDotCommands','effectState']$guard$;
  old_state_keys text := $guard$(v_old-array['tactical','statBridge','statusState','abilityRuntime','pendingSummons','pendingEffects','groundAreas','terrainOverlays','turnOrigin','turnTriggerState','percentageDotCommands','effectState'])$guard$;
begin
  definition := pg_get_functiondef('public.recover_master_player_battle_v1(uuid,uuid,uuid,bigint,uuid[],uuid,jsonb,boolean,uuid)'::regprocedure);
  if (length(definition)-length(replace(definition,forbidden_keys,''))) <> length(forbidden_keys)
     or (length(definition)-length(replace(definition,old_state_keys,''))) <> length(old_state_keys) then
    raise exception 'MASTER_RECOVERY_EXECUTION_PREDECESSOR_CONFLICT';
  end if;
  definition := replace(definition,forbidden_keys,replace(forbidden_keys,$old$'effectState']$old$,$new$'effectState','endureState','reversalState']$new$));
  definition := replace(definition,old_state_keys,replace(old_state_keys,$old$'effectState']$old$,$new$'effectState','endureState','reversalState']$new$));
  execute definition;
end;
$migration$;

commit;
