begin;

comment on column public.characters.default_portrait_changed_at is
  'Last default portrait selection change, including replacing a custom image with the selected default. Null until the first change.';

create or replace function public.set_character_default_portrait_v1(p_user_id uuid, p_character_id uuid, p_portrait_ref text)
returns table (portrait_ref text, changed_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  v_current text;
  v_changed_at timestamptz;
  v_custom_image_url text;
begin
  -- Same exact 40 legacy and 24 current creation references as the server catalogue.
  if p_portrait_ref is null or p_portrait_ref !~ '^portrait\.(starter\.wayfarer-(0[1-9]|[1-3][0-9]|40)|adventure\.(male|female)-(0[1-9]|1[0-2]))$' then
    raise exception 'PORTRAIT_INVALID';
  end if;
  select c.portrait_ref, c.default_portrait_changed_at into v_current, v_changed_at
  from public.characters c
  where c.id = p_character_id and c.user_id = p_user_id
    and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
  for update of c;
  if not found then raise exception 'CHARACTER_NOT_PLAYABLE'; end if;
  select d.image_url into v_custom_image_url
  from public.character_profile_display d where d.character_id = p_character_id
  for update of d;
  -- A retry does not rewrite rows or activity; an existing custom image still needs replacing.
  if v_current = p_portrait_ref and v_custom_image_url is null then
    return query select v_current, v_changed_at;
    return;
  end if;
  v_changed_at := clock_timestamp();
  update public.characters c set portrait_ref = p_portrait_ref, default_portrait_changed_at = v_changed_at
    where c.id = p_character_id and c.user_id = p_user_id;
  -- The selected built-in portrait becomes immediately visible rather than remaining behind a URL.
  insert into public.character_profile_display (character_id, user_id, image_url, updated_at)
    values (p_character_id, p_user_id, null, v_changed_at)
    on conflict (character_id) do update set image_url = null, updated_at = excluded.updated_at;
  return query select p_portrait_ref, v_changed_at;
end;
$$;

revoke all on function public.set_character_default_portrait_v1(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.set_character_default_portrait_v1(uuid, uuid, text) to service_role;

commit;
