-- Run with psql -v ON_ERROR_STOP=1 -f on a disposable, fully migrated Supabase stack.
-- Fixtures always roll back; no pgTAP extension is required.
-- Also executed verbatim by packages/db/src/repeatable-default-portrait-choice.test.ts.
begin;
set local plpgsql.check_asserts = on;
insert into auth.users(id) values ('82000000-0000-4000-8000-000000000001'), ('82000000-0000-4000-8000-000000000002');
insert into public.player_profiles(user_id) values ('82000000-0000-4000-8000-000000000001'), ('82000000-0000-4000-8000-000000000002') on conflict do nothing;
insert into public.characters(
  id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
  portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,
  level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
)
select '82000000-0000-4000-8000-000000000011'::uuid,'82000000-0000-4000-8000-000000000001'::uuid,0,1,
  'Portrait Regression','portrait regression','presentation.test','pronoun.they',
  'portrait.adventure.male-01','appearance.test',definition.discipline_id,
  (profile.core_base_attributes->>'might')::integer+1,
  (profile.core_base_attributes->>'finesse')::integer+1,
  (profile.core_base_attributes->>'vitality')::integer+1,
  (profile.core_base_attributes->>'agility')::integer+1,
  (profile.core_base_attributes->>'intellect')::integer+1,
  (profile.core_base_attributes->>'resolve')::integer,
  1,0,1,clock_timestamp(),clock_timestamp(),clock_timestamp()
from (
  select distinct on (d.discipline_id) d.discipline_id,d.primary_profile_version
  from app_private.discipline_definitions d where d.enabled_for_primary
  order by d.discipline_id,d.definition_version desc limit 1
) definition
join app_private.discipline_primary_profiles profile on profile.discipline_id=definition.discipline_id and profile.profile_version=definition.primary_profile_version;

do $$
declare
  v_user uuid := '82000000-0000-4000-8000-000000000001';
  v_character uuid := '82000000-0000-4000-8000-000000000011';
  v_before jsonb;
  v_after jsonb;
  v_changed_at timestamptz;
  v_ref text;
  v_invalid text;
  v_role text;
begin
  assert exists (select 1 from public.characters where id=v_character), 'portrait fixture was provisioned';
  -- A never-changed same-choice request is a true no-op, with no fabricated timestamp.
  select to_jsonb(c) into v_before from public.characters c where id=v_character;
  select portrait_ref,changed_at into v_ref,v_changed_at from public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.male-01');
  assert v_ref='portrait.adventure.male-01' and v_changed_at is null, 'initial same choice receipt';
  assert (select to_jsonb(c)=v_before from public.characters c where id=v_character), 'initial retry preserves character';
  assert not exists (select 1 from public.character_profile_display where character_id=v_character), 'initial retry creates no display row';

  -- Existing accounts that consumed the former one-time swap can switch and switch back.
  update public.characters set default_portrait_changed_at='2026-10-03T00:00:00Z' where id=v_character;
  insert into public.character_profile_display(character_id,user_id,image_url) values(v_character,v_user,'https://example.test/custom.png');
  select to_jsonb(c)-'portrait_ref'-'default_portrait_changed_at' into v_before from public.characters c where id=v_character;
  select portrait_ref,changed_at into v_ref,v_changed_at from public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.female-12');
  assert v_ref='portrait.adventure.female-12' and v_changed_at>'2026-10-03T00:00:00Z', 'previously used character can change';
  assert (select image_url is null and updated_at=v_changed_at from public.character_profile_display where character_id=v_character), 'switch clears custom image';
  select portrait_ref,changed_at into v_ref,v_changed_at from public.set_character_default_portrait_v1(v_user,v_character,'portrait.starter.wayfarer-40');
  assert v_ref='portrait.starter.wayfarer-40' and v_changed_at is not null, 'legacy reference remains allowed';
  select portrait_ref,changed_at into v_ref,v_changed_at from public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.male-01');
  assert v_ref='portrait.adventure.male-01' and v_changed_at is not null, 'return to a prior choice';
  assert (select to_jsonb(c)-'portrait_ref'-'default_portrait_changed_at'=v_before from public.characters c where id=v_character), 'portrait changes preserve progression and last activity';

  -- Retrying a successful choice does not rewrite either row or touch activity.
  select jsonb_build_object('character',to_jsonb(c),'display',to_jsonb(d),'characterRow',c.ctid::text,'displayRow',d.ctid::text) into v_before
  from public.characters c join public.character_profile_display d on d.character_id=c.id where c.id=v_character;
  perform public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.male-01');
  select jsonb_build_object('character',to_jsonb(c),'display',to_jsonb(d),'characterRow',c.ctid::text,'displayRow',d.ctid::text) into v_after
  from public.characters c join public.character_profile_display d on d.character_id=c.id where c.id=v_character;
  assert v_before=v_after, 'same choice retry writes no rows';

  update public.character_profile_display set image_url='https://example.test/replacement.png' where character_id=v_character;
  select changed_at into v_changed_at from public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.male-01');
  assert (select image_url is null and updated_at=v_changed_at from public.character_profile_display where character_id=v_character), 'same built-in choice replaces a custom image';

  -- Exercise every allowed reference rather than accepting a widened regex by accident.
  for v_ref in select 'portrait.starter.wayfarer-'||lpad(n::text,2,'0') from generate_series(1,40) n
    union all select 'portrait.adventure.'||gender||'-'||lpad(n::text,2,'0') from unnest(array['male','female']) gender cross join generate_series(1,12) n
  loop
    perform public.set_character_default_portrait_v1(v_user,v_character,v_ref);
  end loop;
  select to_jsonb(c) into v_before from public.characters c where id=v_character;
  foreach v_invalid in array array[null,'','portrait.adventure.male-00','portrait.adventure.male-13','portrait.adventure.female-13','portrait.starter.wayfarer-41','portrait.starter.wayfarer-1','portrait.forged','https://example.test/image.png','portrait.adventure.male-01'||chr(10)] loop
    begin
      perform public.set_character_default_portrait_v1(v_user,v_character,v_invalid);
      raise exception 'expected PORTRAIT_INVALID for %',v_invalid;
    exception when raise_exception then
      if sqlerrm <> 'PORTRAIT_INVALID' then raise; end if;
    end;
  end loop;
  begin
    perform public.set_character_default_portrait_v1('82000000-0000-4000-8000-000000000002',v_character,'portrait.adventure.male-01');
    raise exception 'foreign character accepted';
  exception when raise_exception then
    if sqlerrm <> 'CHARACTER_NOT_PLAYABLE' then raise; end if;
  end;
  begin
    perform public.set_character_default_portrait_v1(v_user,'82000000-0000-4000-8000-000000000099','portrait.adventure.male-01');
    raise exception 'missing character accepted';
  exception when raise_exception then
    if sqlerrm <> 'CHARACTER_NOT_PLAYABLE' then raise; end if;
  end;
  set local role service_role;
  perform public.set_character_default_portrait_v1(v_user,v_character,v_ref);
  reset role;
  insert into app_private.character_deletion_requests(character_id,user_id,requested_at,delete_after) values(v_character,v_user,now(),now()+interval '24 hours');
  begin
    perform public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.male-01');
    raise exception 'deleted character accepted';
  exception when raise_exception then
    if sqlerrm <> 'CHARACTER_NOT_PLAYABLE' then raise; end if;
  end;
  assert (select to_jsonb(c)=v_before from public.characters c where id=v_character), 'denied requests preserve character';
  foreach v_role in array array['anon','authenticated'] loop
    assert not has_function_privilege(v_role,'public.set_character_default_portrait_v1(uuid,uuid,text)','execute'), 'browser cannot call mutation';
    assert not has_function_privilege(v_role,'public.get_character_portrait_choice_v1(uuid,uuid)','execute'), 'browser cannot call reader';
    execute format('set local role %I',v_role);
    begin
      perform public.set_character_default_portrait_v1(v_user,v_character,'portrait.adventure.male-01');
      raise exception 'browser mutation accepted';
    exception when insufficient_privilege then null;
    end;
    reset role;
  end loop;
  assert has_function_privilege('service_role','public.set_character_default_portrait_v1(uuid,uuid,text)','execute'), 'server can call mutation';
end;
$$;
rollback;
