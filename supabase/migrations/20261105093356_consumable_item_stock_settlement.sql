begin;

-- New preparation captures the exact readied stack's stock. Published definitions,
-- source versions and historical/active captures remain literal (including consumeOnUse=false).
do $capture$
declare d text; anchor text;
begin
 d:=pg_get_functiondef('app_private.battle_equipment_capture_v1(jsonb)'::regprocedure);
 anchor:=$before$'schemaVersion',2,$before$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'ITEM_STOCK_CAPTURE_PREDECESSOR'; end if;
 d:=replace(d,anchor,$after$'schemaVersion',2,'consumptionPolicyVersion',1,$after$);
 anchor:=$before$'position',e.key,'ownedStackId',e.value,'item',p_admission->'definitions'->(s->>'itemId'))$before$;
 if (length(d)-length(replace(d,anchor,'')))/length(anchor)<>1 then raise exception 'ITEM_STOCK_QUANTITY_PREDECESSOR'; end if;
 d:=replace(d,anchor,$after$'position',e.key,'ownedStackId',e.value,'item',p_admission->'definitions'->(s->>'itemId')) ||
    case when p_admission->'definitions'->(s->>'itemId')->>'itemClass'='battle-item'
      then jsonb_build_object('ownedQuantity',s->'quantity') else '{}'::jsonb end$after$);
 execute d;
end; $capture$;

create table app_private.battle_item_consumptions (
 battle_session_id uuid not null references app_private.battle_sessions(id) on delete cascade,
 battle_version bigint not null,
 source_instance_id text not null,
 character_id uuid not null references public.characters(id) on delete cascade,
 owned_stack_id text not null,
 quantity integer not null check(quantity between 1 and 99),
 remaining_quantity integer not null check(remaining_quantity between 0 and 99),
 created_at timestamptz not null default clock_timestamp(),
 primary key(battle_session_id,battle_version,source_instance_id)
);
alter table app_private.battle_item_consumptions enable row level security;
revoke all on app_private.battle_item_consumptions from public,anon,authenticated,service_role;
-- The production source binder adds only Tag wording to canonical abilities and
-- native nested Skills. Ignore that display field in those exact contexts when
-- matching a newly activated source to its raw immutable admission; retain every
-- mechanical key, stock value, identity, requirement and authored payload.
create function app_private.item_stock_mechanics_v1(d jsonb,depth integer default 0) returns jsonb
language plpgsql immutable set search_path='' as $$
declare result jsonb; presentation_context boolean;
begin
 if depth>128 then raise exception using errcode='22023',message='ITEM_STOCK_RECEIPT_INVALID'; end if;
 if jsonb_typeof(d)='array' then
  select coalesce(jsonb_agg(app_private.item_stock_mechanics_v1(e.value,depth+1) order by e.ordinality),'[]'::jsonb) into result from jsonb_array_elements(d) with ordinality e;
  return result;
 elsif jsonb_typeof(d)='object' then
  presentation_context:=jsonb_typeof(d->'behaviors')='array' or
   (not d ? 'ability' and jsonb_typeof(d->'id')='string' and jsonb_typeof(d->'contentVersion')='number'
    and (jsonb_typeof(d->'effects')='array' or jsonb_typeof(d#>'{trigger,resultEffects}')='array' or jsonb_typeof(d#>'{trigger,payoffEffects}')='array'));
  select coalesce(jsonb_object_agg(e.key,app_private.item_stock_mechanics_v1(e.value,depth+1)),'{}'::jsonb) into result
   from jsonb_each(d) e where not (coalesce(presentation_context,false) and e.key='tagPresentation' and jsonb_typeof(e.value)='array');
  return result;
 end if;
 return d;
end; $$;
revoke all on function app_private.item_stock_mechanics_v1(jsonb,integer) from public,anon,authenticated,service_role;
create function app_private.prevent_item_consumption_receipt_update_v1() returns trigger
language plpgsql set search_path='' as $$ begin raise exception using errcode='42501',message='ITEM_STOCK_RECEIPT_IMMUTABLE'; end; $$;
create trigger battle_item_consumptions_immutable before update on app_private.battle_item_consumptions
 for each row execute function app_private.prevent_item_consumption_receipt_update_v1();

-- Runs only inside an authorized successful battle-head CAS. All nested locks are
-- nonblocking after the battle row lock, so admission/account lock order cannot invert.
-- Public inventory writers retain their pending/active battle prohibition.
create function app_private.settle_battle_item_stock_v1() returns trigger
language plpgsql security definer set search_path='' as $$
declare s jsonb; next_source jsonb; before_counts jsonb:=coalesce(old.current_snapshot#>'{itemConsumptionState,consumed}','[]'::jsonb);
 after_counts jsonb:=coalesce(new.current_snapshot#>'{itemConsumptionState,consumed}','[]'::jsonb);
 before_count integer; after_count integer; before_usage integer; after_usage integer; delta integer;
 identity jsonb; participant record; inventory app_private.character_item_inventory%rowtype;
 stack app_private.character_item_stacks%rowtype; remaining integer; next_equipment jsonb;
begin
 if new.current_version=old.current_version and new.current_snapshot is not distinct from old.current_snapshot then return new; end if;
 -- Legacy encounters and non-Item snapshot maintenance retain their original authority.
 if not old.current_snapshot ? 'itemConsumptionState' and not new.current_snapshot ? 'itemConsumptionState'
  and not exists(select 1 from jsonb_array_elements(coalesce(old.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c where c#>>'{equipment,consumptionPolicyVersion}'='1')
  and not exists(select 1 from jsonb_array_elements(coalesce(new.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c where c#>>'{equipment,consumptionPolicyVersion}'='1')
 then return new; end if;
 -- Canonical v2 startup replaces the initial version-one snapshot after source
 -- activation. Sources are introduced here, but stock cannot be spent: every
 -- new consumable must match its exact previously admitted immutable equipment
 -- capture, with no Item activation usage or consumption receipt.
 if old.current_version=1 and new.current_version=1 then
  if old.current_snapshot->'itemConsumptionState' is distinct from new.current_snapshot->'itemConsumptionState'
   or before_counts<>'[]'::jsonb or after_counts<>'[]'::jsonb
   or (select jsonb_agg(jsonb_build_array(c->>'combatantId',c#>'{extensions,equipmentSkills}') order by c->>'combatantId') from jsonb_array_elements(coalesce(old.current_snapshot#>'{buildAuthority,combatants}','[]'::jsonb)) c)
    is distinct from (select jsonb_agg(jsonb_build_array(c->>'combatantId',c#>'{extensions,equipmentSkills}') order by c->>'combatantId') from jsonb_array_elements(coalesce(new.current_snapshot#>'{buildAuthority,combatants}','[]'::jsonb)) c)
   or exists(select 1 from jsonb_array_elements(coalesce(old.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c
    where c#>>'{equipment,consumptionPolicyVersion}'='1' and not exists(select 1 from jsonb_array_elements(coalesce(new.current_snapshot->'capturedAbilitySources','[]'::jsonb)) n where n=c))
   or exists(select 1 from jsonb_array_elements(coalesce(new.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c
    where c#>>'{equipment,consumptionPolicyVersion}'='1' and (
     c->>'sourceKind' is distinct from 'equipment'
     or c#>'{equipment,consumptionPolicyVersion}' is distinct from '1'::jsonb
     or c#>>'{equipment,unit,item,itemClass}' is distinct from 'battle-item'
     or (c->>'sourceInstanceId')::jsonb is distinct from jsonb_build_array('equipment',c->>'ownerCombatantId',c#>>'{equipment,unit,position}',c#>>'{equipment,unit,ownedStackId}',c#>>'{equipment,unit,item,id}',c#>'{equipment,unit,item,contentVersion}')
     or c->>'abilityId' is distinct from 'item.'||(c#>>'{equipment,unit,item,id}')||'.'||(c#>>'{equipment,unit,position}')
     or c->'contentVersion' is distinct from c#>'{equipment,unit,item,contentVersion}'
     or c->'tags' is distinct from c#>'{equipment,unit,item,tags}'
     or c#>'{equipment,roles}' is distinct from jsonb_build_object('use',c#>'{equipment,unit,item,actions,use,behaviorId}')
     or app_private.item_stock_mechanics_v1(c->'definition') is distinct from jsonb_set(
       app_private.item_stock_mechanics_v1(c#>'{equipment,unit,item,ability}'),'{behaviors}',
       (select jsonb_agg(app_private.item_stock_mechanics_v1(b)||jsonb_build_object('maximumUsesPerBattle',
          least((c#>>'{equipment,unit,item,battleUses}')::integer,coalesce((b->>'maximumUsesPerBattle')::integer,(c#>>'{equipment,unit,item,battleUses}')::integer))))
        from jsonb_array_elements(c#>'{equipment,unit,item,ability,behaviors}') b))
     or not exists(select 1 from jsonb_array_elements(coalesce(old.current_snapshot#>'{buildAuthority,combatants}','[]'::jsonb)) b,
       lateral jsonb_array_elements(coalesce(b#>'{extensions,equipmentSkills}','[]'::jsonb)) cap,
       lateral jsonb_array_elements(coalesce(cap->'equipment','[]'::jsonb)) unit
       where b->>'combatantId'=c->>'ownerCombatantId' and cap->>'consumptionPolicyVersion'='1'
        and app_private.item_stock_mechanics_v1(unit)=app_private.item_stock_mechanics_v1(c#>'{equipment,unit}'))
     or exists(select 1 from jsonb_array_elements(coalesce(new.current_snapshot#>'{abilityRuntime,usage}','[]'::jsonb)) u
       where (u->>'key')::jsonb->>1=c->>'sourceInstanceId' and coalesce((u->>'usageCount')::integer,1)>0)
    ))
  then raise exception using errcode='22023',message='ITEM_STOCK_RECEIPT_INVALID'; end if;
  return new;
 end if;
 if new.current_version<>old.current_version+1 then raise exception using errcode='22023',message='ITEM_STOCK_RECEIPT_INVALID'; end if;
 if jsonb_typeof(before_counts) is distinct from 'array' or jsonb_typeof(after_counts) is distinct from 'array'
 or (new.current_snapshot ? 'itemConsumptionState' and
   (new.current_snapshot#>'{itemConsumptionState,version}' is distinct from '1'::jsonb
    or jsonb_typeof(new.current_snapshot#>'{itemConsumptionState,consumed}') is distinct from 'array'
    or ((new.current_snapshot->'itemConsumptionState')-'version'-'consumed')<>'{}'::jsonb))
 or exists(select 1 from jsonb_array_elements(after_counts) r where
   jsonb_typeof(r) is distinct from 'object' or (r-'sourceInstanceId'-'count')<>'{}'::jsonb
   or jsonb_typeof(r->'sourceInstanceId') is distinct from 'string'
   or jsonb_typeof(r->'count') is distinct from 'number' or coalesce(r->>'count','') !~ '^[1-9][0-9]?$')
 or (select count(*) from jsonb_array_elements(after_counts))<>(select count(distinct r->>'sourceInstanceId') from jsonb_array_elements(after_counts) r)
 then raise exception using errcode='22023',message='ITEM_STOCK_RECEIPT_INVALID'; end if;
 -- Neither receipt removal nor adding a new policy to an already admitted source is legal.
 if exists(select 1 from jsonb_array_elements(before_counts) r where not exists(select 1 from jsonb_array_elements(after_counts) n where n->>'sourceInstanceId'=r->>'sourceInstanceId'))
 or exists(select 1 from jsonb_array_elements(after_counts) r where not exists(
   select 1 from jsonb_array_elements(coalesce(old.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c
   where c->>'sourceInstanceId'=r->>'sourceInstanceId' and c#>>'{equipment,consumptionPolicyVersion}'='1'))
 or exists(select 1 from jsonb_array_elements(coalesce(new.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c
   where c#>>'{equipment,consumptionPolicyVersion}'='1' and not exists(
    select 1 from jsonb_array_elements(coalesce(old.current_snapshot->'capturedAbilitySources','[]'::jsonb)) prior
    where prior->>'sourceInstanceId'=c->>'sourceInstanceId' and prior=c))
 then raise exception using errcode='22023',message='ITEM_STOCK_RECEIPT_INVALID'; end if;
 for s in select c from jsonb_array_elements(coalesce(old.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c
   where c#>>'{equipment,consumptionPolicyVersion}'='1' order by c->>'ownerCombatantId',c#>>'{equipment,unit,ownedStackId}',c->>'sourceInstanceId' loop
  select c into next_source from jsonb_array_elements(coalesce(new.current_snapshot->'capturedAbilitySources','[]'::jsonb)) c where c->>'sourceInstanceId'=s->>'sourceInstanceId';
  if next_source is distinct from s or s#>>'{equipment,unit,item,itemClass}'<>'battle-item'
   or s#>>'{equipment,unit,position}' not in ('consumable-1','consumable-2')
   or coalesce(s#>>'{equipment,unit,ownedQuantity}','') !~ '^[1-9][0-9]?$'
   then raise exception using errcode='22023',message='ITEM_STOCK_RECEIPT_INVALID'; end if;
  select coalesce((r->>'count')::integer,0) into before_count from jsonb_array_elements(before_counts) r where r->>'sourceInstanceId'=s->>'sourceInstanceId';
  select coalesce((r->>'count')::integer,0) into after_count from jsonb_array_elements(after_counts) r where r->>'sourceInstanceId'=s->>'sourceInstanceId';
  before_count:=coalesce(before_count,0); after_count:=coalesce(after_count,0); delta:=after_count-before_count;
  identity:=jsonb_build_array(old.current_snapshot#>>'{tactical,battle,battleId}',s->>'sourceInstanceId',s->>'ownerCombatantId',s->>'abilityId',s->'contentVersion',s#>>'{equipment,roles,use}');
  select coalesce(sum((u->>'usageCount')::integer),0) into before_usage from jsonb_array_elements(coalesce(old.current_snapshot#>'{abilityRuntime,usage}','[]'::jsonb)) u where (u->>'key')::jsonb=identity;
  select coalesce(sum((u->>'usageCount')::integer),0) into after_usage from jsonb_array_elements(coalesce(new.current_snapshot#>'{abilityRuntime,usage}','[]'::jsonb)) u where (u->>'key')::jsonb=identity;
  if delta<0 or after_count>(s#>>'{equipment,unit,ownedQuantity}')::integer or delta<>after_usage-before_usage then
   raise exception using errcode='22023',message='ITEM_STOCK_RECEIPT_INVALID'; end if;
  if delta=0 then continue; end if;
  select p.user_id,p.character_id into participant from app_private.battle_participants p
   where p.battle_session_id=old.id and p.combatant_id=s->>'ownerCombatantId' and p.character_id is not null;
  if not found or not pg_catalog.pg_try_advisory_xact_lock_shared(pg_catalog.hashtextextended('combat-catalogue-publication',0))
   or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(participant.user_id::text,0))
   or not pg_catalog.pg_try_advisory_xact_lock(pg_catalog.hashtextextended(participant.user_id::text,1)) then
   raise exception using errcode='PT409',message='ITEM_STOCK_RETRY'; end if;
  perform 1 from public.characters c where c.id=participant.character_id and c.user_id=participant.user_id for update nowait;
  if not found then raise exception using errcode='42501',message='ITEM_OWNERSHIP'; end if;
  perform 1 from app_private.character_active_builds where character_id=participant.character_id for update nowait;
  if exists(select 1 from app_private.account_deletion_requests where user_id=participant.user_id)
   or exists(select 1 from app_private.character_deletion_requests where character_id=participant.character_id) then
   raise exception using errcode='22023',message='ITEM_DELETION_PENDING'; end if;
  select * into inventory from app_private.character_item_inventory where character_id=participant.character_id for update nowait;
  select * into stack from app_private.character_item_stacks where id::text=s#>>'{equipment,unit,ownedStackId}' and character_id=participant.character_id for update nowait;
  if not found or stack.item_id is distinct from s#>>'{equipment,unit,item,id}'
   or stack.inventory_category<>'battle-items' or stack.quantity<delta
   or inventory.equipment->>(s#>>'{equipment,unit,position}') is distinct from stack.id::text
   or stack.quantity<>(s#>>'{equipment,unit,ownedQuantity}')::integer-before_count then
   raise exception using errcode='PT409',message='ITEM_STOCK_STALE'; end if;
  remaining:=stack.quantity-delta; next_equipment:=inventory.equipment;
  if remaining=0 then
   select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) into next_equipment from jsonb_each(inventory.equipment) e where e.value<>to_jsonb(stack.id::text);
   delete from app_private.character_item_stacks where id=stack.id;
  else update app_private.character_item_stacks set quantity=remaining where id=stack.id; end if;
  update app_private.character_item_inventory set equipment=next_equipment,revision=revision+delta where character_id=participant.character_id;
  if next_equipment is distinct from inventory.equipment then
   update app_private.character_active_builds set build_version=build_version+1,updated_at=clock_timestamp() where character_id=participant.character_id;
  end if;
  insert into app_private.battle_item_consumptions(battle_session_id,battle_version,source_instance_id,character_id,owned_stack_id,quantity,remaining_quantity)
   values(old.id,new.current_version,s->>'sourceInstanceId',participant.character_id,stack.id::text,delta,remaining);
 end loop;
 return new;
exception when lock_not_available then raise exception using errcode='PT409',message='ITEM_STOCK_RETRY';
end; $$;
revoke all on function app_private.settle_battle_item_stock_v1(),app_private.prevent_item_consumption_receipt_update_v1() from public,anon,authenticated,service_role;
create trigger settle_battle_item_stock before update of current_snapshot,current_version on app_private.battle_sessions
 for each row execute function app_private.settle_battle_item_stock_v1();

commit;
