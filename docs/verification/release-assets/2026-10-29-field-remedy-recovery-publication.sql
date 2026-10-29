-- REVIEW TEMPLATE ONLY: bind using scripts/prepare-field-remedy-publication.py.
-- Owner-authorized one-record publication. Never rewrite historical definitions.
-- An unbound/stale catalogue token fails before writes; refresh after ambiguous responses.
begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
do $publish_field_remedy$
declare
 expected_before jsonb := $field_remedy_before$__BEFORE_JSON__$field_remedy_before$::jsonb;
 expected_after jsonb := $field_remedy_after$__AFTER_JSON__$field_remedy_after$::jsonb;
 current_row record; result_row record; saved_record jsonb; published_record jsonb; actor uuid; actor_character uuid;
 highest_version integer; history_count bigint; publication_count bigint;
 old_history jsonb; other_publications jsonb; old_drafts jsonb;
 old_records jsonb; old_target_record jsonb; new_target_record jsonb; old_attribution jsonb;
 old_policy jsonb; old_policy_history jsonb;
 did_append boolean := false;
begin
 -- Resolve the intended Owner character strictly; duplicate/missing names abort.
 select c.user_id,c.id into strict actor,actor_character from public.characters c
  where c.name='Zei';
 perform app_private.assert_game_owner_v1(actor);
 perform app_private.assert_master_panel_operator_v1(actor,actor_character);
 perform app_private.lock_combat_content_catalogue_v1('__EXPECTED_CATALOGUE_TOKEN__');
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('combat-publish:wildwarden.field-remedy',0));
 -- Block writers while the complete preservation snapshot and append are compared.
 lock table app_private.combat_content_versions,app_private.combat_content_publications,
  app_private.combat_content_drafts,app_private.combat_content_records,app_private.combat_content_attribution,
  app_private.combat_effect_timing_policy_versions in share row exclusive mode;
 select * into strict current_row
  from public.read_current_combat_content_v1('wildwarden.field-remedy','skill');
 select max(content_version) into highest_version from app_private.combat_content_versions
  where content_key='wildwarden.field-remedy';
 if expected_before->>'id' is distinct from 'wildwarden.field-remedy'
  or expected_after->>'id' is distinct from 'wildwarden.field-remedy'
  or (expected_before->>'contentVersion')::integer is distinct from 7
  or (expected_after->>'contentVersion')::integer is distinct from 8 then
  raise exception 'FIELD_REMEDY_CANDIDATE_INVALID';
 end if;
 if exists(select 1 from app_private.combat_content_drafts where content_key='wildwarden.field-remedy') then
  raise exception 'FIELD_REMEDY_HAS_UNCOMMITTED_DRAFT';
 end if;
 if not exists(select 1 from app_private.combat_content_records
  where content_key='wildwarden.field-remedy' and content_kind='skill'
   and lifecycle='active' and not restore_pending) then
  raise exception 'FIELD_REMEDY_RECORD_STATE_CHANGED';
 end if;
 if current_row.content_version=8 and highest_version=8 and current_row.definition=expected_after then
  -- Readback-confirmed retry: no extra version, timestamp, activity, or draft mutation.
  raise notice 'FIELD_REMEDY_ALREADY_PUBLISHED';
 elsif current_row.content_version=7 and highest_version=7 and current_row.definition=expected_before then
  select count(*),jsonb_agg(to_jsonb(v) order by v.id) into history_count,old_history
   from app_private.combat_content_versions v;
  select count(*) into publication_count from app_private.combat_content_publications;
  select jsonb_agg(to_jsonb(p) order by p.content_key) into other_publications
   from app_private.combat_content_publications p where p.content_key<>'wildwarden.field-remedy';
  select jsonb_agg(to_jsonb(d) order by d.content_key) into old_drafts
   from app_private.combat_content_drafts d;
  select jsonb_agg(to_jsonb(r) order by r.content_key) into old_records
   from app_private.combat_content_records r where r.content_key<>'wildwarden.field-remedy';
  select to_jsonb(r) into old_target_record from app_private.combat_content_records r
   where r.content_key='wildwarden.field-remedy';
  select jsonb_agg(to_jsonb(a) order by a.version_id) into old_attribution
   from app_private.combat_content_attribution a;
  select jsonb_agg(to_jsonb(p) order by p.version) into old_policy_history
   from app_private.combat_effect_timing_policy_versions p;
  old_policy:=public.read_combat_effect_timing_policy_v1();
  -- The old publish-with-floor functions are retired. Save a revision and publish it
  -- through the current authoring API, within this already-CAS-locked transaction.
  saved_record:=public.write_combat_content_record_v1(actor,actor_character,'wildwarden.field-remedy',
   jsonb_build_object('action','save','expectedRevision',(old_target_record->>'revision')::bigint,'definition',expected_after));
  -- Saving changes the catalogue token; this internal token describes our own locked save.
  published_record:=public.publish_saved_combat_content_v1(actor,actor_character,'wildwarden.field-remedy',
   (saved_record#>>'{draft,draftVersion}')::bigint,7,public.read_combat_content_catalogue_token_v1(),7);
  select * into strict result_row from public.read_current_combat_content_v1('wildwarden.field-remedy','skill');
  if result_row.content_version<>8 or result_row.definition is distinct from expected_after then
   raise exception 'FIELD_REMEDY_PUBLICATION_MISMATCH';
  end if;
  select to_jsonb(r) into new_target_record from app_private.combat_content_records r
   where r.content_key='wildwarden.field-remedy';
  if new_target_record-'revision'-'draft_sequence'-'version_floor'-'updated_by'-'updated_at'-'restored_from'-'restored_by'-'restored_source'
       is distinct from old_target_record-'revision'-'draft_sequence'-'version_floor'-'updated_by'-'updated_at'-'restored_from'-'restored_by'-'restored_source'
   or (new_target_record->>'revision')::bigint<>(old_target_record->>'revision')::bigint+2
   or (new_target_record->>'draft_sequence')::bigint<>(old_target_record->>'draft_sequence')::bigint+1
   or (new_target_record->>'version_floor')::integer<>8
   or new_target_record->>'updated_by' is distinct from actor::text
   or new_target_record->>'restored_from' is not null or new_target_record->>'restored_by' is not null
   or new_target_record->>'restored_source' is not null then
   raise exception 'FIELD_REMEDY_TARGET_RECORD_MISMATCH';
  end if;
  if (select count(*) from app_private.combat_content_versions)<>history_count+1
   or (select jsonb_agg(to_jsonb(v) order by v.id) from app_private.combat_content_versions v
       where v.id<>result_row.id) is distinct from old_history
   or (select count(*) from app_private.combat_content_publications)<>publication_count
   or (select jsonb_agg(to_jsonb(p) order by p.content_key) from app_private.combat_content_publications p
       where p.content_key<>'wildwarden.field-remedy') is distinct from other_publications
   or (select jsonb_agg(to_jsonb(d) order by d.content_key) from app_private.combat_content_drafts d)
       is distinct from old_drafts
   or (select jsonb_agg(to_jsonb(r) order by r.content_key) from app_private.combat_content_records r
       where r.content_key<>'wildwarden.field-remedy') is distinct from old_records
   or (select jsonb_agg(to_jsonb(a) order by a.version_id) from app_private.combat_content_attribution a
       where a.version_id<>result_row.id) is distinct from old_attribution
   or not exists(select 1 from app_private.combat_content_attribution a
       where a.version_id=result_row.id and a.authored_by=actor and a.restored_from is null)
   or (select jsonb_agg(to_jsonb(p) order by p.version) from app_private.combat_effect_timing_policy_versions p)
       is distinct from old_policy_history
   or public.read_combat_effect_timing_policy_v1() is distinct from old_policy then
   raise exception 'FIELD_REMEDY_PRESERVATION_MISMATCH';
  end if;
  did_append:=true;
 else
  raise exception 'FIELD_REMEDY_BASELINE_CHANGED';
 end if;
 select * into strict current_row
  from public.read_current_combat_content_v1('wildwarden.field-remedy','skill');
 if current_row.content_version<>8 or current_row.definition is distinct from expected_after
  or not exists(select 1 from app_private.combat_content_publications p
   join app_private.combat_content_versions v on v.id=p.version_id
   where p.content_key='wildwarden.field-remedy' and p.content_kind='skill'
    and v.content_version=8 and v.definition=expected_after)
  or not exists(select 1 from jsonb_array_elements(public.read_combat_content_catalogue_v1()->'publications') v
   where v->>'content_key'='wildwarden.field-remedy' and v->>'content_kind'='skill'
    and (v->>'content_version')::integer=8 and v->'definition'=expected_after) then
  raise exception 'FIELD_REMEDY_READBACK_MISMATCH';
 end if;
 raise notice 'FIELD_REMEDY_VERIFIED appended=%',did_append;
end; $publish_field_remedy$;
commit;
