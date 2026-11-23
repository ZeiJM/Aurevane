-- Run on a disposable, fully migrated Supabase stack. All fixtures roll back.
begin;
set local plpgsql.check_asserts=on;

insert into auth.users(id) values
  ('94000000-0000-4000-8000-000000000001'),
  ('94000000-0000-4000-8000-000000000002');
insert into app_private.master_panel_role_assignments(user_id,role,enabled)
values ('94000000-0000-4000-8000-000000000001','game-owner',true);

do $$
<<npc_design_arena_opponents>>
declare owner_id uuid := '94000000-0000-4000-8000-000000000001';
declare unprivileged_id uuid := '94000000-0000-4000-8000-000000000002';
declare npc_id uuid := '94000000-0000-4000-8000-000000000003';
declare draft jsonb := '{"name":"Arena Fixture","portraitRef":null,"uses":["arena"],"arena":{"arenaId":"duel-yard","aiDifficulty":"standard","lore":""}}';
declare record jsonb;
declare existing_roles jsonb;
declare role_revision bigint;
declare nav jsonb;
begin
  assert 'npc.manage'=any((select effective_capabilities from public.read_master_panel_access_v3(owner_id,null))::text[]);
  assert not ('npc.manage'=any((select effective_capabilities from public.read_master_panel_access_v2(owner_id,null))::text[]));
  assert not has_function_privilege('authenticated','public.write_master_npc_design_v1(uuid,uuid,uuid,bigint,text,jsonb)','execute');
  assert not has_function_privilege('authenticated','public.read_published_arena_npcs_v1(uuid)','execute');
  begin
    perform public.write_master_npc_design_v1(unprivileged_id,null,npc_id,0,'save',draft);
    raise exception 'ordinary player edited an NPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.write_master_npc_design_v1(owner_id,null,npc_id,0,'save',draft #- '{arena,arenaId}');
    raise exception 'database accepted an arena without an assignment';
  exception when invalid_parameter_value then null;
  end;

  record := public.write_master_npc_design_v1(owner_id,null,npc_id,0,'save',draft);
  assert record->>'revision'='1' and record->'arena'='null'::jsonb;
  assert public.read_published_arena_npcs_v1(npc_id)='[]'::jsonb, 'draft remains private';
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,1,'commit-arena',null);
  assert record->'arena'->>'lore'='', 'optional lore does not block Arena-only publication';
  assert (public.read_published_arena_npcs_v1(npc_id)->0)=record->'arena';
  assert not ((public.read_published_arena_npcs_v1(npc_id)->0) ?| array['draft','uses']);

  draft := jsonb_set(jsonb_set(draft,'{uses}','["arena","story"]'),'{arena,lore}','"New public lore."');
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,2,'save',draft);
  assert record->>'revision'='3';
  assert record->'arena'->>'revision'='2';
  assert public.read_published_arena_npcs_v1(npc_id)->0->>'lore'='', 'Story and lore draft cannot change the committed Arena card';
  begin
    perform public.write_master_npc_design_v1(owner_id,null,npc_id,2,'commit-arena',null);
    raise exception 'stale draft committed';
  exception when sqlstate 'PT409' then null;
  end;

  record := public.write_master_npc_design_v1(owner_id,null,npc_id,3,'commit-arena',null);
  assert record->>'revision'='4';
  assert public.read_published_arena_npcs_v1(npc_id)->0->>'lore'='New public lore.';
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,4,'commit-arena',null);
  assert record->>'revision'='4', 'identical commit does not add a revision';
  assert jsonb_array_length(public.read_master_npc_designs_v1(owner_id,null))>0;

  draft := jsonb_set(jsonb_set(draft,'{name}','""'),'{uses}','["story"]');
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,4,'save',draft);
  assert record->'draft'->'arena'->>'lore'='New public lore.', 'disabled Arena draft retains authoring';
  assert public.read_published_arena_npcs_v1(npc_id)->0->>'name'='Arena Fixture';
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,5,'retire-arena',null);
  assert record->'arena'='null'::jsonb and public.read_published_arena_npcs_v1(npc_id)='[]'::jsonb;
  assert record->'draft'->'arena'->>'lore'='New public lore.';

  draft := '{"name":"Crossroads Story","portraitRef":null,"uses":["world","story"],"arena":null,"imageUrl":"/api/media/appearance/1/slight.tan.braid.copper.tunic.open.split.lacing.pointed.linen.satchel.pine/neutral.svg","world":{"sectorId":"verdant-expanse","x":5,"y":4,"radius":2,"greeting":"Welcome."}}';
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,6,'save',draft);
  assert record->>'revision'='7';
  assert public.read_published_world_npcs_v1('verdant-expanse')='[]'::jsonb;
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,7,'commit-world',null);
  assert record->'world'->>'greeting'='Welcome.';
  assert public.read_published_world_npcs_v1('aureth-crown')='[]'::jsonb;
  assert public.read_published_world_npcs_v1('verdant-expanse')->0=record->'world';
  assert record->'arena'='null'::jsonb, 'World talker can publish without combat setup';
  record := public.write_master_npc_design_v1(owner_id,null,npc_id,8,'commit-story',null);
  assert public.read_master_story_npcs_v1(owner_id,null,npc_id)->0=record->'story';
  assert not ((record->'story') ?| array['world','greeting','draft']);
  assert (select count(*) from app_private.npc_appearance_claims c where c.npc_id=npc_design_arena_opponents.npc_id)=1;

  perform public.write_master_npc_design_v1(owner_id,null,unprivileged_id,0,'save',draft);
  begin
    perform public.write_master_npc_design_v1(owner_id,null,unprivileged_id,1,'commit-story',null);
    raise exception 'distinct NPC identities published the same active appearance';
  exception when sqlstate 'PT409' then
    assert sqlerrm='NPC_APPEARANCE_ALREADY_ACTIVE';
  end;
  begin
    perform public.write_master_npc_design_v1(unprivileged_id,null,unprivileged_id,1,'commit-world',null);
    raise exception 'ordinary actor published a World NPC';
  exception when insufficient_privilege then null;
  end;

  select roles,revision into existing_roles,role_revision from app_private.master_panel_role_defaults where singleton;
  perform public.save_master_panel_role_defaults_v2(owner_id,role_revision,jsonb_set(existing_roles,'{event-staff}', '["events","npc-design"]'));
  assert public.read_master_panel_role_defaults_v2(owner_id)->'roles'->'event-staff' ? 'npc-design';
  assert not (public.read_master_panel_role_defaults_v1(owner_id)->'roles'->'event-staff' ? 'npc-design');
  nav := public.read_master_panel_navigation_v2(owner_id,null);
  assert nav->'order' ? 'npc-design';
  perform public.save_master_panel_navigation_v2(owner_id,(nav->>'revision')::bigint,
    '["npc-design","combat","combat-timing","events","moderation","players","staff","music","world-environment","activity"]',null);
  assert public.read_master_panel_navigation_v2(owner_id,null)->'order'->>0='npc-design';
  assert not (public.read_master_panel_navigation_v1(owner_id,null)->'order' ? 'npc-design');
end; $$;

insert into auth.users(id,email_confirmed_at) values
  ('94000000-0000-4000-8000-000000000011',now()),
  ('94000000-0000-4000-8000-000000000012',now());
insert into public.characters(id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,level,xp,progression_cycle,created_at,cycle_started_at,last_active_at)
values
  ('94000000-0000-4000-8000-000000000021','94000000-0000-4000-8000-000000000011',0,1,'Event Tester','event-tester','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now()),
  ('94000000-0000-4000-8000-000000000022','94000000-0000-4000-8000-000000000012',0,1,'NPC Tester','npc-tester','default','they','portrait','appearance','vanguard',12,4,7,4,3,6,1,0,1,now(),now(),now());

set local role service_role;
do $$
declare owner_id uuid := '94000000-0000-4000-8000-000000000001';
declare npc_id uuid := '94000000-0000-4000-8000-000000000003';
declare event_user uuid := '94000000-0000-4000-8000-000000000011';
declare npc_user uuid := '94000000-0000-4000-8000-000000000012';
declare event_actor uuid := '94000000-0000-4000-8000-000000000021';
declare npc_actor uuid := '94000000-0000-4000-8000-000000000022';
declare role_defaults jsonb;
begin
  role_defaults := public.read_master_panel_role_defaults_v2(owner_id);
  perform public.save_master_panel_role_defaults_v2(owner_id,(role_defaults->>'revision')::bigint,
    (role_defaults->'roles') || '{"event-staff":["events"],"content-staff":["npc-design"]}'::jsonb);
  perform public.set_master_panel_character_access_v2(owner_id,event_user,event_actor,array['event-staff'],'{}',null,0,true);
  perform public.set_master_panel_character_access_v2(owner_id,npc_user,npc_actor,array['content-staff'],'{}',null,0,true);
  assert not has_function_privilege('anon','public.read_master_restoration_trial_npc_v1(uuid,uuid,uuid)','execute');
  assert not has_function_privilege('authenticated','public.read_master_restoration_trial_npc_v1(uuid,uuid,uuid)','execute');
  assert public.read_master_restoration_trial_npc_v1(event_user,event_actor,npc_id) is null,
    'a committed talker without a World encounter is ineligible';
  begin
    perform public.read_master_restoration_trial_npc_v1(npc_user,npc_actor,npc_id);
    raise exception 'NPC-only staff read a restoration trial NPC';
  exception when insufficient_privilege then null;
  end;
  assert public.read_master_story_npcs_v1(event_user,event_actor,npc_id)->0->>'name'='Crossroads Story';
  assert jsonb_array_length(public.read_master_npc_designs_v1(npc_user,npc_actor))>0;
  assert public.read_master_panel_navigation_v2(event_user,event_actor)->'order' ? 'events';
  begin
    perform public.read_master_npc_designs_v1(event_user,event_actor);
    raise exception 'Events-only staff read private NPC drafts';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.write_master_npc_design_v1(event_user,event_actor,npc_id,9,'commit-story',null);
    raise exception 'Events-only staff committed an NPC';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.read_master_story_npcs_v1(npc_user,npc_actor,npc_id);
    raise exception 'NPC-only staff read the Events workspace catalogue';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.save_master_panel_navigation_v2(npc_user,1,'[]',npc_actor);
    raise exception 'Delegated NPC staff edited Owner navigation';
  exception when insufficient_privilege then null;
  end;
  assert public.write_master_npc_design_v1(
    npc_user,npc_actor,'94000000-0000-4000-8000-000000000023',0,'save',
    '{"name":"Delegated NPC Draft","portraitRef":null,"uses":["story"],"arena":null}'::jsonb
  )->>'revision'='1', 'NPC Design staff can save an NPC draft';

  declare
    trial_id uuid := '94000000-0000-4000-8000-000000000026';
    trial_draft jsonb := '{"name":"Forge Sentinel","portraitRef":null,"uses":["world"],"arena":null,"world":{"sectorId":"emberreach","x":3,"y":4,"radius":1,"greeting":"Challenge me.","encounter":{"arenaId":"duel-yard","aiDifficulty":"high","tags":[]}}}';
  begin
    perform public.write_master_npc_design_v1(npc_user,npc_actor,trial_id,0,'save',trial_draft);
    assert public.read_master_restoration_trial_npc_v1(event_user,event_actor,trial_id) is null,
      'an uncommitted encounter is ineligible';
    perform public.write_master_npc_design_v1(npc_user,npc_actor,trial_id,1,'commit-world',null);
    perform public.write_master_npc_design_v1(npc_user,npc_actor,trial_id,2,'save',
      jsonb_set(jsonb_set(trial_draft,'{world,sectorId}','"verdant-expanse"'),'{name}','"Draft rename"'));
    assert public.read_master_restoration_trial_npc_v1(event_user,event_actor,trial_id)
      = jsonb_build_object('id',trial_id,'name','Forge Sentinel','sectorId','emberreach','x',3,'y',4),
      'lookup uses only the committed identity and location';
    perform public.write_master_npc_design_v1(npc_user,npc_actor,trial_id,3,'retire-world',null);
    assert public.read_master_restoration_trial_npc_v1(event_user,event_actor,trial_id) is null,
      'a retired encounter is ineligible';
  end;
end; $$;

do $$
declare owner_id uuid := '94000000-0000-4000-8000-000000000001';
declare original_id uuid := '94000000-0000-4000-8000-000000000003';
declare npc_user uuid := '94000000-0000-4000-8000-000000000012';
declare npc_actor uuid := '94000000-0000-4000-8000-000000000022';
declare clone_id uuid := '94000000-0000-4000-8000-000000000024';
declare other_id uuid := '94000000-0000-4000-8000-000000000025';
declare active_url text := '/api/media/appearance/1/slight.tan.braid.copper.tunic.open.split.lacing.pointed.linen.satchel.pine/neutral.svg';
declare unused_url text := '/api/media/appearance/1/broad.deep.crop.onyx.plate.fur.close.clasps.split.quilt.brooch.indigo/neutral.svg';
declare draft jsonb;
declare clone jsonb;
begin
  assert not has_function_privilege('authenticated','public.commit_master_npc_uniform_v1(uuid,uuid,uuid,bigint,text,text)','execute');
  assert not has_function_privilege('authenticated','public.find_master_npc_appearance_conflicts_v1(uuid,uuid,text[])','execute');
  assert public.find_master_npc_appearance_conflicts_v1(npc_user,npc_actor,array[unused_url,active_url,active_url])=jsonb_build_array(active_url);
  begin
    perform public.find_master_npc_appearance_conflicts_v1(npc_user,npc_actor,array_fill(active_url,array[65]));
    raise exception 'oversized lookup reached the active appearance registry';
  exception when invalid_parameter_value then null;
  end;
  draft := jsonb_build_object('name','Deliberate copy','portraitRef',null,'uses',jsonb_build_array('story'),'arena',null,'imageUrl',active_url);
  perform public.write_master_npc_design_v1(npc_user,npc_actor,clone_id,0,'save',draft);
  perform public.write_master_npc_design_v1(npc_user,npc_actor,other_id,0,'save',draft);
  begin
    perform public.commit_master_npc_uniform_v1(npc_user,npc_actor,clone_id,1,'story','Intentional ceremonial double');
    raise exception 'delegated NPC Design staff approved an exact copy';
  exception when insufficient_privilege then null;
  end;
  assert public.read_master_story_npcs_v1(owner_id,null,clone_id)='[]'::jsonb;
  begin
    perform public.commit_master_npc_uniform_v1(owner_id,null,clone_id,1,'story',E' \t\n ');
    raise exception 'an empty approval reason was accepted';
  exception when invalid_parameter_value then null;
  end;
  clone := public.commit_master_npc_uniform_v1(owner_id,null,clone_id,1,'story','Intentional ceremonial double');
  assert clone->>'revision'='2';
  assert clone->'story'->>'imageUrl'=active_url and clone->'world'='null'::jsonb and clone->'arena'='null'::jsonb;
  assert not ((clone->'story') ?| array['uniformReason','approvedBy']);
  assert public.read_master_story_npcs_v1(owner_id,null,clone_id)->0=clone->'story';

  perform public.write_master_npc_design_v1(owner_id,null,original_id,9,'retire-story',null);
  perform public.write_master_npc_design_v1(owner_id,null,original_id,10,'retire-world',null);
  begin
    perform public.write_master_npc_design_v1(npc_user,npc_actor,other_id,1,'commit-story',null);
    raise exception 'retiring the original released the active copy’s claim';
  exception when sqlstate 'PT409' then
    assert sqlerrm='NPC_APPEARANCE_ALREADY_ACTIVE';
  end;
  perform public.write_master_npc_design_v1(npc_user,npc_actor,clone_id,2,'save',jsonb_set(draft,'{imageUrl}',to_jsonb(unused_url)));
  begin
    perform public.commit_master_npc_uniform_v1(owner_id,null,clone_id,3,'story','Not actually a copy');
    raise exception 'an unrelated look received a reusable exception';
  exception when invalid_parameter_value then
    assert sqlerrm='NPC_UNIFORM_NOT_A_DUPLICATE';
  end;
  perform public.write_master_npc_design_v1(npc_user,npc_actor,clone_id,3,'commit-story',null);
  assert public.find_master_npc_appearance_conflicts_v1(npc_user,npc_actor,array[unused_url,active_url])=jsonb_build_array(unused_url);
  assert public.write_master_npc_design_v1(npc_user,npc_actor,other_id,1,'commit-story',null)->'story'->>'imageUrl'=active_url;
end; $$;

reset role;
do $$
begin
  assert not has_table_privilege('authenticated','app_private.npc_appearance_uniform_approvals','select');
  assert (select count(*) from app_private.npc_appearance_uniform_approvals)=1;
  assert exists (select 1 from app_private.npc_appearance_uniform_approvals
    where npc_id='94000000-0000-4000-8000-000000000024' and revision=2 and approved_use='story'
      and approved_by='94000000-0000-4000-8000-000000000001' and reason='Intentional ceremonial double');
end; $$;
rollback;
