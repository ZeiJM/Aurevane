begin;

alter table public.characters
  add column personal_title text,
  add column personal_title_key text,
  add column personal_title_set_at timestamptz;

alter table public.characters
  add constraint characters_personal_title_shape check (
    personal_title is null
    or (
      char_length(personal_title) between 1 and 20
      and personal_title = btrim(personal_title)
      and personal_title !~ '  '
      and personal_title ~ '^[A-Za-z0-9 ]+$'
    )
  ),
  add constraint characters_personal_title_pair check (
    (personal_title is null and personal_title_key is null and personal_title_set_at is null)
    or (personal_title is not null and personal_title_key is not null and personal_title_set_at is not null)
  );

create unique index characters_personal_title_key_unique
  on public.characters (personal_title_key)
  where personal_title_key is not null;

comment on column public.characters.personal_title is
  'One-time personal character title. Cosmetic identity only; grants no gameplay power.';
comment on column public.characters.personal_title_key is
  'Canonical collision key for the one-time personal character title.';
comment on column public.characters.personal_title_set_at is
  'Timestamp of definitive personal-title confirmation. Non-null means the free personal title opportunity has been used.';

create or replace function public.get_character_personal_title_v1(
  p_user_id uuid,
  p_character_id uuid
)
returns table (
  personal_title text,
  personal_title_set_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  return query
  select character.personal_title, character.personal_title_set_at
  from public.characters character
  left join app_private.character_deletion_requests deletion
    on deletion.character_id = character.id
  where character.id = p_character_id
    and character.user_id = p_user_id
    and deletion.character_id is null;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_PLAYABLE';
  end if;
end;
$$;

revoke all on function public.get_character_personal_title_v1(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.get_character_personal_title_v1(uuid, uuid) to service_role;

create or replace function public.set_character_personal_title_v1(
  p_user_id uuid,
  p_character_id uuid,
  p_title text
)
returns table (
  personal_title text,
  personal_title_set_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_title text;
  v_title_key text;
  v_set_at timestamptz := clock_timestamp();
  v_existing_set_at timestamptz;
begin
  perform app_private.finalize_due_character_deletions_for_user_v1(p_user_id);

  v_title := regexp_replace(btrim(coalesce(p_title, '')), '[[:space:]]+', ' ', 'g');
  v_title_key := lower(replace(v_title, ' ', ''));

  if char_length(v_title) < 1 or char_length(v_title) > 20 or v_title !~ '^[A-Za-z0-9 ]+$' then
    raise exception using errcode = '22023', message = 'PERSONAL_TITLE_INVALID';
  end if;

  select character.personal_title_set_at
    into v_existing_set_at
  from public.characters character
  left join app_private.character_deletion_requests deletion
    on deletion.character_id = character.id
  where character.id = p_character_id
    and character.user_id = p_user_id
    and deletion.character_id is null
  for update of character;

  if not found then
    raise exception using errcode = 'P0001', message = 'CHARACTER_NOT_PLAYABLE';
  end if;

  if v_existing_set_at is not null then
    raise exception using errcode = 'P0001', message = 'PERSONAL_TITLE_ALREADY_SET';
  end if;

  if exists (
    select 1
    from public.characters other
    where other.personal_title_key = v_title_key
      and other.id <> p_character_id
  ) then
    raise exception using errcode = 'P0001', message = 'PERSONAL_TITLE_UNAVAILABLE';
  end if;

  update public.characters character
  set personal_title = v_title,
      personal_title_key = v_title_key,
      personal_title_set_at = v_set_at
  where character.id = p_character_id
    and character.user_id = p_user_id;

  return query select v_title, v_set_at;
exception
  when unique_violation then
    raise exception using errcode = 'P0001', message = 'PERSONAL_TITLE_UNAVAILABLE';
end;
$$;

revoke all on function public.set_character_personal_title_v1(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.set_character_personal_title_v1(uuid, uuid, text) to service_role;

commit;
