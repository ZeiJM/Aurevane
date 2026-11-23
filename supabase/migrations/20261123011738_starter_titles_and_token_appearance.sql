begin;

drop index public.characters_personal_title_key_unique;
update public.characters set personal_title = null, personal_title_key = null, personal_title_set_at = null
  where personal_title is not null;
alter table public.characters add constraint characters_starter_title_only
  check (personal_title is null or personal_title in ('Roadfarer', 'Dawn Seeker', 'Horizon Wanderer'));
comment on column public.characters.personal_title is 'Equipped cosmetic title from the shared starter catalog.';
comment on column public.characters.personal_title_key is 'Canonical key for the equipped title.';
comment on column public.characters.personal_title_set_at is 'Time the currently equipped title was selected.';

create or replace function public.set_character_personal_title_v1(
  p_user_id uuid, p_character_id uuid, p_title text
) returns table (personal_title text, personal_title_set_at timestamptz)
language plpgsql security definer set search_path = '' as $$
begin
  if p_title is null or p_title not in ('Roadfarer', 'Dawn Seeker', 'Horizon Wanderer') then
    raise exception using errcode = '22023', message = 'PERSONAL_TITLE_INVALID';
  end if;
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);
  return query
    update public.characters c
    set personal_title = p_title,
        personal_title_key = lower(replace(p_title, ' ', '')),
        personal_title_set_at = case when c.personal_title = p_title
          then c.personal_title_set_at else clock_timestamp() end
    where c.id = p_character_id and c.user_id = p_user_id
      and not exists (
        select 1 from app_private.character_deletion_requests d where d.character_id = c.id
      )
    returning c.personal_title, c.personal_title_set_at;
  if not found then
    raise exception using errcode = '42501', message = 'CHARACTER_NOT_PLAYABLE';
  end if;
end;
$$;

-- Built-in portraits are still the fallback for characters without a designed appearance.
update public.character_profile_display set image_url = null where image_url is not null;
alter table public.character_profile_display add constraint character_profile_builtin_image_only
  check (image_url is null);
revoke execute on function public.set_character_default_portrait_v1(uuid, uuid, text) from service_role;

create or replace function app_private.bump_character_appearance_revision_v1()
returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.appearance_revision :=
      (new.appearance_image_url is not null or new.pending_appearance_image_url is not null)::integer;
  elsif new.appearance_image_url is distinct from old.appearance_image_url
     or new.pending_appearance_image_url is distinct from old.pending_appearance_image_url then
    new.appearance_revision := old.appearance_revision + 1;
  else
    new.appearance_revision := old.appearance_revision;
  end if;
  return new;
end;
$$;

create function public.read_character_appearance_tokens_v1(p_user_id uuid, p_character_id uuid)
returns integer language sql stable security definer set search_path = '' as $$
  select coalesce(sum(s.quantity), 0)::integer
  from public.characters c
  left join app_private.character_item_stacks s
    on s.character_id = c.id and s.item_id = 'item.appearance-token'
  where c.id = p_character_id and c.user_id = p_user_id
    and not exists (
      select 1 from app_private.character_deletion_requests d where d.character_id = c.id
    )
  group by c.id
$$;

create function public.commit_character_appearance_v4(
  p_user_id uuid, p_character_id uuid, p_expected_revision integer, p_image_url text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  appearance jsonb;
  before_revision integer;
  token_stack app_private.character_item_stacks%rowtype;
begin
  -- The inventory lock follows the shared account, character, build and inventory order.
  -- A look saved during battle is queued by the existing appearance authority.
  perform app_private.lock_character_item_inventory_v1(p_user_id, p_character_id, false);
  select coalesce((
    select d.appearance_revision from public.character_profile_display d
    where d.character_id = p_character_id
  ), 0) into before_revision;
  appearance := public.commit_character_appearance_v2(
    p_user_id, p_character_id, p_expected_revision, p_image_url
  );
  if (appearance->>'revision')::integer <> before_revision then
    select * into token_stack from app_private.character_item_stacks
      where character_id = p_character_id and item_id = 'item.appearance-token'
      order by slot_index limit 1 for update;
    if not found then
      raise exception using errcode = 'PT409', message = 'APPEARANCE_TOKEN_REQUIRED';
    end if;
    if token_stack.quantity = 1 then
      delete from app_private.character_item_stacks where id = token_stack.id;
    else
      update app_private.character_item_stacks set quantity = quantity - 1 where id = token_stack.id;
    end if;
    update app_private.character_item_inventory set revision = revision + 1
      where character_id = p_character_id;
  end if;
  return appearance || jsonb_build_object(
    'appearanceTokens', public.read_character_appearance_tokens_v1(p_user_id, p_character_id)
  );
end;
$$;

revoke all on function public.read_character_appearance_tokens_v1(uuid, uuid),
  public.commit_character_appearance_v4(uuid, uuid, integer, text) from public, anon, authenticated;
grant execute on function public.read_character_appearance_tokens_v1(uuid, uuid),
  public.commit_character_appearance_v4(uuid, uuid, integer, text) to service_role;
revoke execute on function public.commit_character_appearance_v1(uuid, uuid, integer, text),
  public.commit_character_appearance_v2(uuid, uuid, integer, text),
  public.commit_character_appearance_v3(uuid, uuid, integer, text) from service_role;

commit;
