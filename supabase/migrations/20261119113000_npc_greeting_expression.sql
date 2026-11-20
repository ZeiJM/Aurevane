begin;

create or replace function app_private.valid_npc_world_settings_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    jsonb_typeof(value)='object'
    and value - array['sectorId','x','y','radius','greeting','greetingExpression','encounter'] = '{}'::jsonb
    and jsonb_typeof(value->'sectorId')='string' and (value->>'sectorId') ~ '^[a-z0-9:-]{1,100}$'
    and jsonb_typeof(value->'x')='number' and (value->>'x') ~ '^(0|[1-9]|1[0-2])$'
    and jsonb_typeof(value->'y')='number' and (value->>'y') ~ '^[0-8]$'
    and jsonb_typeof(value->'radius')='number' and (value->>'radius') ~ '^[1-3]$'
    and jsonb_typeof(value->'greeting')='string' and char_length(value->>'greeting')<=900
    and (not (value ? 'greetingExpression') or (
      jsonb_typeof(value->'greetingExpression')='string'
      and value->>'greetingExpression' in ('neutral','happy','angry','sad','surprised')
    ))
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
        world - array['sectorId','x','y','radius','greeting','greetingExpression','encounter'],id,revision
      )
      and app_private.valid_npc_world_settings_v1(world - array['id','name','portraitRef','imageUrl','revision'])
      and char_length(btrim(world->>'greeting'))>0
    )
  );

commit;
