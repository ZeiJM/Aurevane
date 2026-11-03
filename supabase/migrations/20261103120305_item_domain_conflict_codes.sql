begin;

-- Deliberate Item contention/CAS conflicts must reach the caller as HTTP 409.
-- Keep native serialization failures untouched: PostgREST must not retry these
-- application rejections indefinitely. Change only the audited new assignments.
do $migration$
declare
 candidate record;
 d text;
 occurrences integer;
 pattern text:='errcode[[:space:]]*=[[:space:]]*''40001''';
begin
 for candidate in select * from (values
  ('app_private.guard_runtime_item_publication_v1()',1),
  ('app_private.lock_character_item_inventory_v1(uuid,uuid,boolean)',2),
  ('public.grant_character_items_v1(uuid,uuid,bigint,text,jsonb)',1),
  ('public.set_character_item_equipment_v1(uuid,uuid,bigint,jsonb,jsonb,text[])',1),
  ('public.sort_character_item_inventory_v1(uuid,uuid,bigint,text,uuid[])',1),
  ('public.assert_character_item_admission_v1(uuid,uuid,bigint)',1),
  ('public.write_character_items_v1(uuid,uuid,bigint,text,jsonb)',2),
  ('public.grant_master_test_item_v1(uuid,uuid,text,integer,bigint,text,uuid)',1),
  ('app_private.guard_player_battle_admission_v1()',3),
  ('app_private.guard_player_battle_head_admission_v1()',1),
  ('public.start_world_encounter_v1(uuid,uuid,uuid,bigint,bigint,jsonb,jsonb)',2),
  ('app_private.append_battle_startup_events_v1(uuid,jsonb,jsonb,jsonb,jsonb,timestamptz)',1)
 ) as audited(signature,expected_count)
 loop
  d:=pg_get_functiondef(candidate.signature::regprocedure);
  select count(*) into occurrences from regexp_matches(d,pattern,'gi');
  if occurrences<>candidate.expected_count then
   raise exception 'ITEM_DOMAIN_CODE_PREDECESSOR_CONFLICT: %',candidate.signature;
  end if;
  execute regexp_replace(d,pattern,'errcode=''PT409''','gi');
 end loop;
 if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','app_private') and p.prosrc ~* pattern) then
  raise exception 'ITEM_DOMAIN_CODE_UNREVIEWED_PREDECESSOR';
 end if;
end; $migration$;

commit;
