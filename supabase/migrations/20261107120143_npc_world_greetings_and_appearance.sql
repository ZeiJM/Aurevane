begin;

create function app_private.valid_npc_appearance_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select value is null or value='null'::jsonb or coalesce(
    jsonb_typeof(value)='string' and (value #>> '{}') ~ '^/api/media/appearance/1/[a-z0-9.]{1,140}/neutral\.svg$',false
  );
$$;

create function app_private.valid_npc_world_settings_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    jsonb_typeof(value)='object'
    and value - array['sectorId','x','y','radius','greeting'] = '{}'::jsonb
    and jsonb_typeof(value->'sectorId')='string' and (value->>'sectorId') ~ '^[a-z0-9:-]{1,100}$'
    and jsonb_typeof(value->'x')='number' and (value->>'x') ~ '^(0|[1-9]|1[0-2])$'
    and jsonb_typeof(value->'y')='number' and (value->>'y') ~ '^[0-8]$'
    and jsonb_typeof(value->'radius')='number' and (value->>'radius') ~ '^[1-3]$'
    and jsonb_typeof(value->'greeting')='string' and char_length(value->>'greeting')<=900,
    false
  );
$$;

create or replace function app_private.valid_npc_draft_v1(value jsonb) returns boolean
language sql immutable set search_path='' as $$
  select case when jsonb_typeof(value)='object' and jsonb_typeof(value->'uses')='array' then coalesce(
    value - array['name','portraitRef','uses','arena','world','imageUrl'] = '{}'::jsonb
    and jsonb_typeof(value->'name')='string'
    and char_length(value->>'name')<=60
    and (value->'portraitRef'='null'::jsonb or value->>'portraitRef' ~ '^portrait\.[a-z0-9.-]{1,90}$')
    and app_private.valid_npc_appearance_v1(value->'imageUrl')
    and jsonb_array_length(value->'uses') between 1 and 3
    and jsonb_array_length(value->'uses') = (
      select count(distinct use) from jsonb_array_elements_text(value->'uses') use
      where use in ('arena','world','story')
    )
    and (app_private.valid_npc_arena_settings_v1(value->'arena')
      or (not ((value->'uses') ? 'arena') and value->'arena' = 'null'::jsonb))
    and (value->'world' is null or value->'world'='null'::jsonb or app_private.valid_npc_world_settings_v1(value->'world')),
    false)
  else false end;
$$;

create function app_private.valid_published_npc_identity_v1(value jsonb,p_id uuid,p_revision bigint) returns boolean
language sql immutable set search_path='' as $$
  select coalesce(
    jsonb_typeof(value)='object'
    and value - array['id','name','portraitRef','imageUrl','revision'] = '{}'::jsonb
    and value->>'id'=p_id::text
    and jsonb_typeof(value->'name')='string'
    and char_length(btrim(value->>'name')) between 1 and 60
    and (value->'portraitRef'='null'::jsonb or value->>'portraitRef' ~ '^portrait\.[a-z0-9.-]{1,90}$')
    and app_private.valid_npc_appearance_v1(value->'imageUrl')
    and jsonb_typeof(value->'revision')='number'
    and (value->>'revision')::bigint between 1 and p_revision,
    false
  );
$$;

alter table app_private.npc_designs
  drop constraint npc_designs_check,
  add column world jsonb,
  add column story jsonb,
  add constraint npc_designs_arena_valid check (
    arena is null or (
      app_private.valid_published_npc_identity_v1(arena - array['arenaId','aiDifficulty','lore'],id,revision)
      and app_private.valid_npc_arena_settings_v1(arena - array['id','name','portraitRef','imageUrl','revision'])
    )
  ),
  add constraint npc_designs_world_valid check (
    world is null or (
      app_private.valid_published_npc_identity_v1(world - array['sectorId','x','y','radius','greeting'],id,revision)
      and app_private.valid_npc_world_settings_v1(world - array['id','name','portraitRef','imageUrl','revision'])
      and char_length(btrim(world->>'greeting'))>0
    )
  ),
  add constraint npc_designs_story_valid check (story is null or app_private.valid_published_npc_identity_v1(story,id,revision));

create unique index npc_designs_world_placement_idx on app_private.npc_designs (
  (world->>'sectorId'),(world->>'x'),(world->>'y')
) where world is not null;

-- The same NPC may reuse a manifest across its own roles. A different active NPC
-- cannot claim the same generated appearance, including simultaneous publishes.
create table app_private.npc_appearance_claims (
  image_url text primary key,
  npc_id uuid not null references app_private.npc_designs(id) on delete cascade
);
alter table app_private.npc_appearance_claims enable row level security;
revoke all on table app_private.npc_appearance_claims from public,anon,authenticated,service_role;
create index npc_appearance_claims_npc_idx on app_private.npc_appearance_claims(npc_id);

create or replace function public.read_master_npc_designs_v1(p_actor_user_id uuid,p_actor_character_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'npc.manage');
  return coalesce((
    select jsonb_agg(jsonb_build_object('id',d.id,'revision',d.revision,'draft',d.draft,'arena',d.arena,'world',d.world,'story',d.story)
      order by lower(d.draft->>'name'),d.id)
    from (
      select id,revision,draft,arena,world,story from app_private.npc_designs
      order by lower(draft->>'name'),id limit 200
    ) d
  ), '[]'::jsonb);
end; $$;

create or replace function public.write_master_npc_design_v1(
  p_actor_user_id uuid,p_actor_character_id uuid,p_id uuid,p_expected_revision bigint,p_kind text,p_draft jsonb
)
returns jsonb language plpgsql security definer set search_path='' as $$
declare current_row app_private.npc_designs%rowtype;
declare identity jsonb;
declare next_arena jsonb;
declare next_world jsonb;
declare next_story jsonb;
declare audit_subject text;
declare use_name text;
declare active_images text[];
declare image text;
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'npc.manage');
  if p_id is null or p_expected_revision is null or p_expected_revision < 0
    or p_kind is null or p_kind not in ('save','commit-arena','retire-arena','commit-world','retire-world','commit-story','retire-story')
    or (p_kind='save' and not app_private.valid_npc_draft_v1(p_draft))
    or (p_kind<>'save' and p_draft is not null) then
    raise exception using errcode='22023', message='NPC_DESIGN_INVALID';
  end if;

  if p_expected_revision=0 and p_kind='save' then
    insert into app_private.npc_designs(id,revision,draft) values(p_id,1,p_draft)
    on conflict (id) do nothing returning * into current_row;
    if not found then raise exception using errcode='PT409', message='NPC_DESIGN_VERSION_CONFLICT'; end if;
  else
    select * into current_row from app_private.npc_designs where id=p_id for update;
    if not found or current_row.revision<>p_expected_revision then
      raise exception using errcode='PT409', message='NPC_DESIGN_VERSION_CONFLICT';
    end if;

    use_name := split_part(p_kind,'-',2);
    next_arena := current_row.arena;
    next_world := current_row.world;
    next_story := current_row.story;
    audit_subject := coalesce(
      nullif(btrim(current_row.draft->>'name'),''),
      current_row.arena->>'name',current_row.world->>'name',current_row.story->>'name','NPC'
    );
    if p_kind like 'commit-%' then
      if not ((current_row.draft->'uses') ? use_name)
        or char_length(btrim(current_row.draft->>'name'))=0 then
        raise exception using errcode='22023', message='NPC_USE_NOT_READY';
      end if;
      identity := jsonb_build_object(
        'id',p_id,'revision',p_expected_revision+1,'name',current_row.draft->>'name',
        'portraitRef',current_row.draft->'portraitRef'
      );
      if current_row.draft->>'imageUrl' is not null then
        identity:=identity || jsonb_build_object('imageUrl',current_row.draft->'imageUrl');
      end if;
      case use_name
        when 'arena' then next_arena:=current_row.draft->'arena' || identity;
        when 'world' then
          if not app_private.valid_npc_world_settings_v1(current_row.draft->'world')
            or char_length(btrim(current_row.draft->'world'->>'greeting'))=0 then
            raise exception using errcode='22023', message='NPC_WORLD_NOT_READY';
          end if;
          next_world:=current_row.draft->'world' || identity;
        when 'story' then next_story:=identity;
      end case;
    elsif p_kind like 'retire-%' then
      case use_name
        when 'arena' then next_arena:=null;
        when 'world' then next_world:=null;
        when 'story' then next_story:=null;
      end case;
    end if;

    if (p_kind='save' and current_row.draft is distinct from p_draft)
      or (next_arena - 'revision') is distinct from (current_row.arena - 'revision')
      or (next_world - 'revision') is distinct from (current_row.world - 'revision')
      or (next_story - 'revision') is distinct from (current_row.story - 'revision') then
      if p_kind<>'save' then
        active_images := array(select distinct asset from unnest(array[
          next_arena->>'imageUrl',next_world->>'imageUrl',next_story->>'imageUrl'
        ]) asset where asset is not null order by asset);
        -- Stable lock order among claims avoids competing publishes acquiring
        -- different assets in opposite orders. Removing unused claims is atomic.
        foreach image in array active_images loop
          insert into app_private.npc_appearance_claims(image_url,npc_id) values(image,p_id)
          on conflict (image_url) do nothing;
          if not found and not exists(
            select 1 from app_private.npc_appearance_claims c where c.image_url=image and c.npc_id=p_id
          ) then raise exception using errcode='PT409', message='NPC_APPEARANCE_ALREADY_ACTIVE'; end if;
        end loop;
        delete from app_private.npc_appearance_claims where npc_id=p_id and not (image_url=any(active_images));
      end if;
      update app_private.npc_designs set
        draft=case when p_kind='save' then p_draft else draft end,
        arena=next_arena, world=next_world, story=next_story, revision=revision+1, updated_at=clock_timestamp()
      where id=p_id returning * into current_row;
      if p_kind <> 'save' then
        insert into app_private.master_panel_activity(actor,action,subject) values(
          app_private.master_activity_actor_v1(p_actor_user_id,p_actor_character_id),
          (case when p_kind like 'commit-%' then 'Committed ' else 'Retired ' end)||initcap(use_name)||' NPC',
          audit_subject
        );
      end if;
    end if;
  end if;
  return jsonb_build_object('id',current_row.id,'revision',current_row.revision,'draft',current_row.draft,
    'arena',current_row.arena,'world',current_row.world,'story',current_row.story);
end; $$;

create function public.read_published_world_npcs_v1(p_sector_id text)
returns jsonb language sql stable security definer set search_path='' as $$
  select coalesce((
    select jsonb_agg(d.world order by d.id)
    from app_private.npc_designs d
    where d.world is not null and d.world->>'sectorId'=p_sector_id
  ), '[]'::jsonb);
$$;

create function public.read_master_story_npcs_v1(p_actor_user_id uuid,p_actor_character_id uuid,p_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'events.author');
  return coalesce((
    select jsonb_agg(d.story order by lower(d.story->>'name'),d.id)
    from (
      select id,story from app_private.npc_designs where story is not null and (p_id is null or id=p_id)
      order by lower(story->>'name'),id limit 200
    ) d
  ), '[]'::jsonb);
end; $$;

revoke all on function app_private.valid_npc_appearance_v1(jsonb),app_private.valid_npc_world_settings_v1(jsonb),
  app_private.valid_published_npc_identity_v1(jsonb,uuid,bigint),
  public.read_published_world_npcs_v1(text),public.read_master_story_npcs_v1(uuid,uuid,uuid)
  from public,anon,authenticated,service_role;
grant execute on function public.read_published_world_npcs_v1(text),public.read_master_story_npcs_v1(uuid,uuid,uuid)
  to service_role;
commit;
