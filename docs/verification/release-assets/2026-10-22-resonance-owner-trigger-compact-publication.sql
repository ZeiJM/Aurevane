-- Reduced-payload authoritative publication; dry-run reconstruction is 13/13 exact.
-- Live application prerequisite: trigger report code READY, CI passed.
-- Replace __CATALOGUE_TOKEN__ with fresh token from public.read_combat_content_catalogue_v1().
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '120s';
SELECT app_private.lock_combat_content_catalogue_v1('__CATALOGUE_TOKEN__');
DO $trigger_repair$
DECLARE
  items jsonb := $records$[{"id":"resonance.bastion-vanguard.linked-sequence","digest":"af1e8df399a5dc2ce2bfb14627040be1","version":8},{"id":"resonance.chronist-ironfist.linked-sequence","digest":"7d9c29c635042b75705756a4df1961fc","version":11},{"id":"resonance.cinderweaver-ravager.linked-sequence","digest":"c9cebfd8770af4589f5f7202adec3cb1","version":11},{"id":"resonance.edgedancer-ironfist.linked-sequence","digest":"10d6fb31e4917483deae08f6dc8b5504","version":8},{"id":"resonance.edgedancer-shadehand.linked-sequence","digest":"b836a4ad0b7f7efbd790921cef649360","version":10},{"id":"resonance.edgedancer-vanguard.linked-sequence","digest":"7b188645e1ce5ae4ba50d47d72fcd67b","version":10},{"id":"resonance.frostweaver-ravager.linked-sequence","digest":"420f63c927490c52a82d0f4b5d2a853c","version":11},{"id":"resonance.ironfist-ravager.linked-sequence","digest":"e33c2df9c0cb316c2afe621673048cde","version":11},{"id":"resonance.ironfist-shadehand.broken-rhythm","digest":"b77094623ed7ebcde927292a20327d82","version":10},{"id":"resonance.ravager-shadehand.linked-sequence","digest":"9b5ba940d6f9c1f56aeff6e9b60d8c5c","version":11},{"id":"resonance.ravager-stormsinger.linked-sequence","digest":"58bfe052d53928b41fb0b33afc55ae76","version":11},{"id":"resonance.shadehand-stormsinger.linked-sequence","digest":"d97082a444bd14e454e67b9d773d29ac","version":11},{"id":"resonance.shadehand-vanguard.broken-line","digest":"6f47f78d8a737f63d60d8cf07367f887","version":10}]$records$::jsonb;
  row jsonb;
  operator_id uuid;
  operator_count integer;
  current_definition jsonb;
  next_definition jsonb;
  current_version integer;
  highest_version integer;
  inserted record;
BEGIN
  SELECT count(*) INTO operator_count
    FROM app_private.master_panel_role_assignments WHERE role='game-owner' AND enabled;
  SELECT user_id INTO operator_id
    FROM app_private.master_panel_role_assignments WHERE role='game-owner' AND enabled LIMIT 1;
  IF operator_count <> 1 THEN RAISE EXCEPTION 'RESONANCE_REPAIR_OWNER_REQUIRED'; END IF;
  PERFORM app_private.assert_game_owner_v1(operator_id);
  IF (SELECT count(*) FROM app_private.combat_content_versions) <> 1097
    OR (SELECT count(*) FROM app_private.combat_content_publications) <> 294
    OR (SELECT count(*) FROM app_private.combat_content_publications WHERE content_kind='resonance') <> 136
    OR EXISTS(SELECT 1 FROM app_private.combat_content_drafts)
    OR (public.read_combat_effect_timing_policy_v1()->>'version')::int <> 8
    OR jsonb_array_length(items) <> 13
    OR (SELECT count(distinct x->>'id') FROM jsonb_array_elements(items) x) <> 13
  THEN RAISE EXCEPTION 'RESONANCE_REPAIR_INVENTORY_CHANGED'; END IF;
  -- Exact source hashes and version maxima fail closed before any publication.
  FOR row IN SELECT value FROM jsonb_array_elements(items) LOOP
    SELECT v.definition,v.content_version INTO current_definition,current_version
      FROM app_private.combat_content_publications p
      JOIN app_private.combat_content_versions v ON v.id=p.version_id
      WHERE p.content_kind='resonance' AND p.content_key=row->>'id';
    SELECT MAX(content_version) INTO highest_version FROM app_private.combat_content_versions
      WHERE content_kind='resonance' AND content_key=row->>'id';
    IF current_definition IS NULL
      OR current_version IS DISTINCT FROM (row->>'version')::int
      OR highest_version IS DISTINCT FROM current_version
      OR md5(current_definition::text) IS DISTINCT FROM row->>'digest'
      OR current_definition#>>'{ability,behaviors,0,automaticTrigger}' IS DISTINCT FROM 'damage-dealt'
      OR current_definition#>>'{ability,behaviors,0,automaticTarget,subject}' IS DISTINCT FROM 'affected'
    THEN RAISE EXCEPTION 'RESONANCE_REPAIR_SOURCE_DRIFT: %',row->>'id'; END IF;
  END LOOP;
  FOR row IN SELECT value FROM jsonb_array_elements(items) LOOP
    SELECT v.definition,v.content_version INTO current_definition,current_version
      FROM app_private.combat_content_publications p JOIN app_private.combat_content_versions v ON v.id=p.version_id
      WHERE p.content_kind='resonance' AND p.content_key=row->>'id';
    next_definition := jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(current_definition,'{ability,behaviors,0,automaticTrigger}',to_jsonb('enemy-turn-started'::text),true),
          '{ability,behaviors,0,automaticTarget}','{"subject":"triggering"}'::jsonb,true),
        '{contentVersion}',to_jsonb(current_version+1),false),
      '{authoring,validationTags}',(current_definition#>'{authoring,validationTags}') || '["owner-trigger-recovery-20261022"]'::jsonb,false);
    SELECT * INTO inserted FROM app_private.publish_combat_content_with_floor_v1(
      operator_id,row->>'id','resonance',next_definition,current_version,current_version
    );
    IF inserted.definition IS DISTINCT FROM next_definition
      OR inserted.content_version IS DISTINCT FROM current_version+1
    THEN RAISE EXCEPTION 'RESONANCE_REPAIR_READBACK_FAILED: %',row->>'id'; END IF;
  END LOOP;
  IF (SELECT count(*) FROM app_private.combat_content_versions) <> 1110
    OR (SELECT count(*) FROM app_private.combat_content_publications) <> 294
  THEN RAISE EXCEPTION 'RESONANCE_REPAIR_HISTORY_MISMATCH'; END IF;
END
$trigger_repair$;
COMMIT;
