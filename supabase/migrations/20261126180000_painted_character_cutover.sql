begin;

set local lock_timeout = '5s';

-- Freeze the approved release catalogue for this one-time migration.
create temporary table cutover_painted_looks (
  url text primary key,
  gender text not null,
  alternate_dye boolean not null,
  available boolean not null default true
) on commit drop;

insert into cutover_painted_looks (url, gender, alternate_dye)
select '/api/media/appearance/6/' || recipe || '.' || backdrop || '/neutral.svg',
       gender, alternate_dye
from (values
  ('feminine', 'f32.pine.natural.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', false),
  ('feminine', 'f32.pine.charcoal.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.ocean.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.teal.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.ice.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.cobalt.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.plum.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.rose.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.crimson.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.ember.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.amber.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.ochre.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.pine.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.sage.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.ivory.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.ink.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.pewter.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.silver.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.linen.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.cream.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.straw.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.clay.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.rust.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.leather.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.walnut.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.oxblood.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.wine.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.violet.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.lilac.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.midnight.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.denim.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.rain.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.glacier.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.lagoon.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.mint.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.cedar.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.olive.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.fern.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.moss.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.gold.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.buttercup.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.coral.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.shell.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.garnet.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('feminine', 'f32.pine.carmine.none.natural.none.natural.none.natural.natural.natural.layers.natural.natural', true),
  ('masculine', 'm02.shearling.natural.none.natural.none.natural.none.natural.broad.natural.curls.natural.natural.beard-boxed', false),
  ('feminine', 'f31keen.brocade.natural.none.natural.none.natural.none.natural.slight.natural.silkwave.natural.natural', false),
  ('feminine', 'f05.none.natural.none.natural.none.natural.scholarlenses.natural.slight.natural.pixie.natural.natural', false),
  ('feminine', 'f04.brigandine.natural.none.natural.tidecirclet.natural.none.natural.strong.natural.longbraid.natural.natural', false),
  ('masculine', 'm01.scarf.natural.none.natural.none.natural.none.natural.lean.natural.shag.silver.natural.scar-cross', false),
  ('masculine', 'm21keen.hooded.natural.mapcase.natural.wayfarercap.natural.none.natural.natural.natural.curtain.natural.natural.beard-goatee.age-elder', false),
  ('masculine', 'm10.quilted.natural.utility.natural.none.natural.none.natural.strong.natural.curls.natural.natural', false),
  ('feminine', 'f12.compass.natural.mapcase.natural.none.natural.none.natural.natural.natural.coils.natural.natural', false),
  ('feminine', 'f12.compass.natural.mapcase.natural.none.natural.none.natural.natural.natural.lowpony.natural.natural', false)
) as looks(gender, recipe, alternate_dye)
cross join unnest(array['original', 'parchment', 'midnight', 'pinegreen', 'plumstudio', 'terracotta', 'pearl', 'garnetstudio', 'tealstudio', 'amberstudio', 'lavender', 'wavejade', 'waveindigo', 'latticegold', 'latticeplum', 'starsapphire', 'stargeranium', 'leavesfern', 'leavescopper', 'tilepearl', 'tileteal', 'astral', 'nebula', 'starvault', 'lunar', 'orchard', 'cinder', 'meridian', 'silverlake', 'violet', 'shattered', 'hourless', 'moongateway', 'prestigesanctum', 'starfall', 'verdant', 'frost', 'ember', 'hollow', 'glasswind', 'umbral', 'gildroot', 'vigil', 'coastroad', 'crownroad', 'easternmarch', 'emberroad', 'embervalley', 'frostvalley', 'glasswindoasis', 'highlandroad', 'hollowruins', 'northernpass', 'oldcoast', 'caravan', 'starfallbasin', 'umbralroad', 'verdantvale', 'crown', 'crownbasin', 'asterwake', 'lanternharbor', 'steps', 'haven', 'wayfarergate', 'citadel', 'enchantedarena', 'lanternhall', 'archive', 'battlehall', 'cloister']) as setting(backdrop);

create temporary table cutover_portrait_gender (
  ref text primary key,
  gender text not null
) on commit drop;

insert into cutover_portrait_gender values
  ('portrait.adventure.male-01', 'masculine'),
  ('portrait.adventure.male-02', 'masculine'),
  ('portrait.adventure.male-03', 'masculine'),
  ('portrait.adventure.male-04', 'masculine'),
  ('portrait.adventure.male-05', 'masculine'),
  ('portrait.adventure.male-06', 'masculine'),
  ('portrait.adventure.male-07', 'masculine'),
  ('portrait.adventure.male-08', 'masculine'),
  ('portrait.adventure.male-09', 'masculine'),
  ('portrait.adventure.male-10', 'masculine'),
  ('portrait.adventure.male-11', 'masculine'),
  ('portrait.adventure.male-12', 'masculine'),
  ('portrait.adventure.female-01', 'feminine'),
  ('portrait.adventure.female-02', 'feminine'),
  ('portrait.adventure.female-03', 'feminine'),
  ('portrait.adventure.female-04', 'feminine'),
  ('portrait.adventure.female-05', 'feminine'),
  ('portrait.adventure.female-06', 'feminine'),
  ('portrait.adventure.female-07', 'feminine'),
  ('portrait.adventure.female-08', 'feminine'),
  ('portrait.adventure.female-09', 'feminine'),
  ('portrait.adventure.female-10', 'feminine'),
  ('portrait.adventure.female-11', 'feminine'),
  ('portrait.adventure.female-12', 'feminine'),
  ('portrait.starter.wayfarer-03', 'masculine'),
  ('portrait.starter.wayfarer-04', 'masculine'),
  ('portrait.starter.wayfarer-08', 'masculine'),
  ('portrait.starter.wayfarer-10', 'masculine'),
  ('portrait.starter.wayfarer-13', 'masculine'),
  ('portrait.starter.wayfarer-14', 'masculine'),
  ('portrait.starter.wayfarer-15', 'masculine'),
  ('portrait.starter.wayfarer-22', 'masculine'),
  ('portrait.starter.wayfarer-27', 'masculine'),
  ('portrait.starter.wayfarer-29', 'masculine'),
  ('portrait.starter.wayfarer-33', 'masculine'),
  ('portrait.starter.wayfarer-40', 'masculine'),
  ('portrait.starter.wayfarer-02', 'feminine'),
  ('portrait.starter.wayfarer-05', 'feminine'),
  ('portrait.starter.wayfarer-06', 'feminine'),
  ('portrait.starter.wayfarer-07', 'feminine'),
  ('portrait.starter.wayfarer-09', 'feminine'),
  ('portrait.starter.wayfarer-11', 'feminine'),
  ('portrait.starter.wayfarer-16', 'feminine'),
  ('portrait.starter.wayfarer-17', 'feminine'),
  ('portrait.starter.wayfarer-21', 'feminine'),
  ('portrait.starter.wayfarer-23', 'feminine'),
  ('portrait.starter.wayfarer-26', 'feminine'),
  ('portrait.starter.wayfarer-30', 'feminine');

create function pg_temp.cutover_gender(p_presentation text, p_url text, p_portrait text)
returns text language sql stable set search_path = '' as $$
  select coalesce(
    case lower(p_presentation)
      when 'feminine' then 'feminine' when 'female' then 'feminine'
      when 'masculine' then 'masculine' when 'male' then 'masculine'
    end,
    case
      when p_url ~ '^/api/media/appearance/[456]/(f[0-9]{2}(soft|keen)?|(fit)?(pinescout|ranger))[.]'
        then 'feminine'
      when p_url ~ '^/api/media/appearance/[456]/(m[0-9]{2}(soft|keen)?|(fit)?(scout|guard|elder))[.]'
        then 'masculine'
    end,
    (select gender from pg_temp.cutover_portrait_gender where ref = p_portrait)
  );
$$;

create function pg_temp.cutover_draw_painted_look(p_gender text)
returns text language plpgsql set search_path = '' as $$
declare chosen text;
begin
  update pg_temp.cutover_painted_looks
  set available = false
  where url = (
    select url from pg_temp.cutover_painted_looks
    where available and (p_gender is null or gender = p_gender)
    order by alternate_dye, random()
    limit 1
  )
  returning url into chosen;
  if chosen is null then
    raise exception 'PAINTED_APPEARANCE_POOL_EXHAUSTED: %', coalesce(p_gender, 'unspecified');
  end if;
  return chosen;
end;
$$;

-- Keep ownership, appearance revisions and published NPC claims stable during assignment.
lock table public.characters, public.character_profile_display, app_private.npc_designs
  in share row exclusive mode;

do $cutover$
declare
  player record;
  npc record;
  current_url text;
  queued_url text;
  charge_url text;
  gender text;
  replacement text;
  documents jsonb[];
  idx integer;
begin
  if exists (
    select 1 from pg_temp.cutover_painted_looks
    where not app_private.valid_painted_player_look_url_v1(url)
      or not app_private.valid_npc_appearance_v1(to_jsonb(url))
  ) then
    raise exception 'PAINTED_APPEARANCE_CUTOVER_INVALID_CATALOGUE';
  end if;

  update pg_temp.cutover_painted_looks set available = false
  where url in (
    select appearance_image_url from public.character_profile_display
    union select pending_appearance_image_url from public.character_profile_display
    union select image_url from app_private.npc_appearance_claims
  );

  for player in
    select c.id, c.user_id, c.presentation_id, c.portrait_ref,
           coalesce(d.appearance_revision, 0) as revision,
           d.appearance_image_url, d.pending_appearance_image_url,
           active.url is null as convert_active,
           d.pending_appearance_image_url is not null and queued.url is null as convert_pending
    from public.characters c
    left join public.character_profile_display d on d.character_id = c.id
    left join pg_temp.cutover_painted_looks active on active.url = d.appearance_image_url
    left join pg_temp.cutover_painted_looks queued on queued.url = d.pending_appearance_image_url
    where (active.url is null or (d.pending_appearance_image_url is not null and queued.url is null))
      and not exists (
        select 1 from app_private.character_deletion_requests deletion where deletion.character_id = c.id
      )
    order by c.user_id, c.id
  loop
    gender := pg_temp.cutover_gender(
      player.presentation_id,
      coalesce(player.appearance_image_url, player.pending_appearance_image_url),
      player.portrait_ref
    );
    current_url := player.appearance_image_url;
    queued_url := player.pending_appearance_image_url;
    if player.convert_active then
      current_url := pg_temp.cutover_draw_painted_look(gender);
    end if;
    if player.convert_pending then
      queued_url := pg_temp.cutover_draw_painted_look(
        coalesce(pg_temp.cutover_gender(player.presentation_id, queued_url, null), gender)
      );
    end if;
    charge_url := case when player.convert_active then current_url else queued_url end;
    -- Charge once using the existing inventory authority. Restore the intended
    -- live and queued assignment even if the normal commit queued during battle.
    -- Battle participants retain their captured portraits.
    perform public.commit_character_appearance_v4(
      player.user_id, player.id, player.revision, charge_url
    );
    update public.character_profile_display d
    set appearance_image_url = current_url,
        pending_appearance_image_url = queued_url,
        updated_at = clock_timestamp()
    where d.character_id = player.id
      and (d.appearance_image_url is distinct from current_url
           or d.pending_appearance_image_url is distinct from queued_url);
  end loop;

  for npc in select id, revision, draft, world, arena, story from app_private.npc_designs order by id
  loop
    documents := array[npc.draft, npc.world, npc.arena, npc.story];
    gender := null;
    replacement := null;
    for idx in 1..4 loop
      if documents[idx] is null or
         (idx = 1 and coalesce(btrim(documents[idx]->>'name'), '') = ''
          and documents[idx]->>'imageUrl' is null and documents[idx]->>'portraitRef' is null) then
        continue;
      end if;
      gender := coalesce(gender, pg_temp.cutover_gender(
        null, documents[idx]->>'imageUrl', documents[idx]->>'portraitRef'
      ));
    end loop;
    for idx in 1..4 loop
      if documents[idx] is null or
         (idx = 1 and coalesce(btrim(documents[idx]->>'name'), '') = ''
          and documents[idx]->>'imageUrl' is null and documents[idx]->>'portraitRef' is null)
         or exists (select 1 from pg_temp.cutover_painted_looks where url = documents[idx]->>'imageUrl')
      then
        continue;
      end if;
      if replacement is null then
        replacement := pg_temp.cutover_draw_painted_look(gender);
      end if;
      documents[idx] := jsonb_set(documents[idx], '{imageUrl}', to_jsonb(replacement));
      if idx > 1 then
        documents[idx] := jsonb_set(documents[idx], '{revision}', to_jsonb(npc.revision + 1));
      end if;
    end loop;
    if replacement is null then
      continue;
    end if;
    perform app_private.sync_npc_appearance_claims_v2(
      npc.id, array[documents[2]->>'imageUrl', documents[3]->>'imageUrl', documents[4]->>'imageUrl'],
      null, false
    );
    update app_private.npc_designs
    set draft = documents[1], world = documents[2], arena = documents[3], story = documents[4],
        revision = npc.revision + 1, updated_at = clock_timestamp()
    where id = npc.id;
  end loop;
end;
$cutover$;

drop function pg_temp.cutover_draw_painted_look(text);
drop function pg_temp.cutover_gender(text, text, text);

commit;
