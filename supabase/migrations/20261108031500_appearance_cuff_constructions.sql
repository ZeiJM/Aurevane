begin;

-- Keep existing v3 URLs and activation semantics. Expand the allowed cuff IDs only.
create or replace function app_private.valid_cuff_appearance_url_v1(p_url text)
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(p_url ~ '^/api/media/appearance/3/[a-z]+(\.[a-z]+){13}/neutral\.svg$'
    and (
      select length(split_part(p_url,'/',6)) <= 140
        and parts[5] <> 'bolero'
        and parts[14] in ('folded','flared','braced','wrapped','laced','laminated','splitbell','gauntlet','scalloped')
        and app_private.valid_lower_garment_appearance_url_v1(
          '/api/media/appearance/2/' || array_to_string(parts[1:12], '.') || '.' ||
          case when parts[13] = 'original' then 'wraps' else parts[13] end ||
          '/neutral.svg'
        )
      from (select string_to_array(split_part(p_url,'/',6),'.') parts) recipe
    ), false);
$$;

commit;
