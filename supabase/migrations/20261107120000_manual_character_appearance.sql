begin;

alter table public.character_profile_display
  add column appearance_revision integer not null default 0 check (appearance_revision >= 0);

create unique index character_profile_display_manual_appearance_unique
  on public.character_profile_display (image_url)
  where image_url like '/api/media/appearance/1/%/neutral.svg';

create function app_private.bump_character_appearance_revision_v1()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.appearance_revision := 1;
  elsif new.image_url is distinct from old.image_url then
    new.appearance_revision := old.appearance_revision + 1;
  else
    new.appearance_revision := old.appearance_revision;
  end if;
  return new;
end;
$$;

create trigger character_appearance_revision
  before insert or update on public.character_profile_display
  for each row execute function app_private.bump_character_appearance_revision_v1();

create function public.commit_character_appearance_v1(
  p_user_id uuid, p_character_id uuid, p_expected_revision integer, p_image_url text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_revision integer;
  v_current_url text;
  v_constraint text;
begin
  if p_image_url is null
    or p_image_url !~ '^/api/media/appearance/1/[a-z]+(\.[a-z]+){11}/neutral\.svg$'
    or p_expected_revision is null or p_expected_revision < 0 then
    raise exception using errcode = '22023', message = 'CHARACTER_APPEARANCE_INVALID';
  end if;

  perform 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
      and not exists (
        select 1 from app_private.character_deletion_requests d where d.character_id = c.id
      )
    for update;
  if not found then
    raise exception using errcode = '42501', message = 'CHARACTER_NOT_PLAYABLE';
  end if;
  if exists (select 1 from public.get_active_battle_for_user_v1(p_user_id)) then
    raise exception using errcode = '22023', message = 'CHARACTER_APPEARANCE_ACTIVE_BATTLE';
  end if;

  select d.appearance_revision, d.image_url into v_revision, v_current_url
    from public.character_profile_display d
    where d.character_id = p_character_id
    for update;
  if found then
    if v_current_url = p_image_url then return v_revision; end if;
    if v_revision <> p_expected_revision then
      raise exception using errcode = 'PT409', message = 'CHARACTER_APPEARANCE_STALE';
    end if;
    update public.character_profile_display
      set image_url = p_image_url, updated_at = clock_timestamp()
      where character_id = p_character_id
      returning appearance_revision into v_revision;
  else
    if p_expected_revision <> 0 then
      raise exception using errcode = 'PT409', message = 'CHARACTER_APPEARANCE_STALE';
    end if;
    insert into public.character_profile_display (character_id, user_id, image_url)
      values (p_character_id, p_user_id, p_image_url)
      returning appearance_revision into v_revision;
  end if;
  return v_revision;
exception when unique_violation then
  get stacked diagnostics v_constraint = constraint_name;
  if v_constraint = 'character_profile_display_manual_appearance_unique' then
    raise exception using errcode = '23505', message = 'CHARACTER_APPEARANCE_DUPLICATE';
  end if;
  raise;
end;
$$;

-- The profile pointer and character are committed in the same transaction. A creation replay
-- returns its original character and never overwrites a subsequently selected appearance.
create function public.create_character_with_appearance_v1(
  p_user_id uuid,
  p_slot_index smallint,
  p_idempotency_key uuid,
  p_request_fingerprint text,
  p_rules_version integer,
  p_name text,
  p_name_key text,
  p_presentation_id text,
  p_pronoun_preset_id text,
  p_portrait_ref text,
  p_starter_appearance_ref text,
  p_foundation_discipline_id text,
  p_bonus_might integer,
  p_bonus_finesse integer,
  p_bonus_vitality integer,
  p_bonus_agility integer,
  p_bonus_intellect integer,
  p_bonus_resolve integer,
  p_expected_profile_version integer,
  p_appearance_url text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created jsonb;
begin
  select to_jsonb(c) into strict v_created
    from public.create_character_v4(
      p_user_id, p_slot_index, p_idempotency_key, p_request_fingerprint, p_rules_version,
      p_name, p_name_key, p_presentation_id, p_pronoun_preset_id, p_portrait_ref,
      p_starter_appearance_ref, p_foundation_discipline_id, p_bonus_might, p_bonus_finesse,
      p_bonus_vitality, p_bonus_agility, p_bonus_intellect, p_bonus_resolve,
      p_expected_profile_version
    ) c;
  if not (v_created->>'replayed')::boolean then
    perform public.commit_character_appearance_v1(
      p_user_id, (v_created->>'id')::uuid, 0, p_appearance_url
    );
  end if;
  return jsonb_build_array(v_created);
end;
$$;

revoke all on function app_private.bump_character_appearance_revision_v1() from public, anon, authenticated;
revoke all on function public.commit_character_appearance_v1(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.commit_character_appearance_v1(uuid, uuid, integer, text) to service_role;
revoke all on function public.create_character_with_appearance_v1(uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, text) from public, anon, authenticated;
grant execute on function public.create_character_with_appearance_v1(uuid, smallint, uuid, text, integer, text, text, text, text, text, text, text, integer, integer, integer, integer, integer, integer, integer, text) to service_role;

commit;
