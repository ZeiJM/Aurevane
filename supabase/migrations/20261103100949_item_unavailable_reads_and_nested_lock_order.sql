begin;

-- Absence is expected in read projections of retained owned stacks. Keep the
-- strict helper unchanged for grants, equipment validation and admission.
create function app_private.available_runtime_item_v1(p_item_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 return app_private.current_runtime_item_v1(p_item_id);
exception when sqlstate '22023' then
 if sqlerrm='ITEM_DEFINITION_UNAVAILABLE' then return null; end if;
 raise;
end; $$;
revoke all on function app_private.available_runtime_item_v1(text) from public,anon,authenticated,service_role;

create or replace function public.read_current_runtime_item_v1(p_item_id text)
returns jsonb language sql stable security definer set search_path='' as $$
 select app_private.available_runtime_item_v1(p_item_id);
$$;
revoke all on function public.read_current_runtime_item_v1(text) from public,anon,authenticated;
grant execute on function public.read_current_runtime_item_v1(text) to service_role;

do $read_projection$
declare definition text; anchor text;
begin
 definition:=pg_get_functiondef('public.read_character_items_view_v1(uuid,uuid)'::regprocedure);
 anchor:='app_private.current_runtime_item_v1(item_id)';
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'ITEM_AVAILABLE_READ_PREDECESSOR'; end if;
 execute replace(definition,anchor,'app_private.available_runtime_item_v1(item_id)');
end; $read_projection$;

-- A saved-loadout activation may call the Basic Support writer. Acquire that
-- writer's outer locks before the activation's first build row lock, including
-- on replay, so nested writers cannot invert account -> character -> build.
-- false keeps battle eligibility in the actual mutation path and preserves replay.
do $activation_order$
declare definition text; anchor text; addition text;
begin
 definition:=pg_get_functiondef('public.activate_character_build_loadout_v1(uuid,uuid,smallint,bigint,uuid,text)'::regprocedure);
 anchor:=E'  select *\n  into v_build\n  from app_private.character_active_builds build';
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'ITEM_ACTIVATION_LOCK_PREDECESSOR'; end if;
 addition:=$body$  begin
   perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);
  exception when insufficient_privilege then
   if sqlerrm='ITEM_OWNERSHIP' then raise exception using errcode='P0001',message='CHARACTER_BUILD_NOT_FOUND'; else raise; end if;
  end;
$body$;
 execute replace(definition,anchor,addition||anchor);
end; $activation_order$;

-- Master player edit also nests Basic Support. Its existing World admission
-- and row locks are nonblocking. Acquire catalogue/account first with the same
-- retry policy, before World and either target row; never wait on an outer lock
-- while retaining an inner lock. Existing actor checks/CAS/receipts stay intact.
do $master_order$
declare definition text; anchor text; addition text;
begin
 definition:=pg_get_functiondef('public.edit_master_player_v1(uuid,uuid,text,uuid,jsonb,boolean,uuid)'::regprocedure);
 anchor:=$body$ if not pg_try_advisory_xact_lock(hashtextextended(v_character.user_id::text,1)) then raise exception using errcode='PT409',message='PLAYER_EDIT_RETRY'; end if;$body$;
 if length(definition)-length(replace(definition,anchor,''))<>length(anchor) then raise exception 'ITEM_MASTER_EDIT_LOCK_PREDECESSOR'; end if;
 addition:=$body$ if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0)) then raise exception using errcode='PT409',message='PLAYER_EDIT_RETRY'; end if;
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(v_character.user_id::text,0)) then raise exception using errcode='PT409',message='PLAYER_EDIT_RETRY'; end if;
$body$;
 execute replace(definition,anchor,addition||anchor);
end; $master_order$;

commit;
