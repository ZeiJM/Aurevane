-- Resolve friend requests with the same normalized key used when character names are created.
begin;

create or replace function public.chat_friend_request_v1(p_user_id uuid, p_character_id uuid, p_target_name text)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_target uuid;
  v_low uuid; v_high uuid;
  v_existing app_private.chat_friendships;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  select c.id into v_target from public.characters c
  where c.name_key = lower(regexp_replace(normalize(btrim(coalesce(p_target_name, '')), NFKC), '[- ''’]', '', 'g'))
    and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id);
  if v_target is null then raise exception 'CHAT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_target = p_character_id then raise exception 'CHAT_INVALID' using errcode = '22023'; end if;
  select low, high into v_low, v_high from app_private.chat_pair_v1(p_character_id, v_target);
  perform app_private.chat_lock_pair_v1(p_character_id, v_target);
  if app_private.chat_is_blocked_v1(p_character_id, v_target) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_existing from app_private.chat_friendships where character_low = v_low and character_high = v_high;
  if found then
    if v_existing.status = 'accepted' then raise exception 'CHAT_ALREADY_FRIENDS' using errcode = '23505'; end if;
    if v_existing.requested_by = p_character_id then raise exception 'CHAT_REQUEST_EXISTS' using errcode = '23505'; end if;
    -- They already asked us: treat as accepting.
    return public.chat_friend_respond_v1(p_user_id, p_character_id, v_target, true);
  end if;
  if app_private.chat_friend_count_v1(p_character_id) >= 10 then
    raise exception 'CHAT_FRIEND_LIMIT' using errcode = '54000';
  end if;
  if (select count(*) from app_private.chat_friendships f
      where f.status = 'pending' and f.requested_by = p_character_id) >= 20 then
    raise exception 'CHAT_REQUEST_LIMIT' using errcode = '54000';
  end if;
  insert into app_private.chat_friendships (character_low, character_high, status, requested_by)
  values (v_low, v_high, 'pending', p_character_id);
  return public.chat_friends_v1(p_user_id, p_character_id);
end;
$$;

commit;
