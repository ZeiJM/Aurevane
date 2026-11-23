-- REVIEW TEMPLATE ONLY: bind offline with scripts/prepare-chilled-cleanse-publication.py.
-- Seven current definitions only. Never rewrite history or overwrite an Owner draft.
-- Externally supplied fresh CAS is locked once before all writes. Read back ambiguous results before retrying.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $publish_chilled$
declare
 reviewed_records jsonb := $chilled_records$__RECORDS_JSON__$chilled_records$::jsonb;
 reviewed jsonb; expected_before jsonb; expected_after jsonb; before_state jsonb; after_state jsonb; actual_state jsonb;
 target_key text; target_kind text; before_version integer; after_version integer;
 current_row record; result_row record; saved_record jsonb; published_record jsonb; actor uuid; actor_character uuid;
 highest_version integer; history_count bigint; publication_count bigint;
 old_history jsonb; other_publications jsonb; old_drafts jsonb;
 old_records jsonb; old_target_record jsonb; new_target_record jsonb; old_attribution jsonb;
 old_policy jsonb; old_policy_history jsonb;
 did_append boolean;
begin
 -- Resolve intended Owner character strictly; duplicate/missing names abort.
 select c.user_id,c.id into strict actor,actor_character from public.characters c where c.name='Zei';
 perform app_private.assert_game_owner_v1(actor);
 perform app_private.assert_master_panel_operator_v1(actor,actor_character);
 perform app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
 -- Block writers while the complete preservation snapshot and append are compared.
 lock table app_private.combat_content_versions,app_private.combat_content_publications,
  app_private.combat_content_drafts,app_private.combat_content_records,app_private.combat_content_attribution,
  app_private.combat_effect_timing_policy_versions in share row exclusive mode;
 if jsonb_array_length(reviewed_records)<>7
  or (select count(distinct r->>'id') from jsonb_array_elements(reviewed_records) r)<>7 then
  raise exception 'CHILLED_CLEANSE_CANDIDATE_INVALID';
 end if;
 for reviewed in select value from jsonb_array_elements(reviewed_records) loop
  target_key:=reviewed->>'id'; target_kind:=reviewed->>'kind';
  before_version:=(reviewed->>'beforeVersion')::integer; after_version:=(reviewed->>'afterVersion')::integer;
  expected_before:=reviewed->'before'; expected_after:=reviewed->'after';
  before_state:=(reviewed->'baseline')-'content_version'-'highest_version'-'has_draft';
  after_state:=before_state||jsonb_build_object('revision',(before_state->>'revision')::bigint+2,
   'draft_sequence',(before_state->>'draft_sequence')::bigint+1,'version_floor',after_version);
  did_append:=false;
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combat-publish:'||target_key,0));
 select * into strict current_row
  from public.read_current_combat_content_v1(target_key,target_kind);
 select max(content_version) into highest_version from app_private.combat_content_versions
  where content_key=target_key;
 if coalesce(expected_before->>'id',expected_before->>'essenceId') is distinct from target_key
  or coalesce(expected_after->>'id',expected_after->>'essenceId') is distinct from target_key
  or (expected_before->>'contentVersion')::integer is distinct from before_version
  or (expected_after->>'contentVersion')::integer is distinct from after_version
  or after_version<>before_version+1 then
  raise exception 'CHILLED_CLEANSE_CANDIDATE_INVALID: %',target_key;
 end if;
 if exists(select 1 from app_private.combat_content_drafts where content_key=target_key) then
  raise exception 'CHILLED_CLEANSE_HAS_UNCOMMITTED_DRAFT: %',target_key;
 end if;
 if not exists(select 1 from app_private.combat_content_records
  where content_key=target_key and content_kind=target_kind
   and lifecycle='active' and not restore_pending) then
  raise exception 'CHILLED_CLEANSE_RECORD_STATE_CHANGED: %',target_key;
 end if;
 select jsonb_build_object('content_key',r.content_key,'content_kind',r.content_kind,
  'revision',r.revision,'draft_sequence',r.draft_sequence,'version_floor',r.version_floor,
  'lifecycle',r.lifecycle,'restore_pending',r.restore_pending) into actual_state
  from app_private.combat_content_records r where r.content_key=target_key;
 if current_row.content_version=after_version and highest_version=after_version and current_row.definition=expected_after then
  if actual_state is distinct from after_state then
   raise exception 'CHILLED_CLEANSE_RECORD_STATE_CHANGED: %',target_key;
  end if;
  -- Readback-confirmed retry: no extra version, timestamp, activity, or draft mutation.
  raise notice 'CHILLED_CLEANSE_ALREADY_PUBLISHED: %',target_key;
 elsif current_row.content_version=before_version and highest_version=before_version and current_row.definition=expected_before then
  if actual_state is distinct from before_state then
   raise exception 'CHILLED_CLEANSE_RECORD_STATE_CHANGED: %',target_key;
  end if;
  select count(*),jsonb_agg(to_jsonb(v) order by v.id) into history_count,old_history
   from app_private.combat_content_versions v;
  select count(*) into publication_count from app_private.combat_content_publications;
  select jsonb_agg(to_jsonb(p) order by p.content_key) into other_publications
   from app_private.combat_content_publications p where p.content_key<>target_key;
  select jsonb_agg(to_jsonb(d) order by d.content_key) into old_drafts
   from app_private.combat_content_drafts d;
  select jsonb_agg(to_jsonb(r) order by r.content_key) into old_records
   from app_private.combat_content_records r where r.content_key<>target_key;
  select to_jsonb(r) into old_target_record from app_private.combat_content_records r
   where r.content_key=target_key;
  select jsonb_agg(to_jsonb(a) order by a.version_id) into old_attribution
   from app_private.combat_content_attribution a;
  select jsonb_agg(to_jsonb(p) order by p.version) into old_policy_history
   from app_private.combat_effect_timing_policy_versions p;
  old_policy:=public.read_combat_effect_timing_policy_v1();
  -- The old publish-with-floor functions are retired. Save a revision and publish it
  -- through the current authoring API, within this already-CAS-locked transaction.
  saved_record:=public.write_combat_content_record_v1(actor,actor_character,target_key,
   jsonb_build_object('action','save','expectedRevision',(old_target_record->>'revision')::bigint,'definition',expected_after));
  -- Saving changes the catalogue token; this internal token describes our own locked save.
  published_record:=public.publish_saved_combat_content_v1(actor,actor_character,target_key,
   (saved_record#>>'{draft,draftVersion}')::bigint,before_version,public.read_combat_content_catalogue_token_v1(),before_version);
  select * into strict result_row from public.read_current_combat_content_v1(target_key,target_kind);
  if result_row.content_version<>after_version or result_row.definition is distinct from expected_after then
   raise exception 'CHILLED_CLEANSE_PUBLICATION_MISMATCH: %',target_key;
  end if;
  select to_jsonb(r) into new_target_record from app_private.combat_content_records r
   where r.content_key=target_key;
  if new_target_record-'revision'-'draft_sequence'-'version_floor'-'updated_by'-'updated_at'-'restored_from'-'restored_by'-'restored_source'
       is distinct from old_target_record-'revision'-'draft_sequence'-'version_floor'-'updated_by'-'updated_at'-'restored_from'-'restored_by'-'restored_source'
   or (new_target_record->>'revision')::bigint<>(old_target_record->>'revision')::bigint+2
   or (new_target_record->>'draft_sequence')::bigint<>(old_target_record->>'draft_sequence')::bigint+1
   or (new_target_record->>'version_floor')::integer<>after_version
   or new_target_record->>'updated_by' is distinct from actor::text
   or new_target_record->>'restored_from' is not null or new_target_record->>'restored_by' is not null
   or new_target_record->>'restored_source' is not null then
   raise exception 'CHILLED_CLEANSE_TARGET_RECORD_MISMATCH: %',target_key;
  end if;
  if (select count(*) from app_private.combat_content_versions)<>history_count+1
   or (select jsonb_agg(to_jsonb(v) order by v.id) from app_private.combat_content_versions v
       where v.id<>result_row.id) is distinct from old_history
   or (select count(*) from app_private.combat_content_publications)<>publication_count
   or (select jsonb_agg(to_jsonb(p) order by p.content_key) from app_private.combat_content_publications p
       where p.content_key<>target_key) is distinct from other_publications
   or (select jsonb_agg(to_jsonb(d) order by d.content_key) from app_private.combat_content_drafts d)
       is distinct from old_drafts
   or (select jsonb_agg(to_jsonb(r) order by r.content_key) from app_private.combat_content_records r
       where r.content_key<>target_key) is distinct from old_records
   or (select jsonb_agg(to_jsonb(a) order by a.version_id) from app_private.combat_content_attribution a
       where a.version_id<>result_row.id) is distinct from old_attribution
   or not exists(select 1 from app_private.combat_content_attribution a
       where a.version_id=result_row.id and a.authored_by=actor and a.restored_from is null)
   or (select jsonb_agg(to_jsonb(p) order by p.version) from app_private.combat_effect_timing_policy_versions p)
       is distinct from old_policy_history
   or public.read_combat_effect_timing_policy_v1() is distinct from old_policy then
   raise exception 'CHILLED_CLEANSE_PRESERVATION_MISMATCH: %',target_key;
  end if;
  did_append:=true;
 else
  raise exception 'CHILLED_CLEANSE_BASELINE_CHANGED: %',target_key;
 end if;
 select * into strict current_row
  from public.read_current_combat_content_v1(target_key,target_kind);
 if current_row.content_version<>after_version or current_row.definition is distinct from expected_after
  or not exists(select 1 from app_private.combat_content_publications p
   join app_private.combat_content_versions v on v.id=p.version_id
   where p.content_key=target_key and p.content_kind=target_kind
    and v.content_version=after_version and v.definition=expected_after)
  or not exists(select 1 from jsonb_array_elements(public.read_combat_content_catalogue_v1()->'publications') v
   where v->>'content_key'=target_key and v->>'content_kind'=target_kind
    and (v->>'content_version')::integer=after_version and v->'definition'=expected_after) then
  raise exception 'CHILLED_CLEANSE_READBACK_MISMATCH: %',target_key;
 end if;
 raise notice 'CHILLED_CLEANSE_VERIFIED: % appended=%',target_key,did_append;
 end loop;
end; $publish_chilled$;
commit;
