-- Disposable native CI fixture only. Session settings identify real confirmed users
-- and two real linked characters; production authority is never replaced or stubbed.
set local plpgsql.check_asserts = on;
set local role service_role;
do $$
#variable_conflict use_variable
declare
  owner_id uuid := current_setting('task8.owner')::uuid;
  staff_id uuid := current_setting('task8.staff')::uuid;
  other_id uuid := current_setting('task8.other')::uuid;
  character_id uuid := current_setting('task8.character')::uuid;
  alternate_id uuid := current_setting('task8.alternate')::uuid;
  identity jsonb;
  directory jsonb;
begin
  assert (select roles = array['game-owner'] from public.read_master_panel_access_v1(owner_id)), 'Owner bootstrap';
  assert not exists(select 1 from public.read_master_panel_access_v1(staff_id)), 'Legacy account grant must deny';
  directory := public.list_master_panel_staff_v2(owner_id);
  assert exists(select 1 from jsonb_array_elements(directory) x where x->>'userId'=staff_id::text and x->>'status'='needs-binding'), 'Legacy binding visible';
  assert exists(select 1 from jsonb_array_elements(directory) x where x->>'userId'=owner_id::text and x->>'status'='owner'), 'Protected Owner directory';
  -- Obtain verified identity through the owner-only API, by name and then email.
  identity := public.resolve_master_panel_account_v2(owner_id,current_setting('task8.character_name'));
  assert identity->>'userId'=staff_id::text, 'Verified character identity';
  assert jsonb_array_length(identity->'characters')=2, 'All linked characters';
  assert public.resolve_master_panel_account_v2(owner_id,identity->>'email')=identity, 'Verified email discovery';
  begin
    perform public.resolve_master_panel_account_v1(owner_id,identity->>'email');
    raise exception 'EXPECTED retired management invocation denial';
  exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
  begin
    perform public.set_master_panel_character_access_v2(owner_id,staff_id,character_id,array[]::text[],array['events.global_scope'],null,0,true);
    raise exception 'EXPECTED role-required rejection';
  exception when invalid_parameter_value then
    assert sqlerrm='MASTER_PANEL_ROLE_OR_CAPABILITY_INVALID';
  end;
  assert public.set_master_panel_character_access_v2(owner_id,staff_id,character_id,array['moderator','content-staff'],array[]::text[],null,0,true)=1, 'Initial assignment';
  assert (select roles=array['moderator','content-staff'] and special_capabilities=array[]::text[] from public.read_master_panel_access_v1(staff_id,character_id)), 'Selected grant';
  assert not exists(select 1 from public.read_master_panel_access_v1(staff_id,alternate_id)), 'Owned alternate denial';
  assert not exists(select 1 from public.read_master_panel_access_v1(other_id,character_id)), 'Unowned actor denial';
  assert not exists(select 1 from public.read_master_panel_access_v1(staff_id)), 'Old access signature denial';
  begin
    perform public.read_combat_content_draft_v1(staff_id,'native.staff.skill');
    raise exception 'EXPECTED old protected signature denial';
  exception when insufficient_privilege then
    assert sqlerrm='MASTER_PANEL_OPERATOR_REQUIRED';
  end;
  begin
    perform public.read_combat_content_draft_v1(staff_id,alternate_id,'native.staff.skill');
    raise exception 'EXPECTED alternate protected signature denial';
  exception when insufficient_privilege then
    assert sqlerrm='MASTER_PANEL_OPERATOR_REQUIRED';
  end;
  if to_regprocedure('public.write_combat_content_record_v1(uuid,uuid,text,jsonb)') is not null then
    perform public.write_combat_content_record_v1(staff_id,character_id,'native.staff.skill',jsonb_build_object('action','create','requestId',gen_random_uuid(),'contentKind','skill','definition',jsonb_build_object('id','native.staff.skill')));
  else
    perform public.save_combat_content_draft_v1(staff_id,character_id,'native.staff.skill','skill','{"id":"native.staff.skill"}'::jsonb,null,null);
  end if;
  assert exists(select 1 from public.read_combat_content_draft_v1(staff_id,character_id,'native.staff.skill')), 'Selected protected consumer allow';
  assert exists(select 1 from public.read_combat_content_draft_v1(owner_id,'native.staff.skill')), 'Owner old signature/bootstrap allow';
  begin
    perform public.set_master_panel_character_access_v2(staff_id,other_id,alternate_id,array['event-staff'],array[]::text[],null,0,true);
    raise exception 'EXPECTED delegated management denial';
  exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_OWNER_REQUIRED'; end;
  begin
    perform public.set_master_panel_character_access_v2(owner_id,owner_id,character_id,array['moderator'],array[]::text[],null,0,true);
    raise exception 'EXPECTED protected Owner target denial';
  exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_SELF_OR_OWNER_PROTECTED'; end;
  begin
    perform public.set_master_panel_character_access_v2(owner_id,staff_id,character_id,array['content-staff'],array['staff.manage'],null,1,true);
    raise exception 'EXPECTED root capability denial';
  exception when invalid_parameter_value then assert sqlerrm='MASTER_PANEL_ROLE_OR_CAPABILITY_INVALID'; end;
  begin
    perform public.set_master_panel_character_access_v2(owner_id,staff_id,character_id,array['game-owner'],array[]::text[],null,1,true);
    raise exception 'EXPECTED Owner role delegation denial';
  exception when invalid_parameter_value then assert sqlerrm='MASTER_PANEL_ROLE_OR_CAPABILITY_INVALID'; end;
  perform set_config('task8.assignment_time',statement_timestamp()::text,true);
  assert public.set_master_panel_character_access_v2(owner_id,staff_id,character_id,array['content-staff'],array['events.global_scope'],1,1,true)=2, 'Atomic role/capability update';
  assert (select roles=array['content-staff'] and special_capabilities=array['events.global_scope'] from public.read_master_panel_access_v1(staff_id,character_id)), 'Updated selected grant';
  begin
    perform public.set_master_panel_character_access_v2(owner_id,staff_id,character_id,array['content-staff'],array[]::text[],null,1,true);
    raise exception 'EXPECTED stale Staff CAS denial';
  -- This fixture also runs against the retained pre-domain-code migration chain.
  exception when sqlstate '40001' or sqlstate 'PT409' then assert sqlerrm='MASTER_PANEL_ACCESS_VERSION_CONFLICT'; end;
  directory := public.list_master_panel_staff_v2(owner_id);
  assert exists(select 1 from jsonb_array_elements(directory) x where x->>'characterId'=character_id::text and x->>'accessVersion'='2' and x->>'status'='active'), 'Selected directory revision';
  assert public.set_master_panel_character_access_v2(owner_id,staff_id,character_id,array['content-staff'],array['events.global_scope'],null,2,false)=3, 'Revoke';
  assert not exists(select 1 from public.read_master_panel_access_v1(staff_id,character_id)), 'Immediate revoke';
  begin
    perform public.read_combat_content_draft_v1(staff_id,character_id,'native.staff.skill');
    raise exception 'EXPECTED revoked consumer denial';
  exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_OPERATOR_REQUIRED'; end;
end; $$;
reset role;
do $$
#variable_conflict use_variable
declare
  owner_id uuid := current_setting('task8.owner')::uuid;
  staff_id uuid := current_setting('task8.staff')::uuid;
  other_id uuid := current_setting('task8.other')::uuid;
  character_id uuid := current_setting('task8.character')::uuid;
  signature text;
  table_name text;
  checked integer := 0;
  proc record;
  predecessor text;
  new_actor_signatures text[] := array[]::text[];
  expected_player_denial text := 'MASTER_PANEL_OWNER_REQUIRED';
  probe record;
begin
  begin
    insert into app_private.master_panel_role_assignments(user_id,role,granted_by,note) values(other_id,'game-owner',owner_id,'CI duplicate Owner probe');
    raise exception 'EXPECTED single Owner constraint';
  exception when unique_violation then assert sqlerrm like '%master_panel_single_enabled_game_owner_uq%'; end;
  assert (select count(*)=3 and count(*) filter(where action='role.granted')=2 and count(*) filter(where action='role.revoked')=1 and bool_and(note is null and target_character_id=character_id and after_state is not null) from app_private.master_panel_access_audit where actor_user_id=owner_id and target_user_id=staff_id), 'Private reason-free before/after audit';
  assert (select expires_at-current_setting('task8.assignment_time')::timestamptz=interval '24 hours' from app_private.master_panel_character_access where master_panel_character_access.character_id=character_id), 'Exact UTC day';
  foreach signature in array array[
    'public.grant_master_panel_role_v1(uuid,uuid,text,text)',
    'public.revoke_master_panel_role_v1(uuid,uuid,text,text)',
    'public.grant_master_panel_capability_v1(uuid,uuid,text,text)',
    'public.revoke_master_panel_capability_v1(uuid,uuid,text,text)',
    'public.list_master_panel_staff_v1(uuid)',
    'public.resolve_master_panel_account_v1(uuid,text)'
  ] loop
    assert not has_function_privilege('service_role',signature,'execute'), 'Retired API service denial: '||signature;
    assert not has_function_privilege('authenticated',signature,'execute') and not has_function_privilege('anon',signature,'execute'), 'Retired API browser denial: '||signature;
  end loop;
  -- Exact contracts introduced by the October 27 batch have no uniform predecessor.
  -- Each module marker requires its entire signature set; absent individual functions
  -- cannot silently shrink either the module check or the global actor inventory.
  if to_regclass('app_private.master_moderation_audit') is not null then
    new_actor_signatures := new_actor_signatures || array['public.read_master_panel_activity_v1(uuid,integer,bigint,uuid)','public.set_world_environment_v2(uuid,integer,jsonb,uuid)','public.publish_battlefield_elevation_policy_v2(uuid,integer,jsonb,uuid)','public.publish_battlefield_elevation_policy_v3(uuid,integer,jsonb,uuid)','public.publish_combat_effect_timing_policy_v2(uuid,integer,jsonb,text,uuid)','public.save_site_music_configuration_v1(uuid,uuid,bigint,jsonb)','public.search_master_moderation_players_v1(uuid,text,uuid)','public.read_master_moderation_v1(uuid,uuid,uuid,bigint)','public.write_master_moderation_v1(uuid,uuid,text,text,text,integer,boolean,uuid)','public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text,uuid)']::text[];
  end if;
  if to_regclass('app_private.discipline_player_grants') is not null then
    new_actor_signatures := new_actor_signatures || array['public.search_discipline_grant_players_v1(uuid,uuid,text)','public.read_discipline_player_grants_v1(uuid,uuid,text,uuid)','public.write_discipline_player_grants_v1(uuid,uuid,text,uuid[],text,text)']::text[];
  end if;
  if to_regclass('app_private.usage_balance_sessions') is not null then
    new_actor_signatures := new_actor_signatures || array['public.read_master_usage_balance_v1(uuid,uuid,text)']::text[];
  end if;
  if to_regprocedure('public.read_master_usage_balance_week_v1(uuid,uuid,text,date)') is not null then
    new_actor_signatures := new_actor_signatures || array['public.read_master_usage_balance_week_v1(uuid,uuid,text,date)']::text[];
  end if;
  if to_regclass('app_private.master_panel_navigation') is not null then
    new_actor_signatures := new_actor_signatures || array['public.read_master_panel_navigation_v1(uuid,uuid)','public.save_master_panel_navigation_v1(uuid,bigint,jsonb,uuid)']::text[];
    foreach table_name in array array['master_panel_navigation','master_panel_navigation_audit'] loop
      assert (select relrowsecurity from pg_class where oid=('app_private.'||table_name)::regclass), 'Navigation private RLS';
      assert not has_table_privilege('service_role','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('authenticated','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('anon','app_private.'||table_name,'select,insert,update,delete'), 'Navigation private table ACL';
    end loop;
    assert not has_sequence_privilege('service_role','app_private.master_panel_navigation_audit_id_seq','USAGE,SELECT,UPDATE'), 'Navigation private audit sequence';
  end if;
  if exists(select 1 from pg_attribute where attrelid=to_regclass('app_private.combat_content_records') and attname='deleted_at' and not attisdropped) then
    new_actor_signatures := new_actor_signatures || array['public.review_discipline_deletion_v1(uuid,uuid,text)','public.delete_discipline_v1(uuid,uuid,text,text)']::text[];
  end if;
  if exists(select 1 from pg_attribute where attrelid=to_regclass('app_private.master_moderation_audit') and attname='reviewed_revision' and not attisdropped) then
    new_actor_signatures := new_actor_signatures || array['public.list_active_master_bans_v1(uuid,uuid,uuid)']::text[];
  end if;
  foreach signature in array new_actor_signatures loop
    assert to_regprocedure(signature) is not null, 'Required workspace actor signature: '||signature;
    assert (select 'p_actor_character_id'=any(proargnames) from pg_proc where oid=signature::regprocedure), 'Explicit selected actor contract: '||signature;
    assert not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute'), 'Workspace actor browser ACL: '||signature;
    assert has_function_privilege('service_role',signature,'execute')=(signature<>'public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text,uuid)'), 'Workspace actor service/private-helper ACL: '||signature;
  end loop;
  for proc in select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and 'p_actor_character_id'=any(p.proargnames) and p.oid<>all(array(select to_regprocedure(contract)::oid from unnest(new_actor_signatures) contract)) and p.proname<>all(array['finalize_combat_content_media_v1','read_combat_content_media_v1','search_master_players_v1','read_master_player_v1','edit_master_player_v1','recover_master_player_battle_v1','read_combat_content_record_v1','list_combat_content_records_v1','write_combat_content_record_v1','publish_saved_combat_content_v1','read_event_workspace_catalogue_v1','list_event_workspace_runs_v1','commit_combat_content_record_v1']) loop
    checked := checked+1;
    assert not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Explicit actor browser denial: '||proc.proname;
    if proc.nspname='app_private' then
      assert not has_function_privilege('service_role',proc.oid,'execute'), 'Private assertion ACL: '||proc.proname;
    else
      predecessor := regexp_replace(regexp_replace(regexp_replace(proc.identity,'p_actor_character_id uuid,? *','','g'),', *$',''),'p_\w+ ','','g');
      assert has_function_privilege('service_role',proc.oid,'execute')=has_function_privilege('service_role',proc.nspname||'.'||proc.proname||'('||predecessor||')','execute'), 'Predecessor service ACL: '||proc.proname;
    end if;
  end loop;
  assert checked=33+case when to_regprocedure('public.read_master_panel_access_v2(uuid,uuid)') is null then 0 else 2 end, 'Complete explicit actor ACL inventory';
  -- Event workspace readers are new selected-actor APIs, not legacy overloads.
  if to_regprocedure('public.read_event_workspace_catalogue_v1(uuid,uuid)') is not null then
    foreach signature in array array['public.read_event_workspace_catalogue_v1(uuid,uuid)','public.list_event_workspace_runs_v1(uuid,uuid)'] loop
      assert has_function_privilege('service_role',signature,'execute') and not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute'), 'Event workspace reader ACL';
    end loop;
    foreach signature in array array['select public.read_event_workspace_catalogue_v1($1,$2)','select public.list_event_workspace_runs_v1($1,$2)'] loop
      begin execute signature using staff_id,character_id; raise exception 'EXPECTED revoked Event reader denial';
      exception when insufficient_privilege then assert sqlerrm='EVENT_STAFF_REQUIRED'; end;
      begin execute signature using staff_id,null::uuid; raise exception 'EXPECTED missing Event selected actor denial';
      exception when insufficient_privilege then assert sqlerrm='EVENT_STAFF_REQUIRED'; end;
      execute signature using owner_id,null::uuid;
    end loop;
  end if;
  -- Players retain independent selected-actor contracts; the page migration replaces
  -- their Owner-only assertion while preserving the same negative authority probes.
  if to_regclass('app_private.master_moderation_audit') is not null then expected_player_denial:='MASTER_PANEL_PAGE_ACCESS_REQUIRED'; end if;
  if to_regprocedure('public.read_master_player_v1(uuid,uuid,uuid)') is not null then
    checked:=0;
    for proc in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['search_master_players_v1','read_master_player_v1','edit_master_player_v1','recover_master_player_battle_v1']) and 'p_actor_character_id'=any(p.proargnames) loop
      checked:=checked+1;
      assert has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Players service-only actor ACL: '||proc.proname;
    end loop;
    assert checked=4, 'Independent Players actor ACL inventory';
    -- Execute the real new Owner assertions; no authorization stub or renamed actor.
    foreach signature in array array[
      'select public.search_master_players_v1($1,''native'',$2)',
      'select public.read_master_player_v1($1,$2,$2)',
      'select public.edit_master_player_v1($1,$2,''invalid'',gen_random_uuid(),''{}'',true,$2)',
      'select public.recover_master_player_battle_v1($1,$2,gen_random_uuid(),1,array[$2::uuid],gen_random_uuid(),null,true,$2)'
    ] loop
      begin
        execute signature using staff_id,character_id;
        raise exception 'EXPECTED Players authority denial: %',signature;
      exception when insufficient_privilege then assert sqlerrm=expected_player_denial; end;
    end loop;

  end if;
  if to_regprocedure('public.read_combat_content_record_v1(uuid,uuid,text)') is not null then
    checked:=0;
    for proc in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['read_combat_content_record_v1','list_combat_content_records_v1','write_combat_content_record_v1','publish_saved_combat_content_v1']) and 'p_actor_character_id'=any(p.proargnames) loop
      checked:=checked+1;
      assert has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Content service-only actor ACL: '||proc.proname;
    end loop;
    assert checked=4, 'Independent Content actor ACL inventory';
    checked:=0;
    for proc in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname=any(array['combat_content_used_by_v1','combat_content_record_json_v1','validate_content_record_identity_v1','guard_combat_content_admission_v1','assert_combat_content_current_v1','guard_combat_content_intrinsic_source_v1','validate_noncombat_content_v1','content_nonnegative_integer_v1','validate_content_requirement_v1','validate_content_command_v1','content_reference_targets_v1','index_content_references_v1','combat_content_blockers_v1','combat_content_all_uses_v1','bound_content_links_v1']) loop
      checked:=checked+1;
      assert not has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Content private helper ACL: '||proc.proname;
    end loop;
    assert checked=15, 'Complete Content private helper inventory';
    checked:=0;
    for proc in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname=any(array['current_discipline_definitions_v1','validate_authored_discipline_unlock_v1','validate_authored_discipline_envelope_v1','project_published_discipline_v1','select_published_discipline_v1','authored_discipline_unlock_satisfied_v1','lock_current_discipline_selection_v1','current_resonance_selection_key_v1','current_essence_selection_key_v1','validate_current_discipline_selections_v1','grant_discipline_skill_v1','current_discipline_skill_catalog_v1','character_discipline_skill_availability_v1','default_native_skill_eligibility_v1','resolve_skill_eligibility_v1']) loop
      checked:=checked+1;
      assert not has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Stage B private helper ACL: '||proc.proname;
    end loop;
    assert checked=15, 'Complete Stage B private helper inventory; 30 total with Stage A';
    assert (select count(*)=7 from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and t.tgname='combat_content_admission' and t.tgenabled='O' and t.tgtype=23 and c.relname=any(array['character_skill_unlocks','character_build_discipline_skills','character_saved_build_loadouts','phase4_skill_catalog','character_active_builds','character_attribute_personal_allocations','character_discipline_skill_grants'])), 'All seven real BEFORE INSERT/UPDATE row admission guards';
    foreach table_name in array array['discipline_current_definitions','character_discipline_skill_grants'] loop
      assert (select relrowsecurity from pg_class where oid=('app_private.'||table_name)::regclass), 'Stage B private RLS: '||table_name;
      assert not has_table_privilege('service_role','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('authenticated','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('anon','app_private.'||table_name,'select,insert,update,delete'), 'Stage B private table ACL: '||table_name;
    end loop;
    foreach signature in array array['public.get_character_discipline_catalog_v3(uuid,uuid)','public.get_primary_discipline_catalog_v2()','public.get_current_discipline_catalog_v1()','public.get_character_discipline_atlas_progress_v2(uuid,uuid)','public.get_builtin_discipline_definition_v1(text)','public.create_character_v4(uuid,smallint,uuid,text,integer,text,text,text,text,text,text,text,integer,integer,integer,integer,integer,integer,integer)','public.get_character_learned_skills_v2(uuid,uuid)','public.get_character_discipline_skill_loadout_v2(uuid,uuid)','public.read_current_discipline_selection_v1(text,text)'] loop
      assert has_function_privilege('service_role',signature,'execute') and not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute'), 'Stage B ordinary service RPC ACL: '||signature;
    end loop;

    assert (select count(*)=41+case when to_regprocedure('public.commit_combat_content_record_v1(uuid,uuid,text,bigint,jsonb,text,integer)') is null then 0 else 1 end+case when to_regprocedure('public.read_master_panel_access_v2(uuid,uuid)') is null then 0 else 2 end+case when to_regprocedure('public.read_event_workspace_catalogue_v1(uuid,uuid)') is null then 0 else 2 end+case when to_regprocedure('public.finalize_combat_content_media_v1(uuid,uuid,bytea,jsonb)') is null then 0 else 2 end+cardinality(new_actor_signatures) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and 'p_actor_character_id'=any(p.proargnames)), 'Legacy actor contracts plus exact workspace actor inventory';
    foreach signature in array array[
      'select public.read_combat_content_record_v1($1,$2,''native.staff.skill'')',
      'select public.list_combat_content_records_v1($1,$2,null,null,null,null,20)',
      'select public.write_combat_content_record_v1($1,$2,''native.staff.skill'',''{}'')',
      'select public.publish_saved_combat_content_v1($1,$2,''native.staff.skill'',1,null,repeat(''a'',32),1)'
    ] loop
      begin execute signature using staff_id,character_id; raise exception 'EXPECTED revoked Content denial';
      exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_OPERATOR_REQUIRED'; end;
    end loop;
  end if;
  if to_regprocedure('public.finalize_combat_content_media_v1(uuid,uuid,bytea,jsonb)') is not null then
    checked:=0;
    for proc in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['finalize_combat_content_media_v1','read_combat_content_media_v1']) and 'p_actor_character_id'=any(p.proargnames) loop
      checked:=checked+1;
      assert has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Stage C media actor ACL';
    end loop;
    assert checked=2, 'Stage C adds exactly two selected-actor media contracts';
    foreach signature in array array[
      'select public.finalize_combat_content_media_v1($1,$2,decode(''00'',''hex''),''{}'')',
      'select public.read_combat_content_media_v1($1,$2,null)'
    ] loop
      begin execute signature using staff_id,character_id; raise exception 'EXPECTED revoked media denial';
      exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_OPERATOR_REQUIRED'; end;
      begin execute signature using staff_id,null::uuid; raise exception 'EXPECTED missing selected actor denial';
      exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_OPERATOR_REQUIRED'; end;
    end loop;
    checked:=0;
    for proc in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname=any(array['content_media_immutable_v1','media_u32_v1','content_media_references_v1','guard_content_media_references_v1','index_content_media_versions_v1']) loop
      checked:=checked+1;
      assert not has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Stage C private media helpers';
    end loop;
    assert checked=5, 'Stage C complete private media helper inventory';
    foreach table_name in array array['combat_content_media','combat_content_media_versions'] loop
      assert (select relrowsecurity from pg_class where oid=('app_private.'||table_name)::regclass), 'Stage C media RLS';
      assert not has_table_privilege('service_role','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('authenticated','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('anon','app_private.'||table_name,'select,insert,update,delete'), 'Stage C private media table ACL';
    end loop;
  end if;
  if to_regprocedure('app_private.content_tag_snapshot_v1(jsonb)') is not null then
    checked:=0;
    for proc in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='app_private' and p.proname=any(array['content_tag_snapshot_v1','bind_content_tag_presentation_v1','validate_content_tag_presentation_v1']) loop
      checked:=checked+1;
      assert not has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Stage C private Tag helpers';
    end loop;
    assert checked=3, 'Stage C complete private Tag helper inventory';
  end if;
  -- All newly exposed page APIs must reject a revoked staff character, missing
  -- selection, an owned alternate and an actor belonging to a different account.
  for probe in select * from (values
      ('public.read_master_panel_navigation_v1(uuid,uuid)','select public.read_master_panel_navigation_v1($1,$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.save_master_panel_navigation_v1(uuid,bigint,jsonb,uuid)','select public.save_master_panel_navigation_v1($1,1,''[]'',$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.read_master_panel_activity_v1(uuid,integer,bigint,uuid)','select public.read_master_panel_activity_v1($1,100,null,$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.set_world_environment_v2(uuid,integer,jsonb,uuid)','select public.set_world_environment_v2($1,0,''{}'',$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.publish_battlefield_elevation_policy_v2(uuid,integer,jsonb,uuid)','select public.publish_battlefield_elevation_policy_v2($1,1,''{}'',$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.publish_battlefield_elevation_policy_v3(uuid,integer,jsonb,uuid)','select public.publish_battlefield_elevation_policy_v3($1,1,''{}'',$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.publish_combat_effect_timing_policy_v2(uuid,integer,jsonb,text,uuid)','select public.publish_combat_effect_timing_policy_v2($1,1,''{}'',repeat(''a'',32),$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.save_site_music_configuration_v1(uuid,uuid,bigint,jsonb)','select public.save_site_music_configuration_v1($1,$2,1,''{}'')','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.search_master_moderation_players_v1(uuid,text,uuid)','select public.search_master_moderation_players_v1($1,''native'',$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.list_active_master_bans_v1(uuid,uuid,uuid)','select public.list_active_master_bans_v1($1,$2,null)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.read_master_moderation_v1(uuid,uuid,uuid,bigint)','select public.read_master_moderation_v1($1,$3,$2,null)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.write_master_moderation_v1(uuid,uuid,text,text,text,integer,boolean,uuid)','select public.write_master_moderation_v1($1,$3,''invalid'',''ban'',''CI denied probe'',60,false,$2)','MASTER_PANEL_PAGE_ACCESS_REQUIRED'),
      ('public.search_discipline_grant_players_v1(uuid,uuid,text)','select public.search_discipline_grant_players_v1($1,$2,''native'')','MASTER_FORBIDDEN'),
      ('public.read_discipline_player_grants_v1(uuid,uuid,text,uuid)','select public.read_discipline_player_grants_v1($1,$2,''vanguard'',null)','MASTER_FORBIDDEN'),
      ('public.write_discipline_player_grants_v1(uuid,uuid,text,uuid[],text,text)','select public.write_discipline_player_grants_v1($1,$2,''vanguard'',array[$3::uuid],''grant'',''CI denied probe'')','MASTER_FORBIDDEN'),
      ('public.review_discipline_deletion_v1(uuid,uuid,text)','select public.review_discipline_deletion_v1($1,$2,''vanguard'')','MASTER_PANEL_OPERATOR_REQUIRED'),
      ('public.delete_discipline_v1(uuid,uuid,text,text)','select public.delete_discipline_v1($1,$2,''vanguard'',repeat(''a'',32))','MASTER_PANEL_OPERATOR_REQUIRED'),
      ('public.read_master_usage_balance_v1(uuid,uuid,text)','select public.read_master_usage_balance_v1($1,$2,''vanguard'')','MASTER_PANEL_OPERATOR_REQUIRED'),
      ('public.read_master_usage_balance_week_v1(uuid,uuid,text,date)','select public.read_master_usage_balance_week_v1($1,$2,''vanguard'',null)','MASTER_PANEL_OPERATOR_REQUIRED')
  ) contracts(signature,command,denial) loop
    if not probe.signature=any(new_actor_signatures) then continue; end if;
    begin execute probe.command using staff_id,character_id,other_id; raise exception 'EXPECTED revoked workspace denial: %',probe.signature;
    exception when insufficient_privilege then assert sqlerrm=probe.denial; end;
    begin execute probe.command using staff_id,null::uuid,other_id; raise exception 'EXPECTED missing selection workspace denial: %',probe.signature;
    exception when insufficient_privilege then assert sqlerrm=probe.denial; end;
    begin execute probe.command using staff_id,current_setting('task8.alternate')::uuid,other_id; raise exception 'EXPECTED alternate workspace denial: %',probe.signature;
    exception when insufficient_privilege then assert sqlerrm=probe.denial; end;
    begin execute probe.command using other_id,character_id,staff_id; raise exception 'EXPECTED forged ownership workspace denial: %',probe.signature;
    exception when insufficient_privilege then assert sqlerrm=probe.denial; end;
  end loop;
  if to_regclass('app_private.master_moderation_audit') is not null then
    foreach signature in array array['app_private.master_page_capabilities_v1(text[])','app_private.assert_master_page_v1(uuid,uuid,text)','app_private.prevent_moderation_history_change_v1()']::text[] loop
      assert to_regprocedure(signature) is not null, 'Required workspace private helper: '||signature;
      assert not has_function_privilege('service_role',signature,'execute') and not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute'), 'Workspace private helper ACL: '||signature;
    end loop;
  end if;
  if to_regclass('app_private.discipline_player_grants') is not null then
    foreach signature in array array['app_private.discipline_grant_only_v1(text)','app_private.discipline_unlocked_before_player_grants_v1(uuid,text)','app_private.discipline_account_granted_v1(uuid,text)','app_private.validate_discipline_envelope_before_override_v1(jsonb)','app_private.current_discipline_relationship_override_v1(text,text)','app_private.essence_selection_key_before_override_v1(text,text)','app_private.resonance_selection_key_before_override_v1(text,text)','app_private.discipline_unlocked_v1(uuid,text)','app_private.resolve_essence_reference_v1(text,text)','app_private.resolve_resonance_reference_v1(text,text)']::text[] loop
      assert to_regprocedure(signature) is not null, 'Required workspace private helper: '||signature;
      assert not has_function_privilege('service_role',signature,'execute') and not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute'), 'Workspace private helper ACL: '||signature;
    end loop;
  end if;
  if to_regclass('app_private.usage_balance_sessions') is not null then
    foreach signature in array array['app_private.capture_usage_balance_start_v1()','app_private.capture_usage_balance_event_v1()']::text[] loop
      assert to_regprocedure(signature) is not null, 'Required workspace private helper: '||signature;
      assert not has_function_privilege('service_role',signature,'execute') and not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute'), 'Workspace private helper ACL: '||signature;
    end loop;
  end if;
  if to_regclass('app_private.discipline_player_grants') is not null then
    foreach signature in array array['public.get_account_discipline_grants_v1(uuid)','public.discipline_catalog_before_player_grants_v3(uuid,uuid)','app_private.essence_reference_before_override_v1(text,text)','app_private.resonance_reference_before_override_v1(text,text)'] loop
      assert has_function_privilege('service_role',signature,'execute') and not has_function_privilege('anon',signature,'execute') and not has_function_privilege('authenticated',signature,'execute'), 'Ordinary grant/catalogue service RPC ACL: '||signature;
    end loop;
  end if;
  if to_regclass('app_private.master_moderation_audit') is not null then
    foreach table_name in array array['master_moderation_audit']::text[] loop
      assert to_regclass('app_private.'||table_name) is not null, 'Required workspace private table: '||table_name;
      assert (select relrowsecurity from pg_class where oid=('app_private.'||table_name)::regclass), 'Workspace private RLS: '||table_name;
      assert not has_table_privilege('service_role','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('anon','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('authenticated','app_private.'||table_name,'select,insert,update,delete'), 'Workspace private table ACL: '||table_name;
    end loop;
    foreach signature in array array['app_private.master_moderation_audit_id_seq']::text[] loop
      assert not has_sequence_privilege('service_role',signature,'usage,select,update') and not has_sequence_privilege('anon',signature,'usage,select,update') and not has_sequence_privilege('authenticated',signature,'usage,select,update'), 'Workspace private sequence ACL: '||signature;
    end loop;
  end if;
  if to_regclass('app_private.discipline_player_grants') is not null then
    foreach table_name in array array['discipline_player_grants','discipline_player_grant_audit']::text[] loop
      assert to_regclass('app_private.'||table_name) is not null, 'Required workspace private table: '||table_name;
      assert (select relrowsecurity from pg_class where oid=('app_private.'||table_name)::regclass), 'Workspace private RLS: '||table_name;
      assert not has_table_privilege('service_role','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('anon','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('authenticated','app_private.'||table_name,'select,insert,update,delete'), 'Workspace private table ACL: '||table_name;
    end loop;
    foreach signature in array array['app_private.discipline_player_grant_audit_id_seq']::text[] loop
      assert not has_sequence_privilege('service_role',signature,'usage,select,update') and not has_sequence_privilege('anon',signature,'usage,select,update') and not has_sequence_privilege('authenticated',signature,'usage,select,update'), 'Workspace private sequence ACL: '||signature;
    end loop;
  end if;
  if to_regclass('app_private.usage_balance_sessions') is not null then
    foreach table_name in array array['usage_balance_sessions','usage_balance_actions']::text[] loop
      assert to_regclass('app_private.'||table_name) is not null, 'Required workspace private table: '||table_name;
      assert (select relrowsecurity from pg_class where oid=('app_private.'||table_name)::regclass), 'Workspace private RLS: '||table_name;
      assert not has_table_privilege('service_role','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('anon','app_private.'||table_name,'select,insert,update,delete') and not has_table_privilege('authenticated','app_private.'||table_name,'select,insert,update,delete'), 'Workspace private table ACL: '||table_name;
    end loop;
  end if;
  foreach signature in array array['public.resolve_master_panel_account_v2(uuid,text)','public.list_master_panel_staff_v2(uuid)','public.set_master_panel_character_access_v2(uuid,uuid,uuid,text[],text[],integer,bigint,boolean)'] loop
    assert has_function_privilege('service_role',signature,'execute') and not has_function_privilege('authenticated',signature,'execute') and not has_function_privilege('anon',signature,'execute'), 'New management private RPC ACL';
  end loop;
  assert not has_table_privilege('service_role','app_private.master_panel_character_access','select,insert,update,delete'), 'Private character grant table';
  assert not has_table_privilege('service_role','app_private.master_panel_capability_grants','select,insert,update,delete'), 'Private legacy capability table';
  assert not has_table_privilege('service_role','app_private.master_panel_access_audit','select,insert,update,delete'), 'Private Staff audit';
end; $$;
-- Actual browser invocation denial, in addition to the complete catalog ACL assertions.
set local role authenticated;
do $$ declare probe record; begin
  for probe in select * from (values
      ('public.read_master_panel_navigation_v1(uuid,uuid)','select public.read_master_panel_navigation_v1($1,$2)'),
      ('public.save_master_panel_navigation_v1(uuid,bigint,jsonb,uuid)','select public.save_master_panel_navigation_v1($1,1,''[]'',$2)'),
      ('public.read_master_panel_activity_v1(uuid,integer,bigint,uuid)','select public.read_master_panel_activity_v1($1,100,null,$2)'),
      ('public.set_world_environment_v2(uuid,integer,jsonb,uuid)','select public.set_world_environment_v2($1,0,''{}'',$2)'),
      ('public.publish_battlefield_elevation_policy_v2(uuid,integer,jsonb,uuid)','select public.publish_battlefield_elevation_policy_v2($1,1,''{}'',$2)'),
      ('public.publish_battlefield_elevation_policy_v3(uuid,integer,jsonb,uuid)','select public.publish_battlefield_elevation_policy_v3($1,1,''{}'',$2)'),
      ('public.publish_combat_effect_timing_policy_v2(uuid,integer,jsonb,text,uuid)','select public.publish_combat_effect_timing_policy_v2($1,1,''{}'',repeat(''a'',32),$2)'),
      ('public.save_site_music_configuration_v1(uuid,uuid,bigint,jsonb)','select public.save_site_music_configuration_v1($1,$2,1,''{}'')'),
      ('public.search_master_moderation_players_v1(uuid,text,uuid)','select public.search_master_moderation_players_v1($1,''native'',$2)'),
      ('public.list_active_master_bans_v1(uuid,uuid,uuid)','select public.list_active_master_bans_v1($1,$2,null)'),
      ('public.read_master_moderation_v1(uuid,uuid,uuid,bigint)','select public.read_master_moderation_v1($1,$3,$2,null)'),
      ('public.write_master_moderation_v1(uuid,uuid,text,text,text,integer,boolean,uuid)','select public.write_master_moderation_v1($1,$3,''invalid'',''ban'',''CI denied probe'',60,false,$2)'),
      ('public.search_discipline_grant_players_v1(uuid,uuid,text)','select public.search_discipline_grant_players_v1($1,$2,''native'')'),
      ('public.read_discipline_player_grants_v1(uuid,uuid,text,uuid)','select public.read_discipline_player_grants_v1($1,$2,''vanguard'',null)'),
      ('public.write_discipline_player_grants_v1(uuid,uuid,text,uuid[],text,text)','select public.write_discipline_player_grants_v1($1,$2,''vanguard'',array[$3::uuid],''grant'',''CI denied probe'')'),
      ('public.review_discipline_deletion_v1(uuid,uuid,text)','select public.review_discipline_deletion_v1($1,$2,''vanguard'')'),
      ('public.delete_discipline_v1(uuid,uuid,text,text)','select public.delete_discipline_v1($1,$2,''vanguard'',repeat(''a'',32))'),
      ('public.read_master_usage_balance_v1(uuid,uuid,text)','select public.read_master_usage_balance_v1($1,$2,''vanguard'')'),
      ('public.read_master_usage_balance_week_v1(uuid,uuid,text,date)','select public.read_master_usage_balance_week_v1($1,$2,''vanguard'',null)'),
      ('public.publish_combat_effect_timing_policy_v1(uuid,integer,jsonb,text,uuid)','select public.publish_combat_effect_timing_policy_v1($1,1,''{}'',null,$2)')
  ) contracts(signature,command) loop
    if to_regprocedure(probe.signature) is null then continue; end if;
    begin execute probe.command using current_setting('task8.owner')::uuid,null::uuid,current_setting('task8.other')::uuid; raise exception 'EXPECTED forged Owner browser invocation denial: %',probe.signature;
    exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
  end loop;
  if to_regprocedure('public.read_master_panel_role_defaults_v1(uuid)') is not null then
    begin perform public.read_master_panel_role_defaults_v1(current_setting('task8.owner')::uuid); raise exception 'EXPECTED role defaults browser read denial'; exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
    begin perform public.save_master_panel_role_defaults_v1(current_setting('task8.owner')::uuid,1,'{}'::jsonb); raise exception 'EXPECTED role defaults browser forgery denial'; exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
    begin perform public.read_master_panel_access_v2(current_setting('task8.owner')::uuid,null); raise exception 'EXPECTED authoritative capabilities browser denial'; exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
  end if;
  if to_regprocedure('public.read_combat_content_record_v1(uuid,uuid,text)') is not null then
    begin perform public.read_combat_content_record_v1(current_setting('task8.owner')::uuid,null,'native.staff.skill'); raise exception 'EXPECTED Content read browser denial'; exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
    begin perform public.list_combat_content_records_v1(current_setting('task8.owner')::uuid,null,null,null,null,null,20); raise exception 'EXPECTED Content list browser denial'; exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
    begin perform public.write_combat_content_record_v1(current_setting('task8.owner')::uuid,null,'native.staff.skill','{}'); raise exception 'EXPECTED Content write browser denial'; exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
    begin perform public.publish_saved_combat_content_v1(current_setting('task8.owner')::uuid,null,'native.staff.skill',1,null,repeat('a',32),1); raise exception 'EXPECTED Content publish browser denial'; exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
  end if;
  begin
    perform public.list_master_panel_staff_v2(current_setting('task8.owner')::uuid);
    raise exception 'EXPECTED browser management invocation denial';
  exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
  begin
    perform public.set_master_panel_character_access_v2(current_setting('task8.owner')::uuid,current_setting('task8.staff')::uuid,current_setting('task8.character')::uuid,array['content-staff'],array[]::text[],null,3,true);
    raise exception 'EXPECTED browser assignment invocation denial';
  exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
end; $$;
reset role;
set local role service_role;
do $$
declare table_name text;
begin
  foreach table_name in array array['master_panel_navigation','master_panel_navigation_audit','master_panel_character_access','master_panel_capability_grants','master_panel_access_audit','master_panel_role_defaults','master_moderation_audit','discipline_player_grants','discipline_player_grant_audit','usage_balance_sessions','usage_balance_actions'] loop
    if not exists(select 1 from pg_catalog.pg_class c join pg_catalog.pg_namespace n on n.oid=c.relnamespace where n.nspname='app_private' and c.relname=table_name) then continue; end if;
    begin
      execute format('select 1 from app_private.%I limit 1',table_name);
      raise exception 'EXPECTED private Staff table invocation denial: %',table_name;
    exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
  end loop;
end; $$;
reset role;
