begin;

-- Domain conflicts must reach the caller, whose fresh input can resolve them.
-- PostgREST 14 retries intentional SQLSTATE 40001 indefinitely. Genuine native
-- serialization failures are untouched: only these audited RAISE assignments change.
-- https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions
do $migration$
declare
  candidate record;
  d text;
  occurrences integer;
  pattern text := 'errcode[[:space:]]*=[[:space:]]*''40001''';
begin
  for candidate in select * from (values
    ('app_private.guard_combat_content_admission_v1()',1),
    ('app_private.guard_no_contest_head_v1()',1),
    ('app_private.guard_player_battle_admission_v1()',4),
    ('app_private.guard_player_battle_head_admission_v1()',1),
    ('app_private.lock_combat_content_catalogue_v1(text)',2),
    ('app_private.lock_current_discipline_selection_v1()',1),
    ('public.advance_event_run_phase_v1(uuid, uuid, bigint, uuid, text)',1),
    ('public.advance_event_run_phase_v1(uuid, uuid, uuid, bigint, uuid, text)',1),
    ('public.change_character_disciplines_v2(uuid, uuid, bigint, boolean, text, boolean, text, uuid, text)',3),
    ('public.claim_training_report_v1(text, text, uuid, text, uuid, uuid, uuid)',3),
    ('public.commit_battle_intent_v1(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)',2),
    ('public.commit_battle_intent_v2_inner(text, uuid, text, uuid, uuid, bigint, jsonb, jsonb)',1),
    ('public.commit_character_attribute_allocation_v1(uuid, uuid, text, integer, integer, integer, integer, integer, integer, uuid, text)',2),
    ('public.commit_character_supernatural_story_transition_v1(uuid, uuid, integer, uuid, text, text, integer, text, integer, text, text, text, text, integer, text, integer)',1),
    ('public.commit_combat_content_record_v1(uuid, uuid, text, bigint, jsonb, text, integer)',1),
    ('public.create_base_character_v1(uuid, uuid, text, integer, text, text, text, text, text, text, text, integer, integer, integer, integer)',2),
    ('public.create_battle_session_v1(text, uuid, text, uuid, text, integer, integer, jsonb, jsonb)',1),
    ('public.create_character_v2(uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text, integer, integer, integer, integer)',2),
    ('public.create_character_v3(uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text, integer, integer, integer, integer, integer, integer)',2),
    ('public.create_character_v4(uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer)',3),
    ('public.edit_master_player_v1(uuid, uuid, text, uuid, jsonb, boolean, uuid)',2),
    ('public.execute_foundation_authority_probe(text, uuid, text)',1),
    ('public.grant_character_xp_v1(uuid, uuid, text, text, text, text, text, bigint)',2),
    ('public.publish_event_definition_v1(uuid, text, jsonb, integer)',1),
    ('public.publish_event_definition_v1(uuid, uuid, text, jsonb, integer)',1),
    ('public.publish_saved_combat_content_v1(uuid, uuid, text, bigint, integer, text, integer)',2),
    ('public.recover_master_player_battle_v1(uuid, uuid, uuid, bigint, uuid[], uuid, jsonb, boolean, uuid)',3),
    ('public.save_event_definition_draft_v1(uuid, text, jsonb, integer, bigint)',3),
    ('public.save_event_definition_draft_v1(uuid, uuid, text, jsonb, integer, bigint)',3),
    ('public.save_master_panel_role_defaults_v1(uuid, bigint, jsonb)',1),
    ('public.set_master_panel_character_access_v2(uuid, uuid, uuid, text[], text[], integer, bigint, boolean)',1),
    ('public.set_wayfarers_practice_plan_v1(text, text, uuid, text, uuid, uuid, text)',2),
    ('public.start_world_encounter_v1(uuid, uuid, uuid, bigint, bigint, jsonb, jsonb)',2),
    ('public.transition_event_run_v1(uuid, bigint, uuid, text, text)',1),
    ('public.write_combat_content_record_v1(uuid, uuid, text, jsonb)',5)
  ) as audited(signature,expected_count)
  loop
    d := pg_get_functiondef(candidate.signature::regprocedure);
    select count(*) into occurrences from regexp_matches(d,pattern,'gi');
    if occurrences <> candidate.expected_count then
      raise exception 'DOMAIN_RPC_CODE_PREDECESSOR_CONFLICT: %',candidate.signature;
    end if;
    execute regexp_replace(d,pattern,'errcode=''PT409''','gi');
  end loop;
  if exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname in ('public','app_private') and p.prosrc ~* pattern) then
    raise exception 'DOMAIN_RPC_CODE_UNREVIEWED_PREDECESSOR';
  end if;
end;
$migration$;

commit;
