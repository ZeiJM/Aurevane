begin;

-- Keep a single identity for a look. Rendering revisions are chosen by the
-- application and are never part of the appearance stored on a character.
create or replace function app_private.valid_painted_player_look_url_v1(p_url text)
returns boolean language plpgsql immutable set search_path = '' as $$
declare
  recipe text := split_part(p_url, '/', 6);
  parts text[];
  face text;
  backdrop text;
  last_base integer;
  slot integer;
  detail text;
  palette text[] := array['onyx','charcoal','espresso','walnut','chestnut','copper',
    'auburn','ginger','rosewood','honey','ash','flax','silver','platinum','plum','wine',
    'lilac','ocean','teal','moss'];
begin
  if p_url is null or p_url !~ '^/api/media/appearance/6/[a-z0-9.-]{1,225}/neutral[.]svg$' then
    return false;
  end if;

  parts := string_to_array(recipe, '.');
  face := parts[1];
  if face ~ '^([fm](0[1-9]|[1-5][0-9]|6[0-4])|fit(pinescout|ranger|scout|guard|elder))(soft|keen)$' then
    face := regexp_replace(face, '(soft|keen)$', '');
  end if;
  if face ~ '^[fm](0[1-9]|[1-5][0-9]|6[0-4])$' then
    slot := substring(face from 2)::integer - 1;
    face := case when left(face, 1) = 'f'
      then (array['pinescout','ranger'])[1 + slot % 2]
      else (array['scout','guard','elder'])[1 + slot % 3] end;
  elsif face in ('fitpinescout','fitranger','fitscout','fitguard','fitelder') then
    face := substring(face from 4);
  end if;
  parts[1] := face;

  last_base := cardinality(parts) - 1;
  backdrop := parts[last_base + 1];
  if backdrop in (
    'parchment','midnight','pinegreen','plumstudio','terracotta','pearl','garnetstudio',
    'tealstudio','amberstudio','lavender',
    'wavejade','waveindigo','latticegold','latticeplum','starsapphire','stargeranium',
    'leavesfern','leavescopper','tilepearl','tileteal'
  ) then
    backdrop := 'original';
  end if;

  if parts[last_base] ~ '^age-' then
    if parts[last_base] not in ('age-youthful','age-mature','age-elder') then
      return false;
    end if;
    last_base := last_base - 1;
  end if;
  if parts[last_base] ~ '^scar-' then
    if parts[last_base] not in ('scar-cross','scar-cheek','scar-brow','scar-bridge','scar-jaw') then
      return false;
    end if;
    last_base := last_base - 1;
  end if;
  if parts[last_base] ~ '^eye-' then
    if parts[last_base] not in ('eye-brown','eye-amber','eye-hazel','eye-green','eye-blue','eye-gray','eye-violet') then
      return false;
    end if;
    last_base := last_base - 1;
  end if;
  if parts[last_base] ~ '^dye-' then
    if parts[last_base] not in ('dye-tips','dye-split','dye-underlight') then
      return false;
    end if;
    last_base := last_base - 1;
  end if;
  if parts[last_base] ~ '^accent-' then
    detail := substring(parts[last_base] from 8);
    if not detail = any(palette) then return false; end if;
    last_base := last_base - 1;
  end if;
  if parts[last_base] ~ '^beard-' then
    if parts[last_base] not in ('beard-stubble','beard-moustache','beard-goatee','beard-boxed','beard-anchor','beard-full','beard-braided') then
      return false;
    end if;
    last_base := last_base - 1;
  end if;
  if last_base not in (11, 14) then return false; end if;
  if last_base = 14 and parts[12] in (
    'crop','sidepart','pixie','shag','sidefringe','spiked','frosted','brushed','loosequiff',
    'coils','ringlets','curlsweep','coronet','halo','ropebraid','razor','curtain','pageboy',
    'tightbun','loosebun','sidebun','warrior','doublenot','hightwist','highpony','lowpony',
    'sidepony','fishtail','loosebraid','longbraid','twinloops','twinlow','twinribbons',
    'mermaid','softwave','silkwave'
  ) then
    parts[12] := 'feather';
  end if;
  return app_private.valid_original_player_look_url_v1(
    '/api/media/appearance/6/' || array_to_string(parts[1:last_base], '.') ||
      '.' || backdrop || '/neutral.svg'
  );
end;
$$;

revoke all on function app_private.valid_painted_player_look_url_v1(text)
  from public, anon, authenticated, service_role;

commit;
