#!/usr/bin/env bash
set -euo pipefail

db_container="$(docker ps --filter 'name=supabase_db_' --format '{{.Names}}' | head -n 1)"
test -n "$db_container"

journal_table="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select (to_regclass('app_private.battle_privacy_journal') is not null)::text;")"
test "$journal_table" = 'true'

journal_rpc="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select (to_regprocedure('public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)') is not null)::text;")"
test "$journal_rpc" = 'true'

privileges="$(docker exec "$db_container" psql -U postgres -d postgres -Atqc "
  select
    has_table_privilege('anon','app_private.battle_privacy_journal','SELECT')::text || '|' ||
    has_table_privilege('authenticated','app_private.battle_privacy_journal','SELECT')::text || '|' ||
    has_function_privilege('anon','public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)','EXECUTE')::text || '|' ||
    has_function_privilege('authenticated','public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)','EXECUTE')::text || '|' ||
    has_function_privilege('service_role','public.commit_battle_intent_v3(text,uuid,text,uuid,uuid,bigint,jsonb,jsonb,jsonb)','EXECUTE')::text;")"
test "$privileges" = 'false|false|false|false|true'
