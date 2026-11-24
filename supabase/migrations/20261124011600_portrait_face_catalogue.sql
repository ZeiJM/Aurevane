begin;

-- The previous validator still owns every garment, dye, URL-length and expression rule.
do $migration$
declare
  source text := pg_get_functiondef('app_private.valid_painted_player_look_url_v1(text)'::regprocedure);
begin
  if to_regprocedure('app_private.valid_original_player_look_url_v1(text)') is not null
     or strpos(source, 'app_private.valid_painted_wardrobe_url_v1') = 0 then
    raise exception 'PAINTED_FACE_PREDECESSOR';
  end if;
  execute replace(source, 'FUNCTION app_private.valid_painted_player_look_url_v1(',
                          'FUNCTION app_private.valid_original_player_look_url_v1(');
end;
$migration$;

revoke all on function app_private.valid_original_player_look_url_v1(text)
  from public, anon, authenticated, service_role;

create or replace function app_private.valid_painted_player_look_url_v1(p_url text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  recipe text := split_part(p_url, '/', 6);
  face text := split_part(recipe, '.', 1);
  rig text;
  ordinal integer;
  normalised text := p_url;
begin
  if p_url is null or p_url not like '/api/media/appearance/6/%' or length(recipe) > 140 then
    return false;
  end if;
  if face ~ '^[fm](0[1-9]|[1-5][0-9]|6[0-4])$' then
    ordinal := substring(face from 2)::integer;
    rig := case when left(face, 1) = 'f'
      then (array['pinescout','ranger'])[1 + (ordinal-1) % 2]
      else (array['scout','guard','elder'])[1 + (ordinal-1) % 3] end;
  elsif face in ('fitpinescout','fitranger','fitscout','fitguard','fitelder') then
    rig := substring(face from 4);
  end if;
  if rig is not null then
    normalised := regexp_replace(normalised, '^/api/media/appearance/6/[^.]+[.]',
      '/api/media/appearance/6/' || rig || '.');
  end if;
  normalised := regexp_replace(normalised,
    '[.](parchment|midnight|pinegreen|plumstudio|terracotta|pearl|garnetstudio|tealstudio|amberstudio|lavender)/neutral[.]svg$',
    '.original/neutral.svg');
  return app_private.valid_original_player_look_url_v1(normalised);
end;
$$;
revoke all on function app_private.valid_painted_player_look_url_v1(text)
  from public, anon, authenticated, service_role;
commit;
