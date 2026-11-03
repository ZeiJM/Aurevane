-- Disposable local database fixtures. These functions invoke the installed public
-- authorities; no admission, inventory, or loadout function is replaced.
create schema item_race;
create table item_race.contexts(label text primary key, mode text, owner_id uuid, other_id uuid, character_id uuid, target_id uuid, lobby_id uuid, request_id uuid, initial_snapshot jsonb, participants jsonb, versions jsonb, inventory_revision bigint, build_version bigint);
create function item_race.setup(p_label text,p_mode text) returns void language plpgsql as $$
declare a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); l uuid; k text; inv jsonb; build_a jsonb; build_b jsonb; snap jsonb; parts jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at) values(a,a::text||'@items.test',now()),(b,b::text||'@items.test',now());
 insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
 values(c,a,0,1,'Race A',c::text,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()),(d,b,0,1,'Race B',d::text,'default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());
 insert into app_private.master_panel_character_access(character_id,user_id,roles,updated_by) values(c,a,array['content-staff'],a);
 perform public.read_character_item_inventory_v1(a,c);
 perform public.read_character_item_inventory_v1(b,d);
 if p_mode<>'grant' then
  perform public.grant_character_items_v1(a,c,0,'race-initial','[{"itemId":"test.race.helm","quantity":1}]');
  inv:=public.read_character_item_inventory_v1(a,c);
  perform public.set_character_item_equipment_v1(a,c,1,jsonb_build_object('head',inv#>>'{stacks,0,id}'),'{"kind":"basic","actionId":"basic.recover"}',array[]::text[]);
 end if;
 if p_mode='loadout' then
  build_a:=public.get_character_committed_build_snapshot_v2(a,c);
  perform public.save_character_build_loadout_v1(a,c,1::smallint,'Recovery',(build_a->>'buildVersion')::bigint,gen_random_uuid(),'race-save');
  perform public.save_character_support_action_v1(a,c,(build_a->>'buildVersion')::bigint,'basic.pilfer',gen_random_uuid(),'race-pilfer');
 end if;
 build_a:=public.get_character_committed_build_snapshot_v2(a,c);
 build_b:=public.get_character_committed_build_snapshot_v2(b,d);
 build_a:=build_a||jsonb_build_object('combatantId','character:'||c,'characterId',c,'extensions',coalesce(build_a->'extensions','{}')||jsonb_build_object('equipmentSkills',jsonb_build_array(public.read_character_battle_equipment_v1(a,c))));
 build_b:=build_b||jsonb_build_object('combatantId','character:'||d,'characterId',d,'extensions',coalesce(build_b->'extensions','{}')||jsonb_build_object('equipmentSkills',jsonb_build_array(public.read_character_battle_equipment_v1(b,d))));
 snap:=jsonb_build_object('tactical',jsonb_build_object('battle',jsonb_build_object('battleId','items-race:'||p_label,'rulesVersion',1,'contentVersion',1,'lifecycle','active','rng',jsonb_build_object('algorithm','xorshift32-v1','seed',7,'state',7,'draws',0),'currentTurn',jsonb_build_object('combatantId','character:'||c),'combatants',jsonb_build_array(jsonb_build_object('id','character:'||c,'teamId','team:0'),jsonb_build_object('id','character:'||d,'teamId','team:1')))),'buildAuthority',jsonb_build_object('combatants',jsonb_build_array(build_a,build_b)));
 parts:=jsonb_build_array(jsonb_build_object('team_index',0,'user_id',a,'character_id',c,'combatant_id','character:'||c,'participant_role','player'),jsonb_build_object('team_index',1,'user_id',b,'character_id',case when p_mode='pve' then null else d end,'combatant_id','character:'||d,'participant_role',case when p_mode='pve' then 'opponent' else 'player' end));
 if p_mode='pvp' then
  l:=public.create_pvp_lobby_v1(a,c,'1v1',null,null);
  select lobby_key into k from app_private.pvp_lobbies where id=l;
  perform public.join_pvp_lobby_v1(b,d,k);
  perform public.set_pvp_lobby_ready_v1(a,l,true);
  perform public.set_pvp_lobby_ready_v1(b,l,true);
 end if;
 if p_mode='world' then
  perform public.read_world_state_v1(a,c,'{"version":1,"position":{"sectorId":"verdant-expanse","x":5,"y":4},"safe":false,"route":[],"nextStepAt":null,"discoveries":{},"completedObjectives":[]}');
  perform public.read_world_state_v1(b,d,'{"version":1,"position":{"sectorId":"verdant-expanse","x":6,"y":4},"safe":false,"route":[],"nextStepAt":null,"discoveries":{},"completedObjectives":[]}');
 end if;
 inv:=public.read_character_item_inventory_v1(a,c);
 insert into item_race.contexts values(p_label,p_mode,a,b,c,d,l,gen_random_uuid(),snap,parts,jsonb_build_object(c::text,build_a->'buildVersion',d::text,build_b->'buildVersion'),(inv->>'revision')::bigint,(build_a->>'buildVersion')::bigint);
end; $$;
create function item_race.admit(p_label text) returns jsonb language plpgsql as $$
declare c item_race.contexts%rowtype; r jsonb; journal jsonb:='{"schemaVersion":1,"commandVisibility":{"kind":"public"},"eventVisibilityOverrides":[]}';
begin
 select * into strict c from item_race.contexts where label=p_label;
 if c.mode='pve' then
  select to_jsonb(x) into r from public.create_battle_session_v2(c.owner_id::text,c.request_id,p_label,c.owner_id,'items-race:'||p_label,1,1,c.initial_snapshot,c.participants,c.initial_snapshot,'[]',journal) x;
 elsif c.mode='pvp' then
  select to_jsonb(x) into r from public.create_pvp_battle_session_v2(c.owner_id,c.lobby_id,'items-race:'||p_label,1,1,c.initial_snapshot,c.participants,c.initial_snapshot,'[]',journal) x;
 elsif c.mode='world' then
  r:=public.start_world_encounter_v2(c.owner_id,c.character_id,c.target_id,1,1,c.initial_snapshot,c.versions,c.initial_snapshot,'[]',journal);
 else raise exception 'unknown fixture mode'; end if;
 return r;
end; $$;
create function item_race.equip(p_label text) returns jsonb language plpgsql as $$
declare c item_race.contexts%rowtype;
begin
 select * into strict c from item_race.contexts where label=p_label;
 return public.set_character_item_equipment_v1(c.owner_id,c.character_id,c.inventory_revision,'{}','{"kind":"basic","actionId":"basic.recover"}',array['head']);
end; $$;
create function item_race.grant_item(p_label text,p_key text) returns jsonb language plpgsql as $$
declare c item_race.contexts%rowtype;
begin
 select * into strict c from item_race.contexts where label=p_label;
 return public.grant_character_items_v1(c.owner_id,c.character_id,c.inventory_revision,p_key,'[{"itemId":"test.race.helm","quantity":1}]');
end; $$;
create function item_race.read_item(p_label text) returns jsonb language plpgsql as $$
declare c item_race.contexts%rowtype;
begin select * into strict c from item_race.contexts where label=p_label;
 return public.read_character_item_inventory_v1(c.owner_id,c.character_id); end; $$;
create function item_race.activate(p_label text) returns jsonb language plpgsql as $$
declare c item_race.contexts%rowtype; r jsonb;
begin select * into strict c from item_race.contexts where label=p_label;
 select to_jsonb(x) into r from public.activate_character_build_loadout_v1(c.owner_id,c.character_id,1::smallint,c.build_version,c.request_id,'item-race:'||p_label) x; return r; end; $$;
-- Use a different source identity per schedule so archive/disable races cannot
-- contaminate other cases. The new startup wrapper itself owns seed and grant.
create function item_race.starter_source(p_label text) returns jsonb language sql as $$
 select public.read_runtime_item_source_v1('test.race.helm',1)||jsonb_build_object('id','test.race.starter.'||p_label);
$$;
create function item_race.prepare_starter(p_label text) returns jsonb language plpgsql as $$
declare c item_race.contexts%rowtype; d jsonb:=item_race.starter_source(p_label);
begin
 select * into strict c from item_race.contexts where label=p_label;
 return public.prepare_character_starter_items_v1(c.owner_id,c.character_id,jsonb_build_array(d),'race-starter',jsonb_build_array(jsonb_build_object('itemId',d->>'id','quantity',1)));
end; $$;
create function item_race.archive_starter(p_label text) returns jsonb language plpgsql as $$
declare c item_race.contexts%rowtype; d jsonb:=item_race.starter_source(p_label); r jsonb;
begin
 select * into strict c from item_race.contexts where label=p_label;
 perform public.seed_runtime_item_sources_v1(jsonb_build_array(d));
 r:=public.read_combat_content_record_v1(c.owner_id,c.character_id,d->>'id');
 return public.write_combat_content_record_v1(c.owner_id,c.character_id,d->>'id',jsonb_build_object('action','archive','expectedRevision',r->'revision'));
end; $$;
create function item_race.disable_starter(p_label text) returns void language plpgsql as $$
begin
 perform public.seed_runtime_item_sources_v1(jsonb_build_array(item_race.starter_source(p_label)||'{"contentVersion":2,"enabled":false}'::jsonb));
end; $$;
grant usage on schema item_race to service_role;
grant select on item_race.contexts to service_role;
grant execute on all functions in schema item_race to service_role;
select public.seed_runtime_item_sources_v1('[{"schemaVersion":2,"id":"test.race.helm","contentVersion":1,"name":"Race Helm","description":"Native authority fixture.","sortOrder":0,"enabled":true,"media":{"artworkId":"test.helm.art"},"inventoryCategory":"gear","itemClass":"armor","tier":"D","qualityPoints":10,"equipment":{"slot":"head","hands":1},"maximumStack":1,"requirements":null,"ability":null,"battleUses":null,"consumeOnUse":false,"tags":[]}]');
