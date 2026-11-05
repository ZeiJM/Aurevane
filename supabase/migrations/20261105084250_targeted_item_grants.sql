begin;

-- Arbitrary recipients are a protected Owner operation. Existing staff self-test
-- acquisition retains its separate authority and endpoint unchanged.
create function app_private.assert_master_item_grant_owner_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
begin
 if not exists(select 1 from app_private.master_panel_role_assignments a where a.user_id=p_actor_user_id and a.role='game-owner' and a.enabled)
 or not exists(select 1 from public.characters c where c.id=p_actor_character_id and c.user_id=p_actor_user_id)
 or exists(select 1 from app_private.account_deletion_requests d where d.user_id=p_actor_user_id)
 or exists(select 1 from app_private.character_deletion_requests d where d.character_id=p_actor_character_id) then
  raise exception using errcode='42501',message='MASTER_ITEM_GRANT_OWNER_REQUIRED';
 end if;
end; $$;
revoke all on function app_private.assert_master_item_grant_owner_v1(uuid,uuid) from public,anon,authenticated,service_role;

create function public.search_master_item_grant_characters_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_query text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare query text:=btrim(p_query); result jsonb;
begin
 perform app_private.assert_master_item_grant_owner_v1(p_actor_user_id,p_actor_character_id);
 if query is null or char_length(query) not between 2 and 80 then raise exception using errcode='22023',message='ITEM_GRANT_SEARCH_INVALID'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('characterId',c.id,'name',c.name) order by lower(c.name),c.id),'[]'::jsonb) into result
 from (select c.id,c.name from public.characters c
  where strpos(lower(c.name),lower(query))>0
  and not exists(select 1 from app_private.character_deletion_requests d where d.character_id=c.id)
  and not exists(select 1 from app_private.account_deletion_requests d where d.user_id=c.user_id)
  order by lower(c.name),c.id limit 20) c;
 return jsonb_build_object('characters',result);
end; $$;

-- The owner identity is derived here, then revalidated under the canonical
-- catalogue/account/character/build/inventory locks, including deletion guards.
create function public.read_master_item_grant_target_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_user_id uuid; target_name text; view jsonb;
begin
 perform app_private.assert_master_item_grant_owner_v1(p_actor_user_id,p_actor_character_id);
 select c.user_id into target_user_id from public.characters c where c.id=p_character_id;
 if not found then raise exception using errcode='22023',message='ITEM_GRANT_TARGET_UNAVAILABLE'; end if;
 view:=public.read_character_items_view_v1(target_user_id,p_character_id);
 select c.name into target_name from public.characters c where c.id=p_character_id and c.user_id=target_user_id;
 return jsonb_build_object('target',jsonb_build_object('characterId',p_character_id,'name',target_name),
  'revision',view#>'{snapshot,revision}','catalogueToken',view->'catalogueToken','battleLocked',view->'battleLocked');
end; $$;

create function public.grant_master_item_to_character_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_character_id uuid,p_item_id text,p_quantity integer,p_expected_revision bigint,p_catalogue_token text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare target_user_id uuid; before_view jsonb; after_view jsonb; request_hash text; prior app_private.player_support_audit%rowtype; d jsonb;
begin
 perform app_private.assert_master_item_grant_owner_v1(p_actor_user_id,p_actor_character_id);
 if p_request_key is null or p_quantity is null or p_quantity not between 1 and 99 then raise exception using errcode='22023',message='ITEM_TEST_GRANT_INVALID'; end if;
 -- Serialize this receipt across different recipients, without taking a second
 -- account inventory lock or changing the canonical recipient lock order.
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('master-item-grant:'||p_actor_user_id::text||':'||p_request_key::text,0)) then
  raise exception using errcode='PT409',message='ITEM_GRANT_RETRY';
 end if;
 select c.user_id into target_user_id from public.characters c where c.id=p_character_id;
 if not found then raise exception using errcode='22023',message='ITEM_GRANT_TARGET_UNAVAILABLE'; end if;
 perform app_private.lock_character_item_inventory_v1(target_user_id,p_character_id,false);
 request_hash:=md5(jsonb_build_object('kind','item-target-grant','actorCharacterId',p_actor_character_id,'characterId',p_character_id,'itemId',p_item_id,'quantity',p_quantity,'revision',p_expected_revision,'token',p_catalogue_token)::text);
 select * into prior from app_private.player_support_audit where actor_user_id=p_actor_user_id and request_key=p_request_key;
 if found then
  if prior.request_hash is distinct from request_hash then raise exception using errcode='22023',message='ITEM_GRANT_CONFLICT'; end if;
  after_view:=public.read_master_item_grant_target_v1(p_actor_user_id,p_actor_character_id,p_character_id);
  return after_view-'catalogueToken'-'battleLocked';
 end if;
 before_view:=public.read_master_item_grant_target_v1(p_actor_user_id,p_actor_character_id,p_character_id);
 if p_catalogue_token is distinct from before_view->>'catalogueToken' then raise exception using errcode='PT409',message='ITEM_STALE_CATALOGUE'; end if;
 d:=app_private.current_runtime_item_v1(p_item_id);
 if d is null or d->>'enabled' is distinct from 'true' or (d->>'inventoryCategory'='gear' and p_quantity<>1) then raise exception using errcode='22023',message='ITEM_TEST_GRANT_INVALID'; end if;
 perform public.grant_character_items_v1(target_user_id,p_character_id,p_expected_revision,'owner-item:'||p_actor_user_id::text||':'||p_request_key::text,jsonb_build_array(jsonb_build_object('itemId',p_item_id,'quantity',p_quantity)));
 after_view:=public.read_master_item_grant_target_v1(p_actor_user_id,p_actor_character_id,p_character_id);
 insert into app_private.player_support_audit(actor_user_id,actor_character_id,character_id,action,request_key,request_hash,before_facts,after_facts)
 values(p_actor_user_id,p_actor_character_id,p_character_id,'player.edit',p_request_key,request_hash,
 jsonb_build_object('kind','item-target-grant','revision',before_view->'revision'),
 jsonb_build_object('kind','item-target-grant','itemId',p_item_id,'quantity',p_quantity,'contentVersion',d->'contentVersion','revision',after_view->'revision'));
 return after_view-'catalogueToken'-'battleLocked';
end; $$;

revoke all on function public.search_master_item_grant_characters_v1(uuid,uuid,text),public.read_master_item_grant_target_v1(uuid,uuid,uuid),public.grant_master_item_to_character_v1(uuid,uuid,uuid,text,integer,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.search_master_item_grant_characters_v1(uuid,uuid,text),public.read_master_item_grant_target_v1(uuid,uuid,uuid),public.grant_master_item_to_character_v1(uuid,uuid,uuid,text,integer,bigint,text,uuid) to service_role;
commit;
