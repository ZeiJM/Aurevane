begin;
-- Social chat followups: server-authorized reactions, ephemeral typing and private Game feed.
-- No public client has table privileges or direct RPC execution rights.

create table app_private.chat_reactions (
  message_id bigint not null references app_private.chat_messages(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  emoji text not null check (emoji in ('❤️', '🔥', '⚔️', '😮', '😂', '👏')),
  created_at timestamptz not null default now(),
  primary key (message_id, character_id, emoji)
);
create index chat_reactions_character_idx on app_private.chat_reactions (character_id);

create table app_private.chat_typing (
  channel_key text not null,
  character_id uuid not null references public.characters(id) on delete cascade,
  expires_at timestamptz not null,
  primary key (channel_key, character_id)
);
create index chat_typing_expiry_idx on app_private.chat_typing (expires_at);

alter table app_private.chat_reactions enable row level security;
alter table app_private.chat_typing enable row level security;
revoke all on app_private.chat_reactions, app_private.chat_typing from public, anon, authenticated;

-- Only the owner may view their Game feed, and browsers may never send player chat into it.
create or replace function app_private.chat_can_access_v1(p_character_id uuid, p_channel_key text, p_write boolean)
returns boolean
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_parts text[] := string_to_array(p_channel_key, ':');
  v_other uuid;
begin
  if p_channel_key = 'world' then
    return true;
  elsif p_channel_key = 'feed:' || p_character_id::text then
    return not p_write;
  elsif v_parts[1] = 'village' and array_length(v_parts, 1) = 2 and v_parts[2] ~ '^[a-z0-9][a-z0-9-]{0,59}$' then
    return true;
  elsif v_parts[1] = 'dm' and array_length(v_parts, 1) = 3
        and v_parts[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and v_parts[3] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        and v_parts[2]::uuid < v_parts[3]::uuid then
    if p_character_id::text not in (v_parts[2], v_parts[3]) then return false; end if;
    v_other := case when p_character_id::text = v_parts[2] then v_parts[3]::uuid else v_parts[2]::uuid end;
    if not p_write then return true; end if;
    if app_private.chat_is_blocked_v1(p_character_id, v_other) then return false; end if;
    return case coalesce((select s.whisper_privacy from app_private.chat_settings s where s.character_id = v_other), 'everyone')
      when 'everyone' then true
      when 'friends' then app_private.chat_are_friends_v1(p_character_id, v_other)
      else false
    end;
  elsif v_parts[1] = 'group' and array_length(v_parts, 1) = 2
        and v_parts[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return exists (
      select 1 from app_private.chat_group_members m
      where m.group_id = v_parts[2]::uuid and m.character_id = p_character_id and m.status = 'member'
    );
  elsif v_parts[1] = 'lobby' and array_length(v_parts, 1) = 2
        and v_parts[2] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    return exists (
      select 1 from app_private.pvp_lobby_members m
      where m.lobby_id = v_parts[2]::uuid and m.character_id = p_character_id
    );
  end if;
  return false;
end;
$$;

create function app_private.chat_reaction_summary_v1(p_viewer uuid, p_message_id bigint)
returns jsonb
language sql stable security definer
set search_path = pg_catalog, app_private
as $$
  select coalesce(jsonb_agg(jsonb_build_object('emoji', t.emoji, 'count', t.total,
     'mine', t.mine) order by t.emoji), '[]'::jsonb)
  from (
    select r.emoji, count(*)::integer as total, bool_or(r.character_id = p_viewer) as mine
    from app_private.chat_reactions r
    where r.message_id = p_message_id
      and not app_private.chat_is_blocked_v1(p_viewer, r.character_id)
    group by r.emoji
  ) t;
$$;

-- Used by chat_list_v1 and chat_send_v1, so both return reaction summaries.
create or replace function app_private.chat_message_json_v1(p_viewer uuid, p_id bigint)
returns jsonb
language sql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
  select jsonb_build_object(
    'id', m.id,
    'channelKey', m.channel_key,
    'kind', m.kind,
    'body', m.body,
    'createdAt', m.created_at,
    'reactions', app_private.chat_reaction_summary_v1(p_viewer, m.id),
    'senderCharacterId', m.sender_character_id,
    'senderName', c.name,
    'senderLevel', c.level,
    'senderPortraitRef', c.portrait_ref,
    'replyTo', case when r.id is null then null else jsonb_build_object(
      'id', r.id, 'senderName', rc.name, 'body', left(r.body, 120)) end
  )
  from app_private.chat_messages m
  left join public.characters c on c.id = m.sender_character_id
  left join app_private.chat_messages r on r.id = m.reply_to_id and r.channel_key = m.channel_key
  left join public.characters rc on rc.id = r.sender_character_id
  where m.id = p_id
$$;

create function public.chat_react_v1(
  p_user_id uuid, p_character_id uuid, p_message_id bigint, p_emoji text
)
returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
declare v_channel text;
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

create function public.chat_typing_v1(
  p_user_id uuid, p_character_id uuid, p_channel_key text, p_is_typing boolean
)
returns void
language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if p_is_typing is not true then
    delete from app_private.chat_typing where character_id = p_character_id and channel_key = p_channel_key;
    return;
  end if;
  if p_channel_key !~ '^(dm|group):'
    or not app_private.chat_can_access_v1(p_character_id, p_channel_key, true)
    or exists (select 1 from app_private.chat_settings s
          where s.character_id = p_character_id and s.appear_offline) then
    return;
  end if;
  -- One row per channel/character. Updates no more than every two seconds.
  insert into app_private.chat_typing(channel_key, character_id, expires_at)
    values(p_channel_key, p_character_id, clock_timestamp() + interval '5 seconds')
  on conflict(channel_key, character_id)
    do update set expires_at = excluded.expires_at
    where app_private.chat_typing.expires_at < clock_timestamp() + interval '3 seconds';
end;
$$;

create function public.chat_typers_v1(p_user_id uuid, p_character_id uuid, p_channel_key text)
returns jsonb
language plpgsql stable security definer
set search_path = pg_catalog, public, app_private
as $$
declare v_result jsonb;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if not app_private.chat_can_access_v1(p_character_id, p_channel_key, false) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('characterId', t.character_id,
         'name', c.name) order by c.name), '[]'::jsonb) into v_result
  from app_private.chat_typing t
  join public.characters c on c.id = t.character_id
  left join app_private.chat_settings s on s.character_id = t.character_id
  where t.channel_key = p_channel_key and t.character_id <> p_character_id
    and t.expires_at > clock_timestamp() and not coalesce(s.appear_offline, false)
    and not app_private.chat_is_blocked_v1(p_character_id, t.character_id);
  return v_result;
end;
$$;

-- Private feed entries expire after seven days; typing state is also swept nightly.
create or replace function app_private.chat_prune_v1()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare v_count integer;
begin
  delete from app_private.chat_messages
  where (channel_key like 'feed:%' and created_at < now() - interval '7 days')
     or (channel_key !~ '^(dm|group|feed):' and created_at < now() - interval '7 days')
     or created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  delete from app_private.chat_reads r where not exists
    (select 1 from public.characters c where c.id = r.character_id);
  delete from app_private.chat_typing where expires_at < now();
  return v_count;
end;
$$;

-- A level increase is an authoritative gameplay event, not a browser request.
-- The feed write is in the same transaction as the level change.
create function app_private.chat_level_feed_trigger_v1()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if new.level > old.level then
    perform public.chat_post_system_v1(
      'feed:' || new.id::text, 'system', format('You reached Level %s.', new.level));
  end if;
  return new;
end;
$$;
create trigger chat_level_feed_trigger
after update of level on public.characters
for each row when (new.level > old.level)
execute function app_private.chat_level_feed_trigger_v1();
revoke all on function app_private.chat_level_feed_trigger_v1() from public, anon, authenticated;


revoke all on function
  app_private.chat_reaction_summary_v1(uuid,bigint),
  public.chat_react_v1(uuid,uuid,bigint,text),
  public.chat_typing_v1(uuid,uuid,text,boolean),
  public.chat_typers_v1(uuid,uuid,text)
from public, anon, authenticated;
grant execute on function
  public.chat_react_v1(uuid,uuid,bigint,text),
  public.chat_typing_v1(uuid,uuid,text,boolean),
  public.chat_typers_v1(uuid,uuid,text)
to service_role;
commit;
