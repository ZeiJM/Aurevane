-- The server store reads and CAS-updates this singleton through PostgREST.
-- RLS bypass does not confer table privileges when automatic grants are disabled.
begin;
revoke all on table public.site_music_configuration from public, anon, authenticated, service_role;
grant select, update on table public.site_music_configuration to service_role;
commit;
