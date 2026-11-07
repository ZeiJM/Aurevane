begin;

-- Both the Item view and the discard writer use this policy under the inventory
-- lock. Only the player's separate World claim can deliver the owed weapon.
create or replace function app_private.character_item_discardable_stack_ids_v1(p_character_id uuid)
returns jsonb language sql stable set search_path='' as $$
 with gear_recovery as (
   select exists (
     select from app_private.event_personal_quest_attempts a
     join public.characters c on c.id=a.character_id and c.user_id=a.user_id
     where a.character_id=p_character_id and a.item_claim_pending and a.restoration_item_id is not null
   ) and (
     -- Gear has one stack per slot, with unique slot indices 0 through 39.
     select count(*)=40 from app_private.character_item_stacks
     where character_id=p_character_id and inventory_category='gear'
   ) as available
 )
 select coalesce(jsonb_agg(s.id order by s.inventory_category,s.slot_index),'[]'::jsonb)
 from app_private.character_item_stacks s
 join app_private.character_item_inventory i on i.character_id=s.character_id
 where s.character_id=p_character_id
   and (s.inventory_category in ('event','general') or (
     s.inventory_category='gear' and (select available from gear_recovery)
     and not exists (
       select from app_private.event_run_personal_journeys j
       where j.journey->>'type'='inventory-discovery'
         and s.item_id in (j.journey->>'firstItemId',j.journey->>'secondItemId',j.journey#>>'{restoration,outputItemId}')
     )
     and not exists (
       select from app_private.event_publications p
       join app_private.event_definition_versions v on (v.id,v.event_key)=(p.version_id,p.event_key)
       where s.item_id in (
         v.definition#>>'{inventoryDiscovery,firstItemId}',v.definition#>>'{inventoryDiscovery,secondItemId}',
         v.definition#>>'{inventoryDiscovery,restoration,outputItemId}'
       )
     )
   ))
   and s.item_id not in ('letter-introduction','cracked-aurevane-sigil','gatewarden-token')
   and left(s.provenance,6)<>'event.'
   and not exists(select from jsonb_each_text(i.equipment) e where e.value=s.id::text)
   and not exists(
     select from app_private.event_run_personal_journeys j
     where j.journey->>'type'='item-exchange' and j.journey->>'inputItemId'=s.item_id
   )
   and not exists(
     select from app_private.event_run_personal_journeys j
     where j.journey->>'type'='item-exchange' and j.journey->>'outputItemId'=s.item_id
   )
   and s.item_id not in (
     select item.id
     from app_private.event_publications p
     join app_private.event_definition_versions v on (v.id,v.event_key)=(p.version_id,p.event_key)
     cross join lateral (values
       (v.definition#>>'{personalJourney,inputItemId}'),
       (v.definition#>>'{personalJourney,outputItemId}')
     ) item(id)
     where v.definition#>>'{personalJourney,type}'='item-exchange' and item.id is not null
   );
$$;

commit;
