begin;

-- The same limits apply to the editor, public projection and persisted drafts.
-- The recursive walk stops even if malformed data contains more layers.
create function app_private.valid_npc_dialogue_replies_v1(value jsonb, require_complete boolean)
returns boolean language sql immutable set search_path='' as $$
  with recursive nodes(depth, node) as (
    select 1, item from jsonb_array_elements(
      case when jsonb_typeof(value)='array' then
        case when jsonb_array_length(value)<=4 then value else '[]'::jsonb end
        else '[]'::jsonb end
    ) item
    union all
    select parent.depth+1, item
    from nodes parent
    cross join lateral jsonb_array_elements(
      case when jsonb_typeof(parent.node->'replies')='array' then
        case when jsonb_array_length(parent.node->'replies')<=4 then parent.node->'replies' else '[]'::jsonb end
        else '[]'::jsonb end
    ) item
    where parent.depth < 4
  )
  select coalesce(
    (case when jsonb_typeof(value)='array' then jsonb_array_length(value)<=4 else false end)
    and (select count(*)<=16 from nodes)
    and not exists (
      select 1 from nodes where not coalesce(
        jsonb_typeof(node)='object'
        and node - array['label','body','expression','replies'] = '{}'::jsonb
        and jsonb_typeof(node->'label')='string' and char_length(node->>'label')<=100
        and jsonb_typeof(node->'body')='string' and char_length(node->>'body')<=900
        and (not require_complete or (
          char_length(btrim(node->>'label'))>0 and char_length(btrim(node->>'body'))>0
        ))
        and (not (node ? 'expression') or (
          jsonb_typeof(node->'expression')='string'
          and node->>'expression' in ('neutral','happy','angry','sad','surprised')
        ))
        and (case when jsonb_typeof(node->'replies')='array' then
          jsonb_array_length(node->'replies') <= case when depth=4 then 0 else 4 end
          else false end),
        false
      )
    ), false
  );
$$;
revoke all on function app_private.valid_npc_dialogue_replies_v1(jsonb,boolean)
  from public, anon, authenticated, service_role;

create or replace function app_private.valid_npc_world_settings_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    jsonb_typeof(value)='object'
    and value - array['sectorId','x','y','radius','greeting','greetingExpression','dialogue','encounter'] = '{}'::jsonb
    and jsonb_typeof(value->'sectorId')='string' and (value->>'sectorId') ~ '^[a-z0-9:-]{1,100}$'
    and jsonb_typeof(value->'x')='number' and (value->>'x') ~ '^(0|[1-9]|1[0-2])$'
    and jsonb_typeof(value->'y')='number' and (value->>'y') ~ '^[0-8]$'
    and jsonb_typeof(value->'radius')='number' and (value->>'radius') ~ '^[1-3]$'
    and jsonb_typeof(value->'greeting')='string' and char_length(value->>'greeting')<=900
    and (not (value ? 'greetingExpression') or (
      jsonb_typeof(value->'greetingExpression')='string'
      and value->>'greetingExpression' in ('neutral','happy','angry','sad','surprised')
    ))
    and (not (value ? 'dialogue') or app_private.valid_npc_dialogue_replies_v1(value->'dialogue',false))
    and (value->'encounter' is null or value->'encounter'='null'::jsonb
      or app_private.valid_npc_world_encounter_v1(value->'encounter')),
    false
  );
$$;

alter table app_private.npc_designs
  drop constraint npc_designs_world_valid,
  add constraint npc_designs_world_valid check (
    world is null or (
      app_private.valid_published_npc_identity_v1(
        world - array['sectorId','x','y','radius','greeting','greetingExpression','dialogue','encounter'],id,revision
      )
      and app_private.valid_npc_world_settings_v1(world - array['id','name','portraitRef','imageUrl','revision'])
      and char_length(btrim(world->>'greeting'))>0
      and (not (world ? 'dialogue') or app_private.valid_npc_dialogue_replies_v1(world->'dialogue',true))
    )
  );

commit;
