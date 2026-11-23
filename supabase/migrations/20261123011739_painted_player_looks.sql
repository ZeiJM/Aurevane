begin;

create function app_private.valid_painted_player_look_url_v1(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    p_url like '/api/media/appearance/6/%'
    and length(split_part(p_url, '/', 6)) <= 140
    and substring(p_url from '[.]([a-z]+)/neutral[.]svg$') in (
      'original',
      'astral', 'nebula', 'starvault', 'lunar', 'orchard', 'cinder', 'meridian', 'silverlake',
      'violet', 'shattered', 'hourless', 'moongateway', 'prestigesanctum',
      'starfall', 'verdant', 'frost', 'ember', 'hollow', 'glasswind', 'umbral', 'gildroot', 'vigil',
      'coastroad', 'crownroad', 'easternmarch', 'emberroad', 'embervalley', 'frostvalley',
      'glasswindoasis', 'highlandroad', 'hollowruins', 'northernpass', 'oldcoast', 'caravan',
      'starfallbasin', 'umbralroad', 'verdantvale',
      'crown', 'crownbasin', 'asterwake', 'lanternharbor', 'steps', 'haven', 'wayfarergate',
      'citadel', 'enchantedarena', 'lanternhall', 'archive', 'battlehall', 'cloister'
    )
    and app_private.valid_painted_wardrobe_url_v1(
      regexp_replace(
        regexp_replace(p_url, '[.][a-z]+/neutral[.]svg$', '/neutral.svg'),
        '^/api/media/appearance/6/(pinescout[.])?',
        '/api/media/appearance/5/' ||
          case when split_part(p_url, '/', 6) like 'pinescout.%' then 'scout.' else '' end
      )
    ),
    false
  );
$$;

revoke all on function app_private.valid_painted_player_look_url_v1(text)
  from public, anon, authenticated, service_role;

do $migration$
declare
  patch record;
  definition text;
begin
  for patch in select * from (values
    ('app_private.valid_npc_appearance_v1(jsonb)',
      'or app_private.valid_painted_wardrobe_url_v1(value #>> ''{}'')',
      'or app_private.valid_painted_wardrobe_url_v1(value #>> ''{}'') or app_private.valid_painted_player_look_url_v1(value #>> ''{}'')'),
    ('public.commit_character_appearance_v2(uuid,uuid,integer,text)',
      'and not app_private.valid_painted_wardrobe_url_v1(p_image_url)',
      'and not app_private.valid_painted_wardrobe_url_v1(p_image_url) and not app_private.valid_painted_player_look_url_v1(p_image_url)')
  ) as edits(signature, predecessor, replacement)
  loop
    definition := pg_get_functiondef(patch.signature::regprocedure);
    if length(definition) - length(replace(definition, patch.predecessor, '')) <> length(patch.predecessor) then
      raise exception 'PAINTED_PLAYER_LOOK_PREDECESSOR_MISSING: %', patch.signature;
    end if;
    execute replace(definition, patch.predecessor, patch.replacement);
  end loop;
end;
$migration$;

commit;
