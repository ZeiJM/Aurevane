begin;

-- Allow an actively joined spectator to participate in battle chat without granting
-- participant battle authority. The sender identity remains a character owned by the
-- authenticated account, matching spectator presence naming semantics.
create or replace function public.send_pvp_battle_chat_v1(
  p_user_id uuid,
  p_battle_session_id uuid,
  p_body text
)
returns table (
  message_id bigint,
  sender_character_id uuid,
  sender_character_name text,
  body text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_character_id uuid;
  v_body text;
  v_message_id bigint;
begin
  v_body := btrim(coalesce(p_body, ''));
  if char_length(v_body) < 1 or char_length(v_body) > 280 then
    raise exception 'PVP_CHAT_INVALID' using errcode = '22023';
  end if;

  -- Active combatants keep the existing participant-authorized sender path.
  select bp.character_id
    into v_character_id
  from app_private.battle_participants bp
  join app_private.battle_sessions b on b.id = bp.battle_session_id
  where bp.battle_session_id = p_battle_session_id
    and bp.user_id = p_user_id
    and bp.character_id is not null
    and b.lifecycle = 'active'
  limit 1;

  -- Spectators may write only while actively spectating this exact active battle.
  -- Use the same most-recent character convention already used for spectator presence.
  if v_character_id is null then
    select c.id
      into v_character_id
    from app_private.pvp_active_spectating s
    join app_private.battle_sessions b on b.id = s.battle_session_id
    join lateral (
      select owned.id
      from public.characters owned
      where owned.user_id = p_user_id
      order by owned.last_active_at desc nulls last, owned.created_at desc
      limit 1
    ) c on true
    where s.user_id = p_user_id
      and s.battle_session_id = p_battle_session_id
      and b.lifecycle = 'active'
    limit 1;
  end if;

  if v_character_id is null then
    raise exception 'PVP_CHAT_FORBIDDEN' using errcode = '42501';
  end if;

  insert into app_private.pvp_battle_chat_messages (
    battle_session_id,
    sender_user_id,
    sender_character_id,
    body
  ) values (
    p_battle_session_id,
    p_user_id,
    v_character_id,
    v_body
  ) returning id into v_message_id;

  return query
  select m.id, m.sender_character_id, c.name, m.body, m.created_at
  from app_private.pvp_battle_chat_messages m
  join public.characters c on c.id = m.sender_character_id
  where m.id = v_message_id;
end;
$$;

revoke all on function public.send_pvp_battle_chat_v1(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.send_pvp_battle_chat_v1(uuid, uuid, text) to service_role;

commit;
