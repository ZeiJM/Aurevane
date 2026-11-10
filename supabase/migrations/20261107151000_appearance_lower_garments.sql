begin;

-- Keep both existing approval contracts and the old immutable asset URLs. A v2
-- URL requires a compatible short top and a real, non-default lower garment.
create function app_private.valid_lower_garment_appearance_url_v1(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_url ~ '^/api/media/appearance/2/[a-z]+(\.[a-z]+){12}/neutral\.svg$' and (
    select parts[1] in ('slight','average','broad')
      and parts[2] in ('light','tan','brown','deep')
      and parts[3] in ('crop','swept','braid','curls')
      and parts[4] in ('onyx','oak','copper','silver')
      and parts[5] in ('bolero','brigandine','cuirass','waistcoat','lamellar','doublet','jackcoat')
      and parts[6] in ('open','standing','fur')
      and parts[7] in ('close','puffed','split')
      and not (parts[7] = 'puffed' and parts[5] in ('brigandine','cuirass','lamellar','jackcoat'))
      and parts[8] in ('buttons','lacing','clasps')
      and parts[9] in ('plain','split','pointed')
      and parts[10] in ('linen','brocade','quilt')
      and parts[11] in ('none','satchel','scarf','brooch')
      and parts[12] in ('pine','garnet','indigo','saffron','slate','ivory')
      and parts[13] in ('wraps','breeches','wideleg','kilt','apron','divided','greaves','shorts')
    from (select string_to_array(split_part(p_url,'/',6),'.') parts) recipe
  ), false);
$$;
revoke all on function app_private.valid_lower_garment_appearance_url_v1(text)
  from public, anon, authenticated, service_role;

create or replace function app_private.valid_npc_appearance_v1(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select value is null or value = 'null'::jsonb or coalesce(
    jsonb_typeof(value) = 'string' and (
      (value #>> '{}') ~ '^/api/media/appearance/1/[a-z0-9.]{1,140}/neutral\.svg$'
      or app_private.valid_lower_garment_appearance_url_v1(value #>> '{}')
    ), false
  );
$$;

-- Keep the existing locks, revision, pending activation and claim logic intact.
do $migration$
declare
  body text := pg_get_functiondef('public.commit_character_appearance_v2(uuid,uuid,integer,text)'::regprocedure);
  predecessor text := $old$p_image_url !~ '^/api/media/appearance/1/[a-z]+(\.[a-z]+){11}/neutral\.svg$'$old$;
begin
  if strpos(body, predecessor) = 0 then
    raise exception 'APPEARANCE_LOWER_GARMENT_PREDECESSOR_MISSING';
  end if;
  execute replace(body, predecessor,
    '(' || predecessor || ' and not app_private.valid_lower_garment_appearance_url_v1(p_image_url))');
end;
$migration$;

commit;
