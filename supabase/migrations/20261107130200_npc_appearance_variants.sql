begin;

-- Keep all existing claims. Multiple identities may now share an active image only when
-- the Game Owner explicitly approves the addition of a particular identity.
create table app_private.npc_appearance_claim_keys (
  image_url text primary key
);
alter table app_private.npc_appearance_claim_keys enable row level security;
revoke all on table app_private.npc_appearance_claim_keys from public,anon,authenticated,service_role;
insert into app_private.npc_appearance_claim_keys(image_url)
  select image_url from app_private.npc_appearance_claims;

alter table app_private.npc_appearance_claims
  drop constraint npc_appearance_claims_pkey,
  add primary key (image_url,npc_id),
  add foreign key (image_url) references app_private.npc_appearance_claim_keys(image_url);

-- This private ledger outlives both the active claim and the rolling activity feed.
create table app_private.npc_appearance_uniform_approvals (
  npc_id uuid not null,
  revision bigint not null check (revision > 0),
  image_url text not null,
  approved_use text not null check (approved_use in ('arena','world','story')),
  approved_by uuid not null,
  reason text not null check (char_length(btrim(reason)) between 1 and 240),
  approved_at timestamptz not null default clock_timestamp(),
  primary key (npc_id,revision)
);
alter table app_private.npc_appearance_uniform_approvals enable row level security;
revoke all on table app_private.npc_appearance_uniform_approvals from public,anon,authenticated,service_role;

create function app_private.sync_npc_appearance_claims_v2(
  p_id uuid,p_active_images text[],p_uniform_image text,p_allow_uniform boolean
) returns void language plpgsql set search_path='' as $$
declare image text;
declare already_owned boolean;
declare taken boolean;
begin
  if p_allow_uniform and p_uniform_image is null then
    raise exception using errcode='22023', message='NPC_UNIFORM_NOT_A_DUPLICATE';
  end if;

  -- Lock the union of old and new claims in one consistent order. Updating the key row
  -- serializes even two first claims of the same image (and rejects stale snapshots).
  for image in
    select asset from unnest(p_active_images) asset where asset is not null
    union select c.image_url from app_private.npc_appearance_claims c where c.npc_id=p_id
    order by 1
  loop
    insert into app_private.npc_appearance_claim_keys(image_url) values(image)
    on conflict (image_url) do update set image_url=excluded.image_url;

    if image=any(p_active_images) then
      select exists(select 1 from app_private.npc_appearance_claims c where c.image_url=image and c.npc_id=p_id),
        exists(select 1 from app_private.npc_appearance_claims c where c.image_url=image and c.npc_id<>p_id)
        into already_owned,taken;
      if p_allow_uniform and image=p_uniform_image and (already_owned or not taken) then
        raise exception using errcode='22023', message='NPC_UNIFORM_NOT_A_DUPLICATE';
      end if;
      if not already_owned then
        if taken and not (p_allow_uniform and image=p_uniform_image) then
          raise exception using errcode='PT409', message='NPC_APPEARANCE_ALREADY_ACTIVE';
        end if;
        insert into app_private.npc_appearance_claims(image_url,npc_id) values(image,p_id);
      end if;
    else
      delete from app_private.npc_appearance_claims c where c.image_url=image and c.npc_id=p_id;
      delete from app_private.npc_appearance_claim_keys k where k.image_url=image
        and not exists(select 1 from app_private.npc_appearance_claims c where c.image_url=image);
    end if;
  end loop;
end; $$;

create function app_private.write_master_npc_design_v2(
  p_actor_user_id uuid,p_selected_character_id uuid,p_id uuid,p_expected_revision bigint,p_kind text,p_draft jsonb,p_uniform_reason text
)
returns jsonb language plpgsql set search_path='' as $$
declare current_row app_private.npc_designs%rowtype;
declare identity jsonb;
declare next_arena jsonb;
declare next_world jsonb;
declare next_story jsonb;
declare audit_subject text;
declare use_name text;
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_selected_character_id,'npc.manage');
  if p_uniform_reason is not null then
    if not exists(select 1 from app_private.master_panel_role_assignments a
      where a.user_id=p_actor_user_id and a.role='game-owner' and a.enabled) then
      raise exception using errcode='42501', message='NPC_UNIFORM_OWNER_REQUIRED';
    end if;
    if p_kind not like 'commit-%' or p_uniform_reason !~ '[^[:space:]]'
      or char_length(btrim(p_uniform_reason)) not between 1 and 240 then
      raise exception using errcode='22023', message='NPC_UNIFORM_INVALID';
    end if;
  end if;
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
        perform app_private.sync_npc_appearance_claims_v2(p_id,
          array[next_arena->>'imageUrl',next_world->>'imageUrl',next_story->>'imageUrl'],
          case when p_uniform_reason is not null then current_row.draft->>'imageUrl' end,
          p_uniform_reason is not null);
      end if;
      update app_private.npc_designs set
        draft=case when p_kind='save' then p_draft else draft end,
        arena=next_arena, world=next_world, story=next_story, revision=revision+1, updated_at=clock_timestamp()
      where id=p_id returning * into current_row;
      if p_kind <> 'save' then
        insert into app_private.master_panel_activity(actor,action,subject) values(
          app_private.master_activity_actor_v1(p_actor_user_id,p_selected_character_id),
          (case when p_kind like 'commit-%' then 'Committed ' else 'Retired ' end)||initcap(use_name)||' NPC',
          audit_subject
        );
        if p_uniform_reason is not null then
          insert into app_private.npc_appearance_uniform_approvals(npc_id,revision,image_url,approved_use,approved_by,reason)
          values(p_id,current_row.revision,current_row.draft->>'imageUrl',use_name,p_actor_user_id,btrim(p_uniform_reason));
          insert into app_private.master_panel_activity(actor,action,subject,detail) values(
            app_private.master_activity_actor_v1(p_actor_user_id,p_selected_character_id),
            'Approved exact NPC appearance', audit_subject || ' · ' || p_id::text, btrim(p_uniform_reason)
          );
        end if;
      end if;
    elsif p_uniform_reason is not null then
      raise exception using errcode='22023', message='NPC_UNIFORM_NOT_A_DUPLICATE';
    end if;
  end if;
  return jsonb_build_object('id',current_row.id,'revision',current_row.revision,'draft',current_row.draft,
    'arena',current_row.arena,'world',current_row.world,'story',current_row.story);
end; $$;

-- Retain the current entrypoint for ordinary saves, publishing and retirement.
create or replace function public.write_master_npc_design_v1(
  p_actor_user_id uuid,p_actor_character_id uuid,p_id uuid,p_expected_revision bigint,p_kind text,p_draft jsonb
) returns jsonb language sql security definer set search_path='' as $$
  select app_private.write_master_npc_design_v2(
    p_actor_user_id,p_actor_character_id,p_id,p_expected_revision,p_kind,p_draft,null
  );
$$;

create function public.commit_master_npc_uniform_v1(
  p_actor_user_id uuid,p_actor_character_id uuid,p_id uuid,p_expected_revision bigint,p_use text,p_reason text
) returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_reason is null then
    raise exception using errcode='22023', message='NPC_UNIFORM_INVALID';
  end if;
  return app_private.write_master_npc_design_v2(
    p_actor_user_id,p_actor_character_id,p_id,p_expected_revision,'commit-'||p_use,null,p_reason
  );
end; $$;

create function public.find_master_npc_appearance_conflicts_v1(
  p_actor_user_id uuid,p_actor_character_id uuid,p_image_urls text[]
) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  perform app_private.assert_master_page_v1(p_actor_user_id,p_actor_character_id,'npc.manage');
  if p_image_urls is null or cardinality(p_image_urls) not between 1 and 64
    or exists(select 1 from unnest(p_image_urls) asset
      where asset is null or not app_private.valid_npc_appearance_v1(to_jsonb(asset))) then
    raise exception using errcode='22023', message='NPC_APPEARANCE_LOOKUP_INVALID';
  end if;
  return coalesce((select jsonb_agg(k.image_url order by k.image_url)
    from (select distinct c.image_url from app_private.npc_appearance_claims c where c.image_url=any(p_image_urls)) k), '[]'::jsonb);
end; $$;

revoke all on function app_private.sync_npc_appearance_claims_v2(uuid,text[],text,boolean),
  app_private.write_master_npc_design_v2(uuid,uuid,uuid,bigint,text,jsonb,text),
  public.commit_master_npc_uniform_v1(uuid,uuid,uuid,bigint,text,text),
  public.find_master_npc_appearance_conflicts_v1(uuid,uuid,text[])
  from public,anon,authenticated,service_role;
grant execute on function public.commit_master_npc_uniform_v1(uuid,uuid,uuid,bigint,text,text),
  public.find_master_npc_appearance_conflicts_v1(uuid,uuid,text[]) to service_role;
commit;
