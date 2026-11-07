begin;

-- An occurrence can become live while a grant has already evaluated the
-- scheduled version but has not yet committed its stock. Remember both
-- visible revisions so the first read after that grant still reconciles.
alter table app_private.character_world_state
  add column inventory_discovery_item_revision bigint;

create or replace function app_private.read_world_personal_quests_v1(
  p_user_id uuid,p_character_id uuid,p_position jsonb,p_now timestamptz
)
returns jsonb language plpgsql set search_path = '' as $$
declare
  occurrence_revision bigint;
  item_revision bigint;
  reconcile_at timestamptz;
begin
  -- The clock is sampled in the statement that sees these revisions.
  -- If either advances after this read, do not mark that newer value scanned.
  select global_revision.revision,coalesce(inventory.revision,0),clock_timestamp()
    into occurrence_revision,item_revision,reconcile_at
  from app_private.event_inventory_discovery_revision global_revision
  join app_private.character_world_state world on world.character_id = p_character_id
  left join app_private.character_item_inventory inventory on inventory.character_id = p_character_id
  where global_revision.singleton and global_revision.revision > 0
    and (global_revision.revision > world.inventory_discovery_revision
      or coalesce(inventory.revision,0) is distinct from world.inventory_discovery_item_revision);
  if found then
    perform app_private.record_personal_inventory_discoveries_v1(
      p_user_id,p_character_id,null,reconcile_at
    );
    update app_private.character_world_state world
      set inventory_discovery_revision = occurrence_revision,
        inventory_discovery_item_revision = item_revision
      where world.character_id = p_character_id
        and world.inventory_discovery_revision <= occurrence_revision
        and coalesce(world.inventory_discovery_item_revision,0) <= item_revision
        and exists (select 1 from public.characters character
          where character.id = p_character_id and character.user_id = p_user_id);
  end if;
  return (
    select coalesce(jsonb_agg(
      case when row->>'giverId' is null then jsonb_build_object(
        'runId',row->'runId','title',row->'title','body',row->'body','discovery',true
      ) else row end order by ordinal
    ),'[]'::jsonb)
    from jsonb_array_elements(app_private.read_world_personal_quests_before_inventory_discovery_v1(
      p_user_id,p_character_id,p_position,p_now
    )) with ordinality rows(row,ordinal)
  );
end; $$;

-- Placement-free private discoveries use inventory evidence. The ordinary
-- dialogue writer must reject them with the same result as a missing quest.
-- Preserve the predecessor's ownership, version, run and replay checks.
do $migration$
declare
  body text;
  anchor constant text := $anchor$
  select * into quest from app_private.event_run_personal_journeys where run_id = p_run_id;
  if not found then raise exception 'WORLD_QUEST_ACTION_UNAVAILABLE' using errcode = '22023'; end if;
$anchor$;
begin
  body := pg_get_functiondef('public.commit_world_personal_quest_before_realm_v1(uuid,uuid,bigint,uuid,uuid,text,text)'::regprocedure);
  if length(body)-length(replace(body,anchor,'')) <> length(anchor) then
    raise exception 'INVENTORY_DISCOVERY_REPLY_GUARD_PREDECESSOR_MISSING';
  end if;
  execute replace(body,anchor,replace(anchor,'if not found then','if not found or quest.giver_position is null then'));
end; $migration$;

commit;
