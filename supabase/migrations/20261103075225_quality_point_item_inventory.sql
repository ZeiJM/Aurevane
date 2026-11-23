begin;

-- Full source definitions are the trusted runtime catalogue fallback, never a second QP table.
-- No samples are installed here. The source-content release supplies its genuine definitions.
create table app_private.runtime_item_source_definitions (
  item_id text not null,
  content_version integer not null check(content_version>0),
  definition jsonb not null check(jsonb_typeof(definition)='object'),
  primary key(item_id,content_version),
  check(definition->>'id'=item_id and (definition->>'contentVersion')::integer=content_version)
);
create table app_private.character_item_inventory (
  character_id uuid primary key references public.characters(id) on delete cascade,
  revision bigint not null default 0 check(revision between 0 and 9007199254740991),
  equipment jsonb not null default '{}' check(jsonb_typeof(equipment)='object'),
  selected_support jsonb not null default '{"kind":"basic","actionId":"basic.recover"}' check(jsonb_typeof(selected_support)='object'),
  previous_basic_support text not null default 'basic.recover' check(previous_basic_support in ('basic.recover','basic.recover.mp','basic.pilfer','basic.fleetstep','basic.invocation'))
);
create table app_private.character_item_stacks (
  id uuid primary key default gen_random_uuid(),
  character_id uuid not null references public.characters(id) on delete cascade,
  item_id text not null,
  inventory_category text not null check(inventory_category in ('gear','battle-items','materials','general','event','companion')),
  slot_index smallint not null check(slot_index between 0 and 39),
  quantity smallint not null check(quantity between 1 and 99),
  acquired_at timestamptz not null default clock_timestamp(),
  acquired_content_version integer not null check(acquired_content_version>0),
  provenance text not null check(char_length(provenance) between 1 and 160),
  check(inventory_category<>'gear' or quantity=1),
  constraint character_item_category_slot unique(character_id,inventory_category,slot_index) deferrable initially immediate
);
create index character_item_stacks_identity on app_private.character_item_stacks(item_id,quantity);
create table app_private.character_item_grants (
  character_id uuid not null references public.characters(id) on delete cascade,
  grant_key text not null check(char_length(grant_key) between 1 and 160),
  items jsonb not null check(jsonb_typeof(items)='array'),
  granted_at timestamptz not null default clock_timestamp(),
  primary key(character_id,grant_key)
);

alter table app_private.runtime_item_source_definitions enable row level security;
alter table app_private.character_item_inventory enable row level security;
alter table app_private.character_item_stacks enable row level security;
alter table app_private.character_item_grants enable row level security;
revoke all on table app_private.runtime_item_source_definitions,app_private.character_item_inventory,app_private.character_item_stacks,app_private.character_item_grants from public,anon,authenticated,service_role;
-- Read and writes go through owner-checked service functions; no raw browser or service writes.

create function app_private.current_runtime_item_v1(p_item_id text)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare d jsonb;
begin
 if exists(select 1 from app_private.combat_content_records where content_key=p_item_id and (content_kind<>'item' or lifecycle='archived')) then
  raise exception using errcode='22023',message='ITEM_DEFINITION_UNAVAILABLE'; end if;
 select v.definition into d from app_private.combat_content_publications p join app_private.combat_content_versions v on v.id=p.version_id where p.content_key=p_item_id and p.content_kind='item';
 if not found then select definition into d from app_private.runtime_item_source_definitions where item_id=p_item_id order by content_version desc limit 1; end if;
 if d is null or d->>'schemaVersion' is distinct from '2' then raise exception using errcode='22023',message='ITEM_DEFINITION_UNAVAILABLE'; end if;
 return d;
end; $$;

-- SQL checks inventory shape/QP/slots; the canonical TypeScript parser validates AbilityDefinition.
create function app_private.assert_runtime_item_shape_v1(d jsonb)
returns void language plpgsql immutable set search_path='' as $$
declare c text:=d->>'itemClass'; category text:=d->>'inventoryCategory'; e jsonb:=d->'equipment'; role record; behavior jsonb; seen text[]:='{}';
begin
 if jsonb_typeof(d) is distinct from 'object' then raise exception using errcode='22023',message='ITEM_DEFINITION_INVALID'; end if;
 if exists(select 1 from jsonb_object_keys(d) k where k not in ('schemaVersion','id','contentVersion','name','description','sortOrder','enabled','media','inventoryCategory','itemClass','tier','qualityPoints','equipment','maximumStack','requirements','ability','actions','battleUses','consumeOnUse','tags'))
 or not d ?& array['schemaVersion','id','contentVersion','name','description','sortOrder','enabled','media','inventoryCategory','itemClass','tier','qualityPoints','equipment','maximumStack','requirements','ability','battleUses','consumeOnUse','tags']
 or jsonb_typeof(d->'contentVersion') is distinct from 'number' or (d->>'contentVersion')::numeric>2147483647
 or jsonb_typeof(d->'sortOrder') is distinct from 'number' or (d->>'sortOrder') !~ '^[0-9]+$' or (d->>'sortOrder')::numeric>1000000
 or jsonb_typeof(d->'tier') is distinct from 'string' or d->>'tier' not in ('D','C','B','A','S') then raise exception using errcode='22023',message='ITEM_DEFINITION_INVALID'; end if;
 for role in select * from (values('name',120),('description',4000)) as fields(key,maximum) loop
  if jsonb_typeof(d->role.key) is distinct from 'string' or char_length(d->>role.key) not between 1 and role.maximum or d->>role.key<>btrim(d->>role.key) or (d->>role.key)~'[[:cntrl:]]' then raise exception using errcode='22023',message='ITEM_DEFINITION_INVALID'; end if;
 end loop;
 if jsonb_typeof(d->'media') is distinct from 'object' then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
 if not ((d->'media'?'artworkId') or (d->'media'?'artwork')) or exists(select 1 from jsonb_each(d->'media') m where m.key not in ('artworkId','artwork') or (m.key='artworkId' and (jsonb_typeof(m.value) is distinct from 'string' or (m.value#>>'{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$')) or (m.key='artwork' and (jsonb_typeof(m.value) is distinct from 'object' or m.value->>'kind' is distinct from 'image'))) then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
 if jsonb_typeof(d->'tags') is distinct from 'array' then raise exception using errcode='22023',message='ITEM_TAGS_INVALID'; end if;
 if jsonb_array_length(d->'tags')>32 or (select count(distinct value) from jsonb_array_elements(d->'tags'))<>jsonb_array_length(d->'tags') or exists(select 1 from jsonb_array_elements(d->'tags') t where jsonb_typeof(t)<>'string' or char_length(t#>>'{}')>160 or (t#>>'{}') !~ '^[a-z0-9]+([._-][a-z0-9]+)*$') then raise exception using errcode='22023',message='ITEM_TAGS_INVALID'; end if;
 if d->'ability' is distinct from 'null'::jsonb then
  if jsonb_typeof(d->'ability') is distinct from 'object' or d->'ability'->>'schemaVersion' is distinct from '1' or jsonb_typeof(d->'ability'->'behaviors') is distinct from 'array' then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
  if jsonb_array_length(d->'ability'->'behaviors') not between 1 and 16 then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
 end if;
 if jsonb_typeof(d) is distinct from 'object' or d->>'schemaVersion' is distinct from '2' or d->>'id' is null or d->>'id' !~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
 or (d->>'contentVersion') !~ '^[1-9][0-9]*$' or jsonb_typeof(d->'enabled') is distinct from 'boolean'
 or d->'requirements' is distinct from 'null'::jsonb or d->'consumeOnUse' is distinct from 'false'::jsonb
 or category is null or c is null or category is distinct from (case c when 'armor' then 'gear' when 'hand-armor' then 'gear' when 'weapon' then 'gear' when 'battle-item' then 'battle-items' when 'material' then 'materials' when 'general' then 'general' when 'event' then 'event' when 'companion' then 'companion' else null end)
 or jsonb_typeof(d->'qualityPoints') is distinct from 'number' or (d->>'qualityPoints') !~ '^[0-9]+$'
 or jsonb_typeof(d->'maximumStack') is distinct from 'number' or (d->>'maximumStack') !~ '^[1-9][0-9]*$'
 or (d->>'maximumStack')::numeric>(case when category='gear' then 1 else 99 end) then
  raise exception using errcode='22023',message='ITEM_DEFINITION_INVALID'; end if;
 if c in ('armor','hand-armor','weapon','battle-item') then
  if (d->>'qualityPoints')::numeric not between 1 and 100 or jsonb_typeof(e) is distinct from 'object' or (e-'slot'-'hands')<>'{}'::jsonb or jsonb_typeof(e->'hands') is distinct from 'number' or e->>'hands' is null or e->>'hands' not in ('1','2')
  or (c='armor' and (e->>'slot' is null or e->>'slot' not in ('head','body','pants','boots') or e->>'hands'<>'1'))
  or (c<>'armor' and e->>'slot' is distinct from 'hand') or (e->>'hands'='2' and c<>'weapon') then
   raise exception using errcode='22023',message='ITEM_DEFINITION_INVALID'; end if;
 elsif (d->>'qualityPoints')::numeric<>0 or e is distinct from 'null'::jsonb or d->'ability' is distinct from 'null'::jsonb then
  raise exception using errcode='22023',message='ITEM_DEFINITION_INVALID'; end if;
 if jsonb_typeof(d->'actions') is distinct from 'object' and d ? 'actions' then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
 for role in select * from jsonb_each(coalesce(d->'actions','{}')) loop
  if role.key not in ('attack','support','use') or jsonb_typeof(role.value) is distinct from 'object' or (role.value-'behaviorId'-'name')<>'{}'::jsonb or role.value->>'behaviorId' is null or jsonb_typeof(role.value->'name') is distinct from 'string' or char_length(btrim(role.value->>'name')) not between 1 and 120 or role.value->>'behaviorId'=any(seen) then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
  select value into behavior from jsonb_array_elements(coalesce(d->'ability'->'behaviors','[]'::jsonb)) where value->>'id'=role.value->>'behaviorId';
  if behavior is null or behavior->>'activation' is distinct from 'manual' or behavior->>'mode' is distinct from 'action' then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
  seen:=array_append(seen,role.value->>'behaviorId');
  if (role.key='attack' and c<>'weapon') or (role.key='use' and c<>'battle-item') then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(coalesce(d->'ability'->'behaviors','[]'::jsonb)) b where b->>'activation'='manual' and not (b->>'id'=any(seen))) then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
 if c='weapon' and d->'actions'->'attack' is null then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
 if c='battle-item' then
  if d->'actions'->'use' is null or jsonb_array_length(d->'ability'->'behaviors') is distinct from 1 or cardinality(seen)<>1 or (d->>'battleUses') is null or (d->>'battleUses') !~ '^[1-9][0-9]*$' or (d->>'battleUses')::numeric>99 then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
 elsif d->'battleUses' is distinct from 'null'::jsonb then raise exception using errcode='22023',message='ITEM_BINDING_INVALID'; end if;
end; $$;

create function app_private.assert_runtime_item_identity_v1(d jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare prior jsonb;
begin
 perform app_private.assert_runtime_item_shape_v1(d);
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('runtime-item:'||(d->>'id'),0));
 for prior in select definition from app_private.runtime_item_source_definitions where item_id=d->>'id'
 union all select definition from app_private.combat_content_versions where content_key=d->>'id' and content_kind='item' and definition->>'schemaVersion'='2' loop
  if prior->>'inventoryCategory' is distinct from d->>'inventoryCategory' or (prior->>'inventoryCategory'='gear') is distinct from (d->>'inventoryCategory'='gear') then raise exception using errcode='22023',message='ITEM_IDENTITY_SHAPE'; end if;
 end loop;
 if exists(select 1 from app_private.character_item_stacks where item_id=d->>'id' and quantity>(d->>'maximumStack')::integer) then raise exception using errcode='22023',message='ITEM_STACK_SHAPE'; end if;
end; $$;

create function public.seed_runtime_item_sources_v1(p_definitions jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare d jsonb; existing jsonb; media_reference record;
begin
 if jsonb_typeof(p_definitions) is distinct from 'array' or jsonb_array_length(p_definitions)>240 then raise exception using errcode='22023',message='ITEM_SOURCE_INVALID'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combat-catalogue-publication',0));
 for d in select value from jsonb_array_elements(p_definitions) order by value->>'id' loop
  perform app_private.assert_runtime_item_identity_v1(d);
  for media_reference in select * from app_private.content_media_references_v1(d) loop
   if media_reference.slot <> 'artwork' or not exists(select 1 from app_private.combat_content_media where descriptor=media_reference.reference and descriptor->>'kind'='image') then raise exception using errcode='22023',message='ITEM_MEDIA_INVALID'; end if;
  end loop;
  select definition into existing from app_private.runtime_item_source_definitions where item_id=d->>'id' and content_version=(d->>'contentVersion')::integer;
  if found and existing is distinct from d then raise exception using errcode='22023',message='ITEM_SOURCE_CONFLICT'; end if;
  insert into app_private.runtime_item_source_definitions values(d->>'id',(d->>'contentVersion')::integer,d) on conflict do nothing;
 end loop;
end; $$;

-- Pointer changes include ordinary Commit and version rollback. History bodies are untouched.
create function app_private.guard_runtime_item_publication_v1()
returns trigger language plpgsql security definer set search_path='' as $$
declare d jsonb;
begin
 if new.content_kind='item' then
  if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended('combat-catalogue-publication',0)) then raise exception using errcode='40001',message='ITEM_CATALOGUE_RETRY'; end if;
  select definition into d from app_private.combat_content_versions where id=new.version_id;
  if d->>'schemaVersion'='2' then perform app_private.assert_runtime_item_identity_v1(d);
  elsif exists(select 1 from app_private.character_item_stacks where item_id=new.content_key) or exists(select 1 from app_private.runtime_item_source_definitions where item_id=new.content_key) then raise exception using errcode='22023',message='ITEM_IDENTITY_SHAPE'; end if;
 end if;
 return new;
end; $$;
create trigger runtime_item_publication before insert or update on app_private.combat_content_publications for each row execute function app_private.guard_runtime_item_publication_v1();

-- Match account admission locks (ordinary battle seed0; World seed1), then character/build.
-- Catalogue try-lock prevents inversion with publication/archive holding its exclusive lock.
create function app_private.lock_character_item_inventory_v1(p_user_id uuid,p_character_id uuid,p_outside_battle boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0)) then raise exception using errcode='40001',message='ITEM_CATALOGUE_RETRY'; end if;
 if p_user_id is null or p_character_id is null then raise exception using errcode='42501',message='ITEM_OWNERSHIP'; end if;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,0));
 if not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text,1)) then raise exception using errcode='40001',message='ITEM_ADMISSION_RETRY'; end if;
 perform 1 from public.characters where id=p_character_id and user_id=p_user_id for update;
 if not found then raise exception using errcode='42501',message='ITEM_OWNERSHIP'; end if;
 perform 1 from app_private.character_active_builds where character_id=p_character_id and user_id=p_user_id for update;
 if not found then raise exception using errcode='22023',message='ITEM_BUILD_UNAVAILABLE'; end if;
 if exists(select 1 from app_private.account_deletion_requests where user_id=p_user_id) or exists(select 1 from app_private.character_deletion_requests where character_id=p_character_id) then raise exception using errcode='22023',message='ITEM_DELETION_PENDING'; end if;
 if p_outside_battle and exists(select 1 from app_private.battle_participants p join app_private.battle_sessions b on b.id=p.battle_session_id where (p.character_id=p_character_id or p.user_id=p_user_id) and b.lifecycle in ('pending','active')) then raise exception using errcode='22023',message='ITEM_BATTLE_ACTIVE'; end if;
 insert into app_private.character_item_inventory(character_id,selected_support,previous_basic_support)
 select p_character_id,jsonb_build_object('kind','basic','actionId',support_action_id),support_action_id from app_private.character_active_builds where character_id=p_character_id on conflict do nothing;
 perform 1 from app_private.character_item_inventory where character_id=p_character_id for update;
end; $$;

create function app_private.item_support_valid_v1(p_character_id uuid,p_equipment jsonb,p_support jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare stack app_private.character_item_stacks%rowtype; d jsonb;
begin
 if jsonb_typeof(p_support) is distinct from 'object' then return false; end if;
 if p_support->>'kind'='basic' then return (p_support-'kind'-'actionId')='{}'::jsonb and coalesce(p_support->>'actionId' in ('basic.recover','basic.recover.mp','basic.pilfer','basic.fleetstep','basic.invocation'),false); end if;
 if p_support->>'kind' is distinct from 'equipment' or (p_support-'kind'-'position'-'itemId'-'behaviorId')<>'{}'::jsonb or p_support->>'position' is null or p_support->>'position' not in ('head','body','pants','boots','main-hand','off-hand') then return false; end if;
 select * into stack from app_private.character_item_stacks where character_id=p_character_id and id::text=p_equipment->>(p_support->>'position');
 if not found or stack.item_id is distinct from p_support->>'itemId' then return false; end if;
 d:=app_private.current_runtime_item_v1(stack.item_id);
 return d->'enabled'='true'::jsonb and d->'actions'->'support'->>'behaviorId'=p_support->>'behaviorId';
exception when sqlstate '22023' then return false;
end; $$;

create function app_private.validate_character_item_equipment_v1(p_character_id uuid,p_equipment jsonb,p_support jsonb)
returns integer language plpgsql stable security definer set search_path='' as $$
declare entry record; stack app_private.character_item_stacks%rowtype; d jsonb; qp integer:=0; units integer;
begin
 if jsonb_typeof(p_equipment) is distinct from 'object' then raise exception using errcode='22023',message='ITEM_SLOT'; end if;
 for entry in select * from jsonb_each(p_equipment) loop
  if entry.key not in ('head','body','pants','boots','main-hand','off-hand') or jsonb_typeof(entry.value)<>'string' then raise exception using errcode='22023',message='ITEM_SLOT'; end if;
  select * into stack from app_private.character_item_stacks where character_id=p_character_id and id::text=p_equipment->>entry.key;
  if not found then raise exception using errcode='42501',message='ITEM_OWNERSHIP'; end if;
  d:=app_private.current_runtime_item_v1(stack.item_id);
  perform app_private.assert_runtime_item_shape_v1(d);
  if d->'enabled' is distinct from 'true'::jsonb or d->'equipment'='null'::jsonb then raise exception using errcode='22023',message='ITEM_DEFINITION_UNAVAILABLE'; end if;
  if stack.inventory_category is distinct from d->>'inventoryCategory' or stack.quantity>(d->>'maximumStack')::integer then raise exception using errcode='22023',message='ITEM_STACK_SHAPE'; end if;
  if d->'equipment'->>'hands'='2' and (entry.key<>'main-hand' or p_equipment ? 'off-hand') then raise exception using errcode='22023',message='ITEM_HAND_CONFLICT'; end if;
  if (case when d->'equipment'->>'slot'='hand' then entry.key not in ('main-hand','off-hand') else d->'equipment'->>'slot' is distinct from entry.key end) then raise exception using errcode='22023',message='ITEM_SLOT'; end if;
  select count(*) into units from jsonb_each(p_equipment) where value=entry.value;
  if units>stack.quantity then raise exception using errcode='22023',message='ITEM_QUANTITY'; end if;
  if units>1 and d->>'itemClass'<>'battle-item' then raise exception using errcode='22023',message='ITEM_OWNERSHIP'; end if;
  qp:=qp+(d->>'qualityPoints')::integer;
 end loop;
 if qp>100 then raise exception using errcode='22023',message='ITEM_OVER_QP',detail=qp::text; end if;
 if not coalesce(app_private.item_support_valid_v1(p_character_id,p_equipment,p_support),false) then raise exception using errcode='22023',message='ITEM_SUPPORT'; end if;
 return qp;
end; $$;

create function app_private.character_item_snapshot_v1(p_character_id uuid)
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('characterId',i.character_id,'revision',i.revision,'equipment',i.equipment,'selectedSupport',i.selected_support,'previousBasicSupport',i.previous_basic_support,
 'stacks',(select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'characterId',s.character_id,'itemId',s.item_id,'inventoryCategory',s.inventory_category,'slotIndex',s.slot_index,'quantity',s.quantity,'acquiredAt',s.acquired_at,'acquiredContentVersion',s.acquired_content_version,'provenance',s.provenance) order by s.inventory_category,s.slot_index),'[]') from app_private.character_item_stacks s where s.character_id=i.character_id),
 'grants',(select coalesce(jsonb_agg(jsonb_build_object('key',g.grant_key,'items',g.items) order by g.grant_key),'[]') from app_private.character_item_grants g where g.character_id=i.character_id)) from app_private.character_item_inventory i where i.character_id=p_character_id;
$$;

create function public.read_character_item_inventory_v1(p_user_id uuid,p_character_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);
 return app_private.character_item_snapshot_v1(p_character_id);
end; $$;

create function public.read_current_runtime_item_v1(p_item_id text)
returns jsonb language sql stable security definer set search_path='' as $$ select app_private.current_runtime_item_v1(p_item_id); $$;

create function public.grant_character_items_v1(p_user_id uuid,p_character_id uuid,p_expected_revision bigint,p_grant_key text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare old_items jsonb; grant_item jsonb; d jsonb; current_revision bigint; remaining integer; take integer; slot smallint; stack app_private.character_item_stacks%rowtype;
begin
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,false);
 if p_grant_key is null or char_length(p_grant_key) not between 1 and 160 or jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 240 then raise exception using errcode='22023',message='ITEM_GRANT_INVALID'; end if;
 select items into old_items from app_private.character_item_grants where character_id=p_character_id and grant_key=p_grant_key;
 if found then
  if old_items is distinct from p_items then raise exception using errcode='22023',message='ITEM_GRANT_CONFLICT'; end if;
  return jsonb_build_object('snapshot',app_private.character_item_snapshot_v1(p_character_id),'replayed',true);
 end if;
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,true);
 select revision into current_revision from app_private.character_item_inventory where character_id=p_character_id;
 if p_expected_revision is distinct from current_revision then raise exception using errcode='40001',message='ITEM_STALE_REVISION'; end if;
 for grant_item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(grant_item) is distinct from 'object' or (grant_item-'itemId'-'quantity')<>'{}'::jsonb or jsonb_typeof(grant_item->'itemId') is distinct from 'string' or jsonb_typeof(grant_item->'quantity') is distinct from 'number' or (grant_item->>'quantity') !~ '^[1-9][0-9]*$' or (grant_item->>'quantity')::numeric>3960 then raise exception using errcode='22023',message='ITEM_QUANTITY'; end if;
  d:=app_private.current_runtime_item_v1(grant_item->>'itemId');
  perform app_private.assert_runtime_item_shape_v1(d);
  if d->'enabled' is distinct from 'true'::jsonb then raise exception using errcode='22023',message='ITEM_DEFINITION_UNAVAILABLE'; end if;
  remaining:=(grant_item->>'quantity')::integer;
  for stack in select * from app_private.character_item_stacks where character_id=p_character_id and item_id=d->>'id' order by slot_index loop
   if stack.inventory_category is distinct from d->>'inventoryCategory' or stack.quantity>(d->>'maximumStack')::integer then raise exception using errcode='22023',message='ITEM_STACK_SHAPE'; end if;
   take:=least(remaining,(d->>'maximumStack')::integer-stack.quantity);
   update app_private.character_item_stacks set quantity=quantity+take where id=stack.id;
   remaining:=remaining-take;
  end loop;
  while remaining>0 loop
   select n::smallint into slot from generate_series(0,39) n where not exists(select 1 from app_private.character_item_stacks where character_id=p_character_id and inventory_category=d->>'inventoryCategory' and slot_index=n) order by n limit 1;
   if slot is null then raise exception using errcode='22023',message='ITEM_CAPACITY'; end if;
   take:=least(remaining,(d->>'maximumStack')::integer);
   insert into app_private.character_item_stacks(character_id,item_id,inventory_category,slot_index,quantity,acquired_content_version,provenance) values(p_character_id,d->>'id',d->>'inventoryCategory',slot,take,(d->>'contentVersion')::integer,p_grant_key);
   remaining:=remaining-take;
  end loop;
 end loop;
 insert into app_private.character_item_grants(character_id,grant_key,items) values(p_character_id,p_grant_key,p_items);
 update app_private.character_item_inventory set revision=revision+1 where character_id=p_character_id;
 return jsonb_build_object('snapshot',app_private.character_item_snapshot_v1(p_character_id),'replayed',false);
end; $$;

create function public.set_character_item_equipment_v1(p_user_id uuid,p_character_id uuid,p_expected_revision bigint,p_equipment jsonb,p_selected_support jsonb,p_replace_positions text[] default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_state app_private.character_item_inventory%rowtype; old_support jsonb; next_support jsonb:=p_selected_support; notice boolean:=false; entry record; removal_only boolean;
begin
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,true);
 select * into current_state from app_private.character_item_inventory where character_id=p_character_id;
 if p_expected_revision is distinct from current_state.revision then raise exception using errcode='40001',message='ITEM_STALE_REVISION'; end if;
 if p_replace_positions is null or exists(select 1 from unnest(p_replace_positions) p where p is null or p not in ('head','body','pants','boots','main-hand','off-hand')) then raise exception using errcode='22023',message='ITEM_SLOT'; end if;
 for entry in select * from jsonb_each(current_state.equipment) loop
  if entry.value is distinct from p_equipment->entry.key and not(entry.key=any(p_replace_positions)) then raise exception using errcode='22023',message='ITEM_EXPLICIT_SWAP_REQUIRED'; end if;
 end loop;
 old_support:=current_state.selected_support;
 -- A current selected source disappearing reverts to the prior valid Basic support, with notice.
 if p_selected_support is not distinct from old_support and old_support->>'kind'='equipment' and (not coalesce(app_private.item_support_valid_v1(p_character_id,p_equipment,old_support),false) or current_state.equipment->(old_support->>'position') is distinct from p_equipment->(old_support->>'position')) then
  next_support:=jsonb_build_object('kind','basic','actionId',current_state.previous_basic_support);notice:=true;
 end if;
 removal_only:=jsonb_typeof(p_equipment)='object' and p_equipment<>current_state.equipment and not exists(select 1 from jsonb_each(p_equipment) e where e.value is distinct from current_state.equipment->e.key);
 if removal_only then
  if not coalesce(app_private.item_support_valid_v1(p_character_id,p_equipment,next_support),false) then raise exception using errcode='22023',message='ITEM_SUPPORT'; end if;
 else
  perform app_private.validate_character_item_equipment_v1(p_character_id,p_equipment,next_support);
 end if;
 update app_private.character_item_inventory set equipment=p_equipment,selected_support=next_support,previous_basic_support=case when next_support->>'kind'='basic' then next_support->>'actionId' else previous_basic_support end,revision=revision+1 where character_id=p_character_id;
 update app_private.character_active_builds set build_version=build_version+1,updated_at=clock_timestamp() where character_id=p_character_id;
 return jsonb_build_object('snapshot',app_private.character_item_snapshot_v1(p_character_id),'notices',case when notice then '["equipment-support-removed"]'::jsonb else '[]'::jsonb end);
end; $$;

create function public.sort_character_item_inventory_v1(p_user_id uuid,p_character_id uuid,p_expected_revision bigint,p_category text,p_stack_ids uuid[])
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_revision bigint; owned_count integer;
begin
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,true);
 select revision into current_revision from app_private.character_item_inventory where character_id=p_character_id;
 if p_expected_revision is distinct from current_revision then raise exception using errcode='40001',message='ITEM_STALE_REVISION'; end if;
 select count(*) into owned_count from app_private.character_item_stacks where character_id=p_character_id and inventory_category=p_category;
 if p_category is null or p_category not in ('gear','battle-items','materials','general','event','companion') or p_stack_ids is null or cardinality(p_stack_ids)<>owned_count or (select count(distinct x) from unnest(p_stack_ids) x)<>owned_count or exists(select 1 from unnest(p_stack_ids) x where not exists(select 1 from app_private.character_item_stacks where id=x and character_id=p_character_id and inventory_category=p_category)) then raise exception using errcode='22023',message='ITEM_PERMUTATION'; end if;
 set constraints app_private.character_item_category_slot deferred;
 update app_private.character_item_stacks s set slot_index=(x.ordinality-1)::smallint from unnest(p_stack_ids) with ordinality x(id,ordinality) where s.id=x.id and s.character_id=p_character_id and s.inventory_category=p_category;
 set constraints app_private.character_item_category_slot immediate;
 update app_private.character_item_inventory set revision=revision+1 where character_id=p_character_id;
 return app_private.character_item_snapshot_v1(p_character_id);
end; $$;

-- Later admission RPCs invoke this inside the admission transaction before pinning definitions.
create function public.assert_character_item_admission_v1(p_user_id uuid,p_character_id uuid,p_expected_revision bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s app_private.character_item_inventory%rowtype; qp integer;
begin
 perform app_private.lock_character_item_inventory_v1(p_user_id,p_character_id,true);
 select * into s from app_private.character_item_inventory where character_id=p_character_id;
 if p_expected_revision is distinct from s.revision then raise exception using errcode='40001',message='ITEM_STALE_REVISION'; end if;
 qp:=app_private.validate_character_item_equipment_v1(p_character_id,s.equipment,s.selected_support);
 return jsonb_build_object('inventory',app_private.character_item_snapshot_v1(p_character_id),'qualityPoints',qp,'definitions',(select coalesce(jsonb_object_agg(x.item_id,app_private.current_runtime_item_v1(x.item_id)),'{}') from (select distinct stacks.item_id from app_private.character_item_stacks stacks join jsonb_each_text(s.equipment) e on e.value=stacks.id::text where stacks.character_id=p_character_id) x));
end; $$;

-- Extend the latest validators and current saved-draft publisher, without replacing other kinds.
do $migration$
declare definition text; predecessor text;
begin
 definition:=pg_get_functiondef('app_private.validate_noncombat_content_v1(text,jsonb)'::regprocedure);
 predecessor:=$before$ if p_kind not in ('discipline','tag','item','ascension','severence') then return; end if;$before$;
 if strpos(definition,predecessor)=0 then raise exception 'ITEM_VALIDATOR_PREDECESSOR_CONFLICT'; end if;
 execute replace(definition,predecessor,$after$ if p_kind='item' and d->'schemaVersion'='2'::jsonb then perform app_private.assert_runtime_item_shape_v1(d); return; end if;
$after$||predecessor);
 definition:=pg_get_functiondef('public.publish_saved_combat_content_v1(uuid,uuid,text,bigint,integer,text,integer)'::regprocedure);
 predecessor:=$before$if r.content_kind in ('item','ascension','severence') then$before$;
 if strpos(definition,predecessor)=0 then raise exception 'ITEM_PUBLISH_PREDECESSOR_CONFLICT'; end if;
 execute replace(definition,predecessor,$after$if r.content_kind in ('ascension','severence') or (r.content_kind='item' and d.definition->'schemaVersion' is distinct from '2'::jsonb) then$after$);
end; $migration$;

-- Explicit narrow ACLs: helpers cannot be called by clients or directly by service_role.
revoke all on function app_private.current_runtime_item_v1(text),app_private.assert_runtime_item_shape_v1(jsonb),app_private.assert_runtime_item_identity_v1(jsonb),app_private.guard_runtime_item_publication_v1(),app_private.lock_character_item_inventory_v1(uuid,uuid,boolean),app_private.item_support_valid_v1(uuid,jsonb,jsonb),app_private.validate_character_item_equipment_v1(uuid,jsonb,jsonb),app_private.character_item_snapshot_v1(uuid) from public,anon,authenticated,service_role;
revoke all on function public.seed_runtime_item_sources_v1(jsonb),public.read_current_runtime_item_v1(text),public.read_character_item_inventory_v1(uuid,uuid),public.grant_character_items_v1(uuid,uuid,bigint,text,jsonb),public.set_character_item_equipment_v1(uuid,uuid,bigint,jsonb,jsonb,text[]),public.sort_character_item_inventory_v1(uuid,uuid,bigint,text,uuid[]),public.assert_character_item_admission_v1(uuid,uuid,bigint) from public,anon,authenticated;
grant execute on function public.seed_runtime_item_sources_v1(jsonb),public.read_current_runtime_item_v1(text),public.read_character_item_inventory_v1(uuid,uuid),public.grant_character_items_v1(uuid,uuid,bigint,text,jsonb),public.set_character_item_equipment_v1(uuid,uuid,bigint,jsonb,jsonb,text[]),public.sort_character_item_inventory_v1(uuid,uuid,bigint,text,uuid[]),public.assert_character_item_admission_v1(uuid,uuid,bigint) to service_role;
commit;
