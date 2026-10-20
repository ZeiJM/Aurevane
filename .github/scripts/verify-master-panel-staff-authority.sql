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
  exception when serialization_failure then assert sqlerrm='MASTER_PANEL_ACCESS_VERSION_CONFLICT'; end;
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
  checked integer := 0;
  proc record;
  predecessor text;
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
  for proc in select p.oid,n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) identity from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and 'p_actor_character_id'=any(p.proargnames) and p.proname<>all(array['search_master_players_v1','read_master_player_v1','edit_master_player_v1','recover_master_player_battle_v1','read_combat_content_record_v1','list_combat_content_records_v1','write_combat_content_record_v1','publish_saved_combat_content_v1']) loop
    checked := checked+1;
    assert not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Explicit actor browser denial: '||proc.proname;
    if proc.nspname='app_private' then
      assert not has_function_privilege('service_role',proc.oid,'execute'), 'Private assertion ACL: '||proc.proname;
    else
      predecessor := regexp_replace(regexp_replace(regexp_replace(proc.identity,'p_actor_character_id uuid,? *','','g'),', *$',''),'p_\w+ ','','g');
      assert has_function_privilege('service_role',proc.oid,'execute')=has_function_privilege('service_role',proc.nspname||'.'||proc.proname||'('||predecessor||')','execute'), 'Predecessor service ACL: '||proc.proname;
    end if;
  end loop;
  assert checked=33, 'Complete explicit actor ACL inventory';
  -- Task9 adds independent Owner-only operations with no legacy overload.
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
        raise exception 'EXPECTED Players Owner denial: %',signature;
      exception when insufficient_privilege then assert sqlerrm='MASTER_PANEL_OWNER_REQUIRED'; end;
    end loop;

  end if;
  if to_regprocedure('public.read_combat_content_record_v1(uuid,uuid,text)') is not null then
    checked:=0;
    for proc in select p.oid,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=any(array['read_combat_content_record_v1','list_combat_content_records_v1','write_combat_content_record_v1','publish_saved_combat_content_v1']) and 'p_actor_character_id'=any(p.proargnames) loop
      checked:=checked+1;
      assert has_function_privilege('service_role',proc.oid,'execute') and not has_function_privilege('anon',proc.oid,'execute') and not has_function_privilege('authenticated',proc.oid,'execute'), 'Content service-only actor ACL: '||proc.proname;
    end loop;
    assert checked=4, 'Independent Content actor ACL inventory';
    assert (select count(*)=41 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','app_private') and 'p_actor_character_id'=any(p.proargnames)), 'Original33 + Players4 + Content4 actor inventory';
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
  foreach signature in array array['public.resolve_master_panel_account_v2(uuid,text)','public.list_master_panel_staff_v2(uuid)','public.set_master_panel_character_access_v2(uuid,uuid,uuid,text[],text[],integer,bigint,boolean)'] loop
    assert has_function_privilege('service_role',signature,'execute') and not has_function_privilege('authenticated',signature,'execute') and not has_function_privilege('anon',signature,'execute'), 'New management private RPC ACL';
  end loop;
  assert not has_table_privilege('service_role','app_private.master_panel_character_access','select,insert,update,delete'), 'Private character grant table';
  assert not has_table_privilege('service_role','app_private.master_panel_capability_grants','select,insert,update,delete'), 'Private legacy capability table';
  assert not has_table_privilege('service_role','app_private.master_panel_access_audit','select,insert,update,delete'), 'Private Staff audit';
end; $$;
-- Actual browser invocation denial, in addition to the complete catalog ACL assertions.
set local role authenticated;
do $$ begin
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
  foreach table_name in array array['master_panel_character_access','master_panel_capability_grants','master_panel_access_audit'] loop
    begin
      execute format('select 1 from app_private.%I limit 1',table_name);
      raise exception 'EXPECTED private Staff table invocation denial: %',table_name;
    exception when insufficient_privilege then assert sqlerrm like '%permission denied%'; end;
  end loop;
end; $$;
reset role;
