begin;

-- Install source identities in the ordinary Master index and reserve their immutable version numbers.
create function app_private.index_runtime_item_source_v1(d jsonb)
returns void language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from app_private.combat_content_records where content_key=d->>'id' and content_kind<>'item') then raise exception using errcode='22023',message='ITEM_SOURCE_IDENTITY_CONFLICT'; end if;
 if exists(select 1 from app_private.combat_content_versions where content_key=d->>'id' and content_version=(d->>'contentVersion')::integer and definition is distinct from d) then raise exception using errcode='22023',message='ITEM_SOURCE_VERSION_CONFLICT'; end if;
 insert into app_private.combat_content_records(content_key,content_kind,lifecycle,version_floor,builtin_version,builtin_name)
 values(d->>'id','item','active',(d->>'contentVersion')::integer,(d->>'contentVersion')::integer,d->>'name')
 on conflict(content_key) do update set version_floor=greatest(combat_content_records.version_floor,excluded.version_floor),
 builtin_version=greatest(coalesce(combat_content_records.builtin_version,0),excluded.builtin_version),
 builtin_name=case when excluded.builtin_version>coalesce(combat_content_records.builtin_version,0) then excluded.builtin_name else combat_content_records.builtin_name end,
 revision=combat_content_records.revision+1
 where combat_content_records.version_floor<excluded.version_floor or coalesce(combat_content_records.builtin_version,0)<excluded.builtin_version;
end; $$;
revoke all on function app_private.index_runtime_item_source_v1(jsonb) from public,anon,authenticated,service_role;
do $source_index$
declare definition text; anchor text; d jsonb;
begin
 definition:=pg_get_functiondef('public.seed_runtime_item_sources_v1(jsonb)'::regprocedure);
 anchor:='  insert into app_private.runtime_item_source_definitions values(d->>''id'',(d->>''contentVersion'')::integer,d) on conflict do nothing;';
 if strpos(definition,anchor)=0 then raise exception 'ITEM_SOURCE_INDEX_PREDECESSOR'; end if;
 execute replace(definition,anchor,'  perform app_private.index_runtime_item_source_v1(d);'||chr(10)||anchor);
 for d in select source.definition from app_private.runtime_item_source_definitions source order by item_id,content_version loop
  perform app_private.index_runtime_item_source_v1(d);
 end loop;
end; $source_index$;
create function public.read_runtime_item_source_v1(p_item_id text,p_content_version integer)
returns jsonb language sql stable security definer set search_path='' as $$
 select definition from app_private.runtime_item_source_definitions where item_id=p_item_id and content_version=p_content_version;
$$;
revoke all on function public.read_runtime_item_source_v1(text,integer) from public,anon,authenticated;
grant execute on function public.read_runtime_item_source_v1(text,integer) to service_role;

-- Source versions participate in the same cached catalogue generation as publications.
-- Preserve the latest publication/archive filtering, ACL and timing behavior.
do $catalogue$
declare definition text; anchor text; addition text;
begin
 definition:=pg_get_functiondef('public.read_combat_content_catalogue_token_v1()'::regprocedure);
 anchor:='''policy'',public.read_combat_effect_timing_policy_v1()';
 if strpos(definition,anchor)=0 then raise exception 'ITEM_CATALOGUE_TOKEN_PREDECESSOR'; end if;
 addition:=$body$'runtimeItemVersions',(select coalesce(jsonb_agg(jsonb_build_array(item_id,content_version) order by item_id,content_version),'[]'::jsonb) from app_private.runtime_item_source_definitions),$body$;
 execute replace(definition,anchor,addition||anchor);
 definition:=pg_get_functiondef('public.read_combat_content_catalogue_v1()'::regprocedure);
 anchor:='''policy'',public.read_combat_effect_timing_policy_v1()';
 if strpos(definition,anchor)=0 then raise exception 'ITEM_CATALOGUE_SNAPSHOT_PREDECESSOR'; end if;
 addition:=$body$'runtimeItems',(select coalesce(jsonb_agg(d.definition order by d.item_id),'[]'::jsonb) from
 (select distinct on (item_id) item_id,definition from app_private.runtime_item_source_definitions s
 where not exists(select 1 from app_private.combat_content_publications p where p.content_key=s.item_id)
 and not exists(select 1 from app_private.combat_content_records r where r.content_key=s.item_id and (r.lifecycle='archived' or r.content_kind<>'item'))
 order by item_id,content_version desc) d),$body$;
 execute replace(definition,anchor,addition||anchor);
end; $catalogue$;

-- Owner-only view uses one publication/account lock generation, including unavailable stacks.
create function public.read_character_items_view_v1(p_user_id uuid,p_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare definitions jsonb; locked boolean;
begin
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);
 select coalesce(jsonb_object_agg(item_id,app_private.current_runtime_item_v1(item_id)),'{}'::jsonb) into definitions
 from (select distinct item_id from app_private.character_item_stacks where character_id=p_character_id) identities;
 select exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where (p.character_id=p_character_id or p.user_id=p_user_id) and b.lifecycle in ('pending','active')) into locked;
 return jsonb_build_object('snapshot',app_private.character_item_snapshot_v1(p_character_id),'definitions',definitions,
 'catalogueToken',md5(public.read_combat_content_catalogue_token_v1()||definitions::text),'battleLocked',locked);
end; $$;

-- The request token is fresh inside the same transaction as the mutation; TS preflight is UX only.
create function public.write_character_items_v1(p_user_id uuid,p_character_id uuid,p_expected_revision bigint,p_catalogue_token text,p_command jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare view jsonb; result jsonb;
begin
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,true);
 view:=public.read_character_items_view_v1(p_user_id,p_character_id);
 if p_catalogue_token is distinct from view->>'catalogueToken' then raise exception using errcode='40001',message='ITEM_STALE_CATALOGUE'; end if;
 if p_expected_revision is distinct from (view#>>'{snapshot,revision}')::bigint then raise exception using errcode='40001',message='ITEM_STALE_REVISION'; end if;
 if jsonb_typeof(p_command) is distinct from 'object' then raise exception using errcode='22023',message='ITEM_COMMAND_INVALID'; end if;
 if p_command->>'action'='equipment' and (p_command-'action'-'equipment'-'selectedSupport'-'replacePositions')='{}'::jsonb and jsonb_typeof(p_command->'replacePositions')='array' then
  result:=public.set_character_item_equipment_v1(p_user_id,p_character_id,p_expected_revision,p_command->'equipment',p_command->'selectedSupport',array(select jsonb_array_elements_text(p_command->'replacePositions')));
 elsif p_command->>'action'='sort' and (p_command-'action'-'category'-'stackIds')='{}'::jsonb and jsonb_typeof(p_command->'stackIds')='array' then
  perform public.sort_character_item_inventory_v1(p_user_id,p_character_id,p_expected_revision,p_command->>'category',array(select jsonb_array_elements_text(p_command->'stackIds'))::uuid[]);
  result:='{"notices":[]}'::jsonb;
 else raise exception using errcode='22023',message='ITEM_COMMAND_INVALID'; end if;
 return jsonb_build_object('state',public.read_character_items_view_v1(p_user_id,p_character_id),'notices',result->'notices');
end; $$;

-- Historical reads bypass current archive/enable state and return exact immutable media/definition.
create function public.read_runtime_item_version_v1(p_item_id text,p_content_version integer)
returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select definition from app_private.combat_content_versions where content_key=p_item_id and content_kind='item' and content_version=p_content_version),
 (select definition from app_private.runtime_item_source_definitions where item_id=p_item_id and content_version=p_content_version));
$$;

-- Retain the established Basic writer's replay/CAS/audit behavior while sharing inventory locks.
do $sync$
declare definition text; anchor text; replacement text;
begin
 definition:=pg_get_functiondef('public.save_character_support_action_v1(uuid,uuid,bigint,text,uuid,text)'::regprocedure);
 anchor:='  select * into v_build from app_private.character_active_builds build';
 if strpos(definition,anchor)=0 then raise exception 'ITEM_SUPPORT_WRITER_PREDECESSOR'; end if;
 replacement:=$body$  begin
   perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,true);
  exception when insufficient_privilege then
   if sqlerrm='ITEM_OWNERSHIP' then raise exception using errcode='P0001',message='CHARACTER_BUILD_NOT_FOUND'; else raise; end if;
  end;
$body$;
 definition:=replace(definition,anchor,replacement||anchor);
 anchor:='  v_before := v_build.support_action_id;';
 if strpos(definition,anchor)=0 then raise exception 'ITEM_SUPPORT_WRITER_PREDECESSOR'; end if;
 replacement:=$body$  update app_private.character_item_inventory set selected_support=jsonb_build_object('kind','basic','actionId',p_support_action_id),previous_basic_support=p_support_action_id,revision=revision+1 where character_id=p_character_id;
$body$;
 definition:=replace(definition,anchor,replacement||anchor);
 execute definition;
 definition:=pg_get_functiondef('public.set_character_item_equipment_v1(uuid,uuid,bigint,jsonb,jsonb,text[])'::regprocedure);
 anchor:='set build_version=build_version+1,updated_at=clock_timestamp()';
 if strpos(definition,anchor)=0 then raise exception 'ITEM_EQUIPMENT_WRITER_PREDECESSOR'; end if;
 definition:=replace(definition,anchor,'set support_action_id=case when next_support->>''kind''=''basic'' then next_support->>''actionId'' else support_action_id end,build_version=build_version+1,updated_at=clock_timestamp()');
 execute definition;
end; $sync$;

-- Test acquisition is restricted to the selected staff character, not an arbitrary player.
-- Reuse selected-character capability authority, immutable player-support audit and grant receipts.
create function public.grant_master_test_item_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_item_id text,p_quantity integer,p_expected_revision bigint,p_catalogue_token text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare before_view jsonb; result jsonb; after_view jsonb; request_hash text; prior app_private.player_support_audit%rowtype; d jsonb;
begin
 perform app_private.assert_master_panel_operator_v1(p_actor_user_id,p_actor_character_id);
 if p_actor_character_id is null or p_request_key is null or p_quantity is null or p_quantity not between 1 and 99 then raise exception using errcode='22023',message='ITEM_TEST_GRANT_INVALID'; end if;
 perform app_private.lock_character_item_inventory_v1(p_actor_user_id,p_actor_character_id,false);
 request_hash:=md5(jsonb_build_object('kind','item-test-grant','itemId',p_item_id,'quantity',p_quantity,'characterId',p_actor_character_id,'revision',p_expected_revision,'token',p_catalogue_token)::text);
 select * into prior from app_private.player_support_audit where actor_user_id=p_actor_user_id and request_key=p_request_key;
 if found then
  if prior.request_hash is distinct from request_hash then raise exception using errcode='22023',message='ITEM_GRANT_CONFLICT'; end if;
  return public.read_character_items_view_v1(p_actor_user_id,p_actor_character_id);
 end if;
 before_view:=public.read_character_items_view_v1(p_actor_user_id,p_actor_character_id);
 if p_catalogue_token is distinct from before_view->>'catalogueToken' then raise exception using errcode='40001',message='ITEM_STALE_CATALOGUE'; end if;
 d:=app_private.current_runtime_item_v1(p_item_id);
 if d is null or d->>'enabled' is distinct from 'true' or (d->>'inventoryCategory'='gear' and p_quantity<>1) then raise exception using errcode='22023',message='ITEM_TEST_GRANT_INVALID'; end if;
 result:=public.grant_character_items_v1(p_actor_user_id,p_actor_character_id,p_expected_revision,'staff-item:'||p_actor_user_id::text||':'||p_request_key::text,jsonb_build_array(jsonb_build_object('itemId',p_item_id,'quantity',p_quantity)));
 after_view:=public.read_character_items_view_v1(p_actor_user_id,p_actor_character_id);
 insert into app_private.player_support_audit(actor_user_id,actor_character_id,character_id,action,request_key,request_hash,before_facts,after_facts)
 values(p_actor_user_id,p_actor_character_id,p_actor_character_id,'player.edit',p_request_key,request_hash,
 jsonb_build_object('kind','item-test-grant','revision',before_view#>'{snapshot,revision}'),
 jsonb_build_object('kind','item-test-grant','itemId',p_item_id,'quantity',p_quantity,'contentVersion',d->'contentVersion','revision',after_view#>'{snapshot,revision}'));
 return after_view;
end; $$;

revoke all on function public.read_character_items_view_v1(uuid,uuid),public.write_character_items_v1(uuid,uuid,bigint,text,jsonb),public.read_runtime_item_version_v1(text,integer),public.grant_master_test_item_v1(uuid,uuid,text,integer,bigint,text,uuid) from public,anon,authenticated;
grant execute on function public.read_character_items_view_v1(uuid,uuid),public.write_character_items_v1(uuid,uuid,bigint,text,jsonb),public.read_runtime_item_version_v1(text,integer),public.grant_master_test_item_v1(uuid,uuid,text,integer,bigint,text,uuid) to service_role;
commit;
