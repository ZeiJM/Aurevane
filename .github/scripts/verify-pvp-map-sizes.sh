#!/usr/bin/env bash
set -euo pipefail
# Disposable local Supabase only. No remote connection or privileged browser writes.
source .github/scripts/auth-test-helpers.sh
load_test_auth
db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"
email="pvp-map-sizes-${GITHUB_RUN_ID:-local}-${GITHUB_RUN_ATTEMPT:-1}@example.com"
signup="$(signup_test_user "$email" 'Pvp-map-sizes-2026!')"
user_id="$(printf '%s' "$signup" | jq -r '.user.id')"
confirm_test_user "$user_id"
character_id="$(docker exec "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres -Atqc "
 set role service_role;
 select id::text from public.create_character_v3(
 '$user_id'::uuid, 0::smallint, gen_random_uuid(), 'pvp-maps:create:character', 1,
 'Map Profile Tester', 'mapprofiletester', 'androgynous', 'they_them',
 'portrait.starter.wayfarer-01', 'appearance.starter.roadworn', 'vanguard', 12, 4, 7, 4, 3, 6);")"
docker exec -i "$db_container" psql -v ON_ERROR_STOP=1 -U postgres -d postgres <<SQL
begin;
do \$test\$
begin
 if has_function_privilege('anon', 'public.set_pvp_lobby_settings_v2(uuid,uuid,text,text,text,integer)', 'EXECUTE')
 or has_function_privilege('authenticated', 'public.set_pvp_lobby_settings_v2(uuid,uuid,text,text,text,integer)', 'EXECUTE')
 or not has_function_privilege('service_role', 'public.set_pvp_lobby_settings_v2(uuid,uuid,text,text,text,integer)', 'EXECUTE') then
   raise exception 'map settings RPC authority changed';
 end if;
 if has_table_privilege('anon', 'app_private.pvp_lobby_settings', 'INSERT,UPDATE')
 or has_table_privilege('authenticated', 'app_private.pvp_lobby_settings', 'INSERT,UPDATE') then
   raise exception 'browser role can write private map settings';
 end if;
end;
\$test\$;
-- Inspect private rows and simulate an active lobby as local postgres. Production
-- callers retain only the service RPC grants asserted above; no test grants are added.
do \$test\$
declare
 v_user uuid := '$user_id';
 v_character uuid := '$character_id';
 v_lobby uuid;
 v_size text;
 v_before jsonb;
begin
 v_lobby := public.create_pvp_lobby_v1(v_user,v_character,'1v1',null,null);
 if public.get_pvp_lobby_settings_v2(v_user,v_lobby)->>'map_size' is distinct from 'medium' then
   raise exception 'default medium compatibility changed';
 end if;
 foreach v_size in array array['small','medium','large'] loop
   perform public.set_pvp_lobby_ready_v1(v_user,v_lobby,true);
   perform public.set_pvp_lobby_settings_v2(v_user,v_lobby,v_size,'neutral','neutral',60);
   if public.get_pvp_lobby_settings_v2(v_user,v_lobby)->>'map_size' is distinct from v_size then
     raise exception 'map size did not persist: %', v_size;
   end if;
   if exists(select 1 from app_private.pvp_lobby_members where lobby_id=v_lobby and ready) then
     raise exception 'map change did not reset readiness';
   end if;
 end loop;
 v_before := public.get_pvp_lobby_settings_v2(v_user,v_lobby);
 begin
   perform public.set_pvp_lobby_settings_v2(gen_random_uuid(),v_lobby,'small','neutral','neutral',60);
   raise exception 'foreign lobby write allowed';
 exception when insufficient_privilege then
   if sqlerrm <> 'PVP_LOBBY_NOT_AVAILABLE' then raise; end if;
 end;
 foreach v_size in array array['enormous','',null] loop
   begin
     perform public.set_pvp_lobby_settings_v2(v_user,v_lobby,v_size,'neutral','neutral',60);
     raise exception 'invalid map size accepted';
   exception when invalid_parameter_value then
     if sqlerrm <> 'PVP_INVALID_MAP_SETTINGS' then raise; end if;
   end;
 end loop;
 begin
   update app_private.pvp_lobby_settings set map_size='enormous' where lobby_id=v_lobby;
   raise exception 'table accepted an arbitrary map size';
 exception when check_violation then null;
 end;
 if public.get_pvp_lobby_settings_v2(v_user,v_lobby) is distinct from v_before then
   raise exception 'rejected changes altered saved settings';
 end if;
 update app_private.pvp_lobbies set status='active' where id=v_lobby;
 begin
   perform public.set_pvp_lobby_settings_v2(v_user,v_lobby,'small','neutral','neutral',60);
   raise exception 'active battle lobby settings changed';
 exception when insufficient_privilege then
   if sqlerrm <> 'PVP_LOBBY_NOT_AVAILABLE' then raise; end if;
 end;
 if public.get_pvp_lobby_settings_v2(v_user,v_lobby) is distinct from v_before then
   raise exception 'active settings were not pinned';
 end if;
end;
\$test\$;
rollback;
SQL
printf 'PvP map-size persistence, validation, readiness and authority checks passed.\n'
