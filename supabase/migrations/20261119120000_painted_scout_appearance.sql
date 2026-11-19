begin;

create function app_private.valid_painted_appearance_url_v1(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(
    p_url ~ '^/api/media/appearance/4/[a-z]+(\.[a-z]+){8}/neutral\.svg$'
    and parts[1] in ('scout','ranger','guard','elder')
    and parts[2] in ('none','compass','pine','hawkmantle','shearling','scarf')
    and parts[4] in ('none','utility','mapcase','potions','bedroll')
    and parts[6] in ('none','arcanist','bandana')
    and parts[8] in ('none','eyepatch','goggles')
    and array[parts[3],parts[5],parts[7],parts[9]] <@ array[
      'natural','charcoal','ocean','teal','ice','cobalt','plum','rose','crimson','ember','amber',
      'ochre','pine','sage','ivory'
    ]
    and (parts[2] <> 'none' or parts[3] = 'natural')
    and (parts[4] <> 'none' or parts[5] = 'natural')
    and (parts[6] <> 'none' or parts[7] = 'natural')
    and (parts[8] <> 'none' or parts[9] = 'natural'), false)
  from (select string_to_array(split_part(p_url, '/', 6), '.') parts) recipe;
$$;
revoke all on function app_private.valid_painted_appearance_url_v1(text)
  from public, anon, authenticated, service_role;

create or replace function app_private.valid_npc_appearance_v1(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select value is null or value = 'null'::jsonb or coalesce(
    jsonb_typeof(value) = 'string' and (
      (value #>> '{}') ~ '^/api/media/appearance/1/[a-z0-9.]{1,140}/neutral\.svg$'
      or app_private.valid_lower_garment_appearance_url_v1(value #>> '{}')
      or app_private.valid_cuff_appearance_url_v1(value #>> '{}')
      or app_private.valid_painted_appearance_url_v1(value #>> '{}')
    ), false
  );
$$;

-- Creation and Account already call this guarded writer through their current
-- transactions. Widen its URL validation, preserving design claims and accounting.
do $migration$
declare
  definition text := pg_get_functiondef('public.commit_character_appearance_v2(uuid,uuid,integer,text)'::regprocedure);
  predecessor constant text := 'not app_private.valid_cuff_appearance_url_v1(p_image_url)';
begin
  if length(definition) - length(replace(definition, predecessor, '')) <> length(predecessor) then
    raise exception 'PAINTED_APPEARANCE_PREDECESSOR_MISSING';
  end if;
  execute replace(definition, predecessor,
    predecessor || ' and not app_private.valid_painted_appearance_url_v1(p_image_url)');
end;
$migration$;

commit;
