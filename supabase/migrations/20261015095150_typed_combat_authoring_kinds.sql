begin;

-- Tables already admit these kinds. Amend only the existing RPC guards and
-- Essence version stamping, preserving deployed authorization, locks and ACLs.
-- An unrecognized predecessor fails atomically instead of replacing its body.
do $migration$
declare
  v_signature text;
  v_definition text;
  v_old_guard text := $old$if p_content_kind not in ('skill','status','effect-profile') then$old$;
  v_new_guard text := $new$if p_content_kind is null or p_content_kind not in ('skill','essence','resonance','status','effect-profile') then$new$;
  v_publish_lock text := $lock$  perform pg_advisory_xact_lock(hashtextextended('combat-publish:' || p_content_key, 0));$lock$;
  v_version_assignment text := $version$  v_versioned_definition := jsonb_set(p_definition, '{contentVersion}', to_jsonb(v_next_version), true);$version$;
begin
  foreach v_signature in array array[
    'public.save_combat_content_draft_v1(uuid,text,text,jsonb,integer,bigint)',
    'public.publish_combat_content_v1(uuid,text,text,jsonb,integer)',
    'public.set_combat_content_publication_v1(uuid,text,text,integer)'
  ] loop
    v_definition := pg_get_functiondef(v_signature::regprocedure);
    if strpos(v_definition, v_old_guard) > 0 then
      v_definition := replace(v_definition, v_old_guard, v_new_guard);
    elsif strpos(v_definition, v_new_guard) = 0 then
      raise exception 'COMBAT_CONTENT_KIND_MIGRATION_PREDECESSOR_CONFLICT: %', v_signature;
    end if;

    if v_signature = 'public.publish_combat_content_v1(uuid,text,text,jsonb,integer)' then
      if strpos(v_definition, '-- Typed Essence/Resonance identity.') = 0 then
        if strpos(v_definition, v_publish_lock) = 0 then
          raise exception 'COMBAT_CONTENT_KIND_MIGRATION_PREDECESSOR_CONFLICT: publication lock';
        end if;
        v_definition := replace(v_definition, v_publish_lock, $identity$
  -- Typed Essence/Resonance identity. Drafts may still be incomplete.
  if p_content_kind = 'essence' and (
    jsonb_typeof(p_definition -> 'essenceId') is distinct from 'string'
    or p_definition ->> 'essenceId' is distinct from p_content_key
    or jsonb_typeof(p_definition -> 'skill') is distinct from 'object'
    or jsonb_typeof(p_definition -> 'skill' -> 'id') is distinct from 'string'
    or p_definition -> 'skill' ->> 'id' is distinct from p_content_key
  ) then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_IDENTITY_MISMATCH';
  end if;
  if p_content_kind = 'resonance' and (
    jsonb_typeof(p_definition -> 'id') is distinct from 'string'
    or p_definition ->> 'id' is distinct from p_content_key
  ) then
    raise exception using errcode = '22023', message = 'COMBAT_CONTENT_IDENTITY_MISMATCH';
  end if;
$identity$ || v_publish_lock);
      end if;
      if strpos(v_definition, '-- Version the complete Essence envelope.') = 0 then
        if strpos(v_definition, v_version_assignment) = 0 then
          raise exception 'COMBAT_CONTENT_KIND_MIGRATION_PREDECESSOR_CONFLICT: version assignment';
        end if;
        v_definition := replace(v_definition, v_version_assignment, v_version_assignment || $nested$
  -- Version the complete Essence envelope. Historical rows remain immutable.
  if p_content_kind = 'essence' then
    v_versioned_definition := jsonb_set(v_versioned_definition, '{skill,contentVersion}', to_jsonb(v_next_version), true);
  end if;
$nested$);
      end if;
    end if;
    execute v_definition;
  end loop;
end;
$migration$;

commit;
