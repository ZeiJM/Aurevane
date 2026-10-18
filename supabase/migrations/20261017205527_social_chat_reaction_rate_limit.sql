begin;

-- Server-side reaction throttle; complements the social chat foundation.
-- A single row per character bounds storage and resists concurrent toggle floods.
create table app_private.chat_reaction_rate_limit (
  character_id uuid primary key references public.characters(id) on delete cascade,
  window_started_at timestamptz not null default clock_timestamp(),
  attempts integer not null default 0 check (attempts >= 0)
);
alter table app_private.chat_reaction_rate_limit enable row level security;
revoke all on app_private.chat_reaction_rate_limit from public, anon, authenticated;

create or replace function public.chat_react_v1(
  p_user_id uuid, p_character_id uuid, p_message_id bigint, p_emoji text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_channel text;
  v_now timestamptz := clock_timestamp();
  v_attempts integer;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if p_emoji not in ('❤️', '🔥', '⚔️', '😮', '😂', '👏') then
    raise exception 'CHAT_INVALID' using errcode = '22023';
  end if;
  select m.channel_key into v_channel from app_private.chat_messages m
    where m.id = p_message_id and m.kind = 'chat';
  if v_channel is null then raise exception 'CHAT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not app_private.chat_can_access_v1(p_character_id, v_channel, true) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  -- A fixed 30-second per-character window limits reaction-toggle traffic.
  -- The ON CONFLICT row lock serializes requests across different messages.
  insert into app_private.chat_reaction_rate_limit as q (character_id, window_started_at, attempts)
  values (p_character_id, v_now, 1)
  on conflict (character_id) do update set
    attempts = case when q.window_started_at <= v_now - interval '30 seconds'
      then 1 else q.attempts + 1 end,
    window_started_at = case when q.window_started_at <= v_now - interval '30 seconds'
      then v_now else q.window_started_at end
  returning attempts into v_attempts;
  if v_attempts > 12 then
    raise exception 'CHAT_REACTION_RATE_LIMITED' using errcode = '54000';
  end if;
  -- A per-character/message lock prevents double-click toggles racing.
  perform pg_advisory_xact_lock(hashtextextended('chat-reaction:' || p_message_id || ':' || p_character_id::text, 0));
  if exists (select 1 from app_private.chat_reactions r
       where r.message_id = p_message_id and r.character_id = p_character_id and r.emoji = p_emoji) then
    delete from app_private.chat_reactions
      where message_id = p_message_id and character_id = p_character_id and emoji = p_emoji;
  else
    insert into app_private.chat_reactions(message_id, character_id, emoji)
      values (p_message_id, p_character_id, p_emoji);
  end if;
  return app_private.chat_reaction_summary_v1(p_character_id, p_message_id);
end;
$$;

revoke all on function public.chat_react_v1(uuid,uuid,bigint,text) from public, anon, authenticated;
grant execute on function public.chat_react_v1(uuid,uuid,bigint,text) to service_role;

commit;
