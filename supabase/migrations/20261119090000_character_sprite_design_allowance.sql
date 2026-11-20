begin;

alter table public.character_profile_display
  add column confirmed_sprite_designs smallint not null default 0
    check (confirmed_sprite_designs between 0 and 2);

-- Count positively identified manual designs only. Portrait URLs and old portrait choices
-- do not prove a sprite confirmation, and the revision also counts battle activation.
update public.character_profile_display
set confirmed_sprite_designs =
  (appearance_image_url is not null)::integer + (pending_appearance_image_url is not null)::integer
where appearance_image_url is not null or pending_appearance_image_url is not null;

-- The existing write trigger protects both versions of the appearance RPC and counts
-- confirmation separately from revisions. Promoting a queued design keeps the same selection.
create or replace function app_private.bump_character_appearance_revision_v1()
returns trigger
language plpgsql set search_path = '' as $$
declare
  v_selected text := coalesce(new.pending_appearance_image_url, new.appearance_image_url);
begin
  if tg_op = 'INSERT' then
    new.appearance_revision := (v_selected is not null)::integer;
    if v_selected is not null then
      new.confirmed_sprite_designs := 1;
    end if;
    return new;
  end if;

  new.appearance_revision := old.appearance_revision;
  new.confirmed_sprite_designs := old.confirmed_sprite_designs;
  if new.appearance_image_url is distinct from old.appearance_image_url
     or new.pending_appearance_image_url is distinct from old.pending_appearance_image_url then
    new.appearance_revision := old.appearance_revision + 1;
  end if;
  if v_selected is distinct from coalesce(old.pending_appearance_image_url, old.appearance_image_url) then
    if old.confirmed_sprite_designs = 2 then
      raise exception using errcode = 'PT409', message = 'CHARACTER_APPEARANCE_LOCKED';
    end if;
    new.confirmed_sprite_designs := old.confirmed_sprite_designs + 1;
  end if;
  return new;
end;
$$;

-- Report the allowance in the same transaction as the authoritative confirmation.
create function public.commit_character_appearance_v3(
  p_user_id uuid, p_character_id uuid, p_expected_revision integer, p_image_url text
)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_appearance jsonb;
  v_remaining integer;
begin
  v_appearance := public.commit_character_appearance_v2(
    p_user_id, p_character_id, p_expected_revision, p_image_url
  );
  select 2 - d.confirmed_sprite_designs into strict v_remaining
    from public.character_profile_display d
    where d.character_id = p_character_id and d.user_id = p_user_id;
  return v_appearance || jsonb_build_object('remainingDesigns', v_remaining);
end;
$$;

-- The selected starter portrait is the initial look for creation requests with no manual
-- recipe. Store its allowance in the same transaction and keep the original replay fingerprint.
create or replace function public.create_character_with_appearance_v1(
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
language plpgsql security definer set search_path = '' as $$
declare
  v_created jsonb;
  v_character_id uuid;
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
    v_character_id := (v_created->>'id')::uuid;
    if p_appearance_url is null then
      insert into public.character_profile_display (character_id, user_id, confirmed_sprite_designs)
        values (v_character_id, p_user_id, 1);
    else
      perform public.commit_character_appearance_v1(p_user_id, v_character_id, 0, p_appearance_url);
    end if;
  end if;
  return jsonb_build_array(v_created);
end;
$$;

revoke all on function public.commit_character_appearance_v3(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.commit_character_appearance_v3(uuid, uuid, integer, text) to service_role;

commit;
