begin;

create or replace function app_private.validate_character_core_allocation_v1(
  p_might integer,
  p_finesse integer,
  p_vitality integer,
  p_agility integer,
  p_intellect integer,
  p_resolve integer,
  p_level integer,
  p_base jsonb,
  p_focus text[],
  p_off_focus_cap integer,
  p_require_full boolean
)
returns void
language plpgsql
set search_path = pg_catalog, public, app_private
as $$
declare
  v_personal_pool integer;
  v_personal_spent integer;
begin
  if p_level is null or p_level not between 1 and 100 then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_LEVEL_INVALID';
  end if;
  if p_base is null or p_focus is null or p_off_focus_cap is null then
    raise exception using errcode = 'P0001', message = 'CHARACTER_ATTRIBUTE_PRIMARY_PROFILE_UNAVAILABLE';
  end if;
  if p_might is null or p_finesse is null or p_vitality is null
    or p_agility is null or p_intellect is null or p_resolve is null then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_VALUE_INVALID';
  end if;

  if p_might < (p_base ->> 'might')::integer
    or p_finesse < (p_base ->> 'finesse')::integer
    or p_vitality < (p_base ->> 'vitality')::integer
    or p_agility < (p_base ->> 'agility')::integer
    or p_intellect < (p_base ->> 'intellect')::integer
    or p_resolve < (p_base ->> 'resolve')::integer then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_BELOW_PRIMARY_BASE';
  end if;

  v_personal_pool := 5 + p_level - 1;
  v_personal_spent :=
    p_might - (p_base ->> 'might')::integer +
    p_finesse - (p_base ->> 'finesse')::integer +
    p_vitality - (p_base ->> 'vitality')::integer +
    p_agility - (p_base ->> 'agility')::integer +
    p_intellect - (p_base ->> 'intellect')::integer +
    p_resolve - (p_base ->> 'resolve')::integer;

  if v_personal_spent > v_personal_pool then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_POINT_POOL_EXCEEDED';
  end if;
  -- Entitlement is never discarded. Full spend means all legally usable points;
  -- an overflow is retained only when every stat has reached its actual cap.
  if p_require_full and v_personal_spent < least(v_personal_pool, (
    select sum((case when key = any(p_focus) then 60 else p_off_focus_cap end) - value::integer)
    from jsonb_each_text(p_base)
  )) then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL';
  end if;

  if ('might' = any(p_focus) and p_might > 60)
    or ('finesse' = any(p_focus) and p_finesse > 60)
    or ('vitality' = any(p_focus) and p_vitality > 60)
    or ('agility' = any(p_focus) and p_agility > 60)
    or ('intellect' = any(p_focus) and p_intellect > 60)
    or ('resolve' = any(p_focus) and p_resolve > 60)
    or ('might' <> all(p_focus) and p_might > p_off_focus_cap)
    or ('finesse' <> all(p_focus) and p_finesse > p_off_focus_cap)
    or ('vitality' <> all(p_focus) and p_vitality > p_off_focus_cap)
    or ('agility' <> all(p_focus) and p_agility > p_off_focus_cap)
    or ('intellect' <> all(p_focus) and p_intellect > p_off_focus_cap)
    or ('resolve' <> all(p_focus) and p_resolve > p_off_focus_cap) then
    raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_DISCIPLINE_CAP_EXCEEDED';
  end if;
end;
$$;

-- Expose the exact pinned policy used by correction validation, rather than a
-- guessed builtin/current catalogue policy. Authorization, CAS and audit stay intact.
do $migration$
declare definition text; predecessor text;
begin
 definition:=pg_get_functiondef('public.read_master_player_v1(uuid,uuid,uuid)'::regprocedure);
 predecessor:=$before$'facts',app_private.player_support_facts_v1(p_character_id),$before$;
 if strpos(definition,predecessor)=0 then raise exception 'PLAYER_CORE_POLICY_PREDECESSOR_CONFLICT'; end if;
 definition:=replace(definition,predecessor,$after$'attributePolicy',(
   select jsonb_build_object('disciplineId',profile.discipline_id,'policyVersion',profile.profile_version,
     'baseAttributes',profile.core_base_attributes,'focusAttributes',profile.focus_attributes,'offFocusCap',profile.off_focus_cap)
   from app_private.character_active_builds build join app_private.discipline_primary_profiles profile
     on profile.discipline_id=build.primary_discipline_id and profile.profile_version=build.primary_profile_version
   where build.character_id=p_character_id),
 'facts',app_private.player_support_facts_v1(p_character_id),$after$);
 execute definition;
end; $migration$;

-- V2 reset delegates persistence to V1 after validating the Primary caps. The old
-- V1 unconditional full-pool check must use that same validator for an overflow;
-- direct retained V1 calls gain the same cap/base checks before accepting less.
do $migration$
declare definition text; predecessor text;
begin
 definition:=pg_get_functiondef('public.commit_character_attribute_allocation_v1(uuid,uuid,text,integer,integer,integer,integer,integer,integer,uuid,text)'::regprocedure);
 if strpos(definition,'  v_pool integer;')=0 then raise exception 'ALLOCATION_CAPACITY_DECLARATION_CONFLICT'; end if;
 definition:=replace(definition,'  v_pool integer;','  v_pool integer; v_profile app_private.discipline_primary_profiles%rowtype;');
 predecessor:=$before$    if v_spent <> v_pool then
      raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL';
    end if;$before$;
 if strpos(definition,predecessor)=0 then raise exception 'ALLOCATION_CAPACITY_PREDECESSOR_CONFLICT'; end if;
 definition:=replace(definition,predecessor,$after$    if v_spent <> v_pool then
      select profile.* into v_profile
      from app_private.character_attribute_personal_allocations personal
      join app_private.discipline_primary_profiles profile
        on profile.discipline_id=personal.primary_discipline_id and profile.profile_version=personal.primary_profile_version
      where personal.character_id=p_character_id and personal.user_id=p_user_id;
      if not found then
        raise exception using errcode = '22023', message = 'CHARACTER_ATTRIBUTE_RESET_MUST_SPEND_FULL_POOL';
      end if;
      perform app_private.validate_character_core_allocation_v1(
        p_might,p_finesse,p_vitality,p_agility,p_intellect,p_resolve,v_character.level,
        v_profile.core_base_attributes,v_profile.focus_attributes,v_profile.off_focus_cap,true);
    end if;$after$);
 execute definition;
end; $migration$;

-- A replay acknowledges a prior commit; it cannot reapply its old personal-point
-- projection over a newer spend or require points earned after the original save.
-- Ownership rows are already locked, and the immutable receipt must match both
-- request fingerprint and target character before returning the current allocation.
do $migration$
declare definition text; predecessor text;
begin
 definition:=pg_get_functiondef('public.commit_character_attribute_allocation_v2(uuid,uuid,text,integer,integer,integer,integer,integer,integer,uuid,text)'::regprocedure);
 predecessor:=$before$  select profile.* into v_profile
  from app_private.discipline_primary_profiles profile
  where profile.discipline_id = v_personal.primary_discipline_id$before$;
 if strpos(definition,predecessor)=0 then raise exception 'ALLOCATION_REPLAY_PREDECESSOR_CONFLICT'; end if;
 definition:=replace(definition,predecessor,$after$  select record.* into v_existing
  from app_private.idempotency_records record
  where record.actor_key=v_actor_key
    and record.command_name=case when p_mode='convert' then v_command_name else 'character.attributes.allocate.v1' end
    and record.idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_fingerprint is distinct from p_request_fingerprint
      or not exists(select 1 from app_private.character_attribute_change_audit audit
        where audit.id=(v_existing.result->>'change_id')::uuid
          and audit.character_id=p_character_id and audit.user_id=p_user_id and audit.change_mode=p_mode) then
      raise exception using errcode='22023',message='CHARACTER_ATTRIBUTE_IDEMPOTENCY_CONFLICT';
    end if;
    return query select allocation.*,true
    from public.get_character_attribute_allocation_v2(p_user_id,p_character_id) allocation;
    return;
  end if;

  select profile.* into v_profile
  from app_private.discipline_primary_profiles profile
  where profile.discipline_id = v_personal.primary_discipline_id$after$);
 execute definition;
end; $migration$;

commit;
