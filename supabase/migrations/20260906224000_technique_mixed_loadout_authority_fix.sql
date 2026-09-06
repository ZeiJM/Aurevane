-- Reconcile the database-owned Discipline Technique save RPC with the
-- Owner-approved four-slot mixed loadout contract.
--
-- Full mixed loadouts must use both active Disciplines (1-3 / 2-2 / 3-1),
-- while partial mixed loadouts remain legal so a Discipline transition cannot
-- strand an otherwise valid character build between edits.

do $migration$
declare
  v_function_oid oid;
  v_definition text;
  v_updated text;
begin
  select p.oid
  into v_function_oid
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'save_character_discipline_skill_loadout_v1'
    and pg_get_function_identity_arguments(p.oid) =
      'p_user_id uuid, p_character_id uuid, p_expected_build_version bigint, p_skills jsonb, p_idempotency_key uuid, p_request_fingerprint text';

  if v_function_oid is null then
    raise exception 'save_character_discipline_skill_loadout_v1 was not found';
  end if;

  v_definition := pg_get_functiondef(v_function_oid);

  if strpos(v_definition, 'v_primary_count > 2 or v_secondary_count > 2') = 0 then
    raise exception 'Expected legacy mixed Technique source-capacity guard was not found';
  end if;

  if strpos(v_definition, E'  end loop;\n\n  select coalesce(jsonb_agg') = 0 then
    raise exception 'Expected mixed Technique validation insertion point was not found';
  end if;

  v_updated := replace(
    v_definition,
    'v_primary_count > 2 or v_secondary_count > 2',
    'v_primary_count > 3 or v_secondary_count > 3'
  );

  v_updated := replace(
    v_updated,
    E'  end loop;\n\n  select coalesce(jsonb_agg',
    E'  end loop;\n\n  if v_build.secondary_discipline_id is not null\n    and v_count = 4\n    and (v_primary_count = 0 or v_secondary_count = 0) then\n    raise exception using errcode = ''22023'', message = ''DISCIPLINE_SKILL_SOURCE_REQUIRED'';\n  end if;\n\n  select coalesce(jsonb_agg'
  );

  execute v_updated;
end
$migration$;
