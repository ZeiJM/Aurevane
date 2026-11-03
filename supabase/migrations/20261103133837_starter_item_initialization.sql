begin;

-- Trusted source startup only. Definitions still enter the shared immutable source
-- index/version-floor authority; grants still use the bounded atomic inventory writer.
-- A durable receipt is final even when its original source is later disabled/archived.
create function public.prepare_character_starter_items_v1(
 p_user_id uuid,p_character_id uuid,p_definitions jsonb,p_grant_key text,p_items jsonb
) returns jsonb language plpgsql security definer set search_path='' as $$
declare view jsonb; available jsonb; revision bigint; notice text;
begin
 if not exists(select 1 from public.characters where id=p_character_id and user_id=p_user_id) then
  raise exception using errcode='42501',message='ITEM_OWNERSHIP'; end if;
 if exists(select 1 from app_private.character_item_grants where character_id=p_character_id and grant_key=p_grant_key) then
  return public.read_character_items_view_v1(p_user_id,p_character_id); end if;
 -- A read inside a battle must neither mutate ownership nor complete an unperformed grant.
 if exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id
   where (p.character_id=p_character_id or p.user_id=p_user_id) and b.lifecycle in ('pending','active')) then
  return public.read_character_items_view_v1(p_user_id,p_character_id)||jsonb_build_object('starterNotice','starter-items-deferred-battle'); end if;
 -- Catalogue first, then account/character/build/inventory. Never upgrade a shared
 -- catalogue lock while holding account/row locks. Concurrent first loads serialize here.
 perform public.seed_runtime_item_sources_v1(p_definitions);
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);
 if exists(select 1 from app_private.character_item_grants where character_id=p_character_id and grant_key=p_grant_key) then
  return public.read_character_items_view_v1(p_user_id,p_character_id); end if;
 view:=public.read_character_items_view_v1(p_user_id,p_character_id);
 if (view->>'battleLocked')::boolean then
  return view||jsonb_build_object('starterNotice','starter-items-deferred-battle'); end if;
 if p_grant_key is null or char_length(p_grant_key) not between 1 and 160 or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 240 then
  raise exception using errcode='22023',message='ITEM_GRANT_INVALID'; end if;
 select coalesce(jsonb_agg(g.value order by g.ordinality),'[]'::jsonb) into available
 from jsonb_array_elements(p_items) with ordinality g
 where app_private.available_runtime_item_v1(g.value->>'itemId')->'enabled'='true'::jsonb;
 if jsonb_array_length(available)=0 then
  return view||jsonb_build_object('starterNotice','starter-items-unavailable'); end if;
 revision:=(view#>>'{snapshot,revision}')::bigint;
 begin
  perform public.grant_character_items_v1(p_user_id,p_character_id,revision,p_grant_key,available);
 exception when sqlstate '22023' then
  if sqlerrm='ITEM_CAPACITY' then notice:='starter-items-deferred-capacity'; else raise; end if;
 end;
 return public.read_character_items_view_v1(p_user_id,p_character_id)||
  case when notice is null then '{}'::jsonb else jsonb_build_object('starterNotice',notice) end;
end; $$;
revoke all on function public.prepare_character_starter_items_v1(uuid,uuid,jsonb,text,jsonb) from public,anon,authenticated;
grant execute on function public.prepare_character_starter_items_v1(uuid,uuid,jsonb,text,jsonb) to service_role;
commit;
