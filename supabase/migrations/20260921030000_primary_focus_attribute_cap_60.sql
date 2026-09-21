begin;

-- Primary focus Core Stats now have an owner-approved effective ceiling of 60.
-- Keep the existing validator signature so every current caller (creation, spending,
-- reset/conversion and Primary changes) receives the rule without widening public RPCs.
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
  if p_require_full and v_personal_spent <> v_personal_pool then
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

comment on column app_private.discipline_primary_profiles.focus_attributes is
  'Two or three Core Stats that define this Primary identity. Current effective focus ceiling: 60.';

-- Existing characters above the new focus ceiling keep their stored stats and point entitlement,
-- but must complete the existing free conversion workflow before further allocation changes.
update app_private.character_attribute_personal_allocations personal
set
  conversion_required = true,
  updated_at = clock_timestamp()
from public.characters character,
     app_private.discipline_primary_profiles profile
where character.id = personal.character_id
  and profile.discipline_id = personal.primary_discipline_id
  and profile.profile_version = personal.primary_profile_version
  and (
    ('might' = any(profile.focus_attributes) and character.might > 60)
    or ('finesse' = any(profile.focus_attributes) and character.finesse > 60)
    or ('vitality' = any(profile.focus_attributes) and character.vitality > 60)
    or ('agility' = any(profile.focus_attributes) and character.agility > 60)
    or ('intellect' = any(profile.focus_attributes) and character.intellect > 60)
    or ('resolve' = any(profile.focus_attributes) and character.resolve > 60)
  );

commit;
