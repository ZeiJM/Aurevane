begin;

-- Version 3 has a real cuff and either a separate lower garment or original trousers.
-- Its supported tops are the v2 set with the bare-armed bolero excluded. Reuse v2's
-- parser for the shared parts, substituting a known valid lower layer for original.
create function app_private.valid_cuff_appearance_url_v1(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_url ~ '^/api/media/appearance/3/[a-z]+(\.[a-z]+){13}/neutral\.svg$'
    and (
      select length(split_part(p_url,'/',6)) <= 140
        and parts[5] <> 'bolero'
        and parts[14] in ('folded','flared','braced')
        and app_private.valid_lower_garment_appearance_url_v1(
          '/api/media/appearance/2/' || array_to_string(parts[1:12], '.') || '.' ||
          case when parts[13] = 'original' then 'wraps' else parts[13] end ||
          '/neutral.svg'
        )
      from (select string_to_array(split_part(p_url,'/',6),'.') parts) recipe
    ), false);
$$;
revoke all on function app_private.valid_cuff_appearance_url_v1(text)
  from public, anon, authenticated, service_role;

create or replace function app_private.valid_npc_appearance_v1(value jsonb)
returns boolean language sql immutable set search_path = '' as $$
  select value is null or value = 'null'::jsonb or coalesce(
    jsonb_typeof(value) = 'string' and (
      (value #>> '{}') ~ '^/api/media/appearance/1/[a-z0-9.]{1,140}/neutral\.svg$'
      or app_private.valid_lower_garment_appearance_url_v1(value #>> '{}')
      or app_private.valid_cuff_appearance_url_v1(value #>> '{}')
    ), false
  );
$$;

-- Update only the URL allowlist. Preserve revision, uniqueness, locks, activation and grants.
do $migration$
declare
  body text := pg_get_functiondef('public.commit_character_appearance_v2(uuid,uuid,integer,text)'::regprocedure);
  predecessor text := 'not app_private.valid_lower_garment_appearance_url_v1(p_image_url)';
begin
  if strpos(body, predecessor) = 0 then
    raise exception 'APPEARANCE_CUFF_PREDECESSOR_MISSING';
  end if;
  execute replace(body, predecessor,
    predecessor || ' and not app_private.valid_cuff_appearance_url_v1(p_image_url)');
end;
$migration$;

commit;
