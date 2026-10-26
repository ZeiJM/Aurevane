-- Reusable songs share the existing Owner-authorized configuration CAS transaction.
-- Keep assigned tracks (including retained silent selections) available on upgrade.
begin;
alter table public.site_music_configuration
  add column song_library jsonb not null default '[]'::jsonb
  check (jsonb_typeof(song_library) = 'array' and jsonb_array_length(song_library) <= 200);

update public.site_music_configuration as configuration
set song_library = (
  select coalesce(jsonb_agg(song order by position), '[]'::jsonb)
  from (
    select distinct on (song ->> 'url') song, position
    from (
      select configuration.default_track as song, 0::bigint as position
      union all
      select entry -> 'track', ordinality
      from jsonb_array_elements(configuration.route_overrides) with ordinality as overrides(entry, ordinality)
    ) as assigned
    order by song ->> 'url', position
  ) as unique_songs
);
-- No browser/client grants: the prior service-only SELECT/UPDATE ACL and RLS remain.
commit;
