begin;

-- Social chat foundation: World/Village/Lobby/whisper/group channels, friends (max 10), named
-- private groups (max 10 members), blocks and per-character privacy settings.
-- Every table is private. Browsers never touch these; authenticated app routes call the
-- service-role-only RPCs below. Social identity is the character, not the account.

create table app_private.chat_settings (
  character_id uuid primary key references public.characters(id) on delete cascade,
  whisper_privacy text not null default 'everyone'
    check (whisper_privacy in ('everyone', 'friends', 'nobody')),
  group_invite_privacy text not null default 'friends'
    check (group_invite_privacy in ('everyone', 'friends', 'nobody')),
  default_channel text not null default 'world'
    check (default_channel in ('world', 'village', 'feed')),
  show_embeds boolean not null default true,
  appear_offline boolean not null default false,
  updated_at timestamptz not null default now()
);

create table app_private.chat_messages (
  id bigint generated always as identity primary key,
  channel_key text not null check (char_length(channel_key) between 3 and 120),
  kind text not null default 'chat' check (kind in ('chat', 'system', 'story')),
  sender_character_id uuid references public.characters(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  reply_to_id bigint references app_private.chat_messages(id) on delete set null,
  created_at timestamptz not null default clock_timestamp(),
  check ((kind = 'chat') = (sender_character_id is not null))
);
create index chat_messages_channel_idx on app_private.chat_messages (channel_key, id desc);
create index chat_messages_sender_idx on app_private.chat_messages (sender_character_id, created_at desc);
create index chat_messages_created_idx on app_private.chat_messages (created_at);

create table app_private.chat_reads (
  character_id uuid not null references public.characters(id) on delete cascade,
  channel_key text not null,
  last_read_id bigint not null default 0,
  primary key (character_id, channel_key)
);

create table app_private.chat_friendships (
  character_low uuid not null references public.characters(id) on delete cascade,
  character_high uuid not null references public.characters(id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  requested_by uuid not null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  primary key (character_low, character_high),
  check (character_low < character_high),
  check (requested_by in (character_low, character_high))
);
create index chat_friendships_high_idx on app_private.chat_friendships (character_high);

create table app_private.chat_blocks (
  blocker_character_id uuid not null references public.characters(id) on delete cascade,
  blocked_character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_character_id, blocked_character_id),
  check (blocker_character_id <> blocked_character_id)
);
create index chat_blocks_blocked_idx on app_private.chat_blocks (blocked_character_id);

create table app_private.chat_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name = btrim(name) and char_length(name) between 1 and 24),
  owner_character_id uuid not null references public.characters(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table app_private.chat_group_members (
  group_id uuid not null references app_private.chat_groups(id) on delete cascade,
  character_id uuid not null references public.characters(id) on delete cascade,
  status text not null check (status in ('invited', 'member')),
  invited_by uuid references public.characters(id) on delete set null,
  joined_at timestamptz,
  created_at timestamptz not null default now(),
  primary key (group_id, character_id)
);
create index chat_group_members_character_idx on app_private.chat_group_members (character_id, status);

alter table app_private.chat_settings enable row level security;
alter table app_private.chat_messages enable row level security;
alter table app_private.chat_reads enable row level security;
alter table app_private.chat_friendships enable row level security;
alter table app_private.chat_blocks enable row level security;
alter table app_private.chat_groups enable row level security;
alter table app_private.chat_group_members enable row level security;
revoke all on table
  app_private.chat_settings, app_private.chat_messages, app_private.chat_reads,
  app_private.chat_friendships, app_private.chat_blocks, app_private.chat_groups,
  app_private.chat_group_members
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Internal helpers (not callable by any API role)
-- ---------------------------------------------------------------------------------------------

create function app_private.chat_assert_owner_v1(p_user_id uuid, p_character_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  if p_user_id is null or p_character_id is null or not exists (
    select 1 from public.characters c
    where c.id = p_character_id and c.user_id = p_user_id
      and not exists (select 1 from app_private.character_deletion_requests d where d.character_id = c.id)
  ) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
end;
$$;

create function app_private.chat_pair_v1(p_a uuid, p_b uuid)
returns table (low uuid, high uuid)
language sql
immutable
as $$ select least(p_a, p_b), greatest(p_a, p_b) $$;

create function app_private.chat_is_blocked_v1(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select exists (
    select 1 from app_private.chat_blocks b
    where (b.blocker_character_id = p_a and b.blocked_character_id = p_b)
       or (b.blocker_character_id = p_b and b.blocked_character_id = p_a)
  )
$$;

create function app_private.chat_are_friends_v1(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select exists (
    select 1 from app_private.chat_friendships f
    where f.character_low = least(p_a, p_b) and f.character_high = greatest(p_a, p_b)
      and f.status = 'accepted'
  )
$$;

-- Validates the channel key shape and whether the character may read or write it.
-- Village membership (standing in that village) is verified by the authenticated World route
-- before it calls these RPCs; the database only enforces the key shape.
create function app_private.chat_can_access_v1(p_character_id uuid, p_channel_key text, p_write boolean)
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

create function app_private.chat_message_json_v1(p_viewer uuid, p_id bigint)
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

revoke all on function
  app_private.chat_assert_owner_v1(uuid, uuid), app_private.chat_pair_v1(uuid, uuid),
  app_private.chat_is_blocked_v1(uuid, uuid), app_private.chat_are_friends_v1(uuid, uuid),
  app_private.chat_can_access_v1(uuid, text, boolean), app_private.chat_message_json_v1(uuid, bigint)
from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------------------------

create function public.chat_get_settings_v1(p_user_id uuid, p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  s app_private.chat_settings;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  insert into app_private.chat_settings (character_id) values (p_character_id)
  on conflict (character_id) do nothing;
  select * into s from app_private.chat_settings where character_id = p_character_id;
  return jsonb_build_object(
    'whisperPrivacy', s.whisper_privacy, 'groupInvitePrivacy', s.group_invite_privacy,
    'defaultChannel', s.default_channel, 'showEmbeds', s.show_embeds, 'appearOffline', s.appear_offline);
end;
$$;

create function public.chat_set_settings_v1(p_user_id uuid, p_character_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if jsonb_typeof(p_patch) is distinct from 'object' then
    raise exception 'CHAT_INVALID' using errcode = '22023';
  end if;
  insert into app_private.chat_settings (character_id) values (p_character_id)
  on conflict (character_id) do nothing;
  update app_private.chat_settings s set
    whisper_privacy = coalesce(p_patch->>'whisperPrivacy', s.whisper_privacy),
    group_invite_privacy = coalesce(p_patch->>'groupInvitePrivacy', s.group_invite_privacy),
    default_channel = coalesce(p_patch->>'defaultChannel', s.default_channel),
    show_embeds = coalesce((p_patch->>'showEmbeds')::boolean, s.show_embeds),
    appear_offline = coalesce((p_patch->>'appearOffline')::boolean, s.appear_offline),
    updated_at = now()
  where s.character_id = p_character_id;
  return public.chat_get_settings_v1(p_user_id, p_character_id);
exception when check_violation or invalid_text_representation then
  raise exception 'CHAT_INVALID' using errcode = '22023';
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Messages
-- ---------------------------------------------------------------------------------------------

create function public.chat_send_v1(
  p_user_id uuid, p_character_id uuid, p_channel_key text, p_body text, p_reply_to_id bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_body text;
  v_id bigint;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  -- Strip control characters, collapse blank runs, trim.
  v_body := btrim(regexp_replace(coalesce(p_body, ''), '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'));
  v_body := regexp_replace(v_body, '\n{3,}', E'\n\n', 'g');
  if char_length(v_body) < 1 or char_length(v_body) > 500 then
    raise exception 'CHAT_INVALID' using errcode = '22023';
  end if;
  if not app_private.chat_can_access_v1(p_character_id, p_channel_key, true) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  -- Serialize per sender so the rate checks cannot be raced by parallel requests.
  perform pg_advisory_xact_lock(hashtextextended('chat-send:' || p_character_id::text, 0));
  if (select count(*) from app_private.chat_messages
      where sender_character_id = p_character_id and created_at > clock_timestamp() - interval '10 seconds') >= 6 then
    raise exception 'CHAT_RATE_LIMITED' using errcode = '54000';
  end if;
  if exists (select 1 from app_private.chat_messages
      where sender_character_id = p_character_id and channel_key = p_channel_key and body = v_body
        and created_at > clock_timestamp() - interval '20 seconds') then
    raise exception 'CHAT_DUPLICATE' using errcode = '54000';
  end if;
  insert into app_private.chat_messages (channel_key, kind, sender_character_id, body, reply_to_id)
  values (
    p_channel_key, 'chat', p_character_id, v_body,
    (select m.id from app_private.chat_messages m where m.id = p_reply_to_id and m.channel_key = p_channel_key)
  )
  returning id into v_id;
  -- Sending implies having read everything up to this message.
  insert into app_private.chat_reads (character_id, channel_key, last_read_id)
  values (p_character_id, p_channel_key, v_id)
  on conflict (character_id, channel_key) do update set last_read_id = greatest(chat_reads.last_read_id, excluded.last_read_id);
  return app_private.chat_message_json_v1(p_character_id, v_id);
end;
$$;

create function public.chat_list_v1(
  p_user_id uuid, p_character_id uuid, p_channel_key text, p_after_id bigint default 0, p_limit integer default 60
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_limit integer := least(greatest(coalesce(p_limit, 60), 1), 100);
  v_after bigint := greatest(coalesce(p_after_id, 0), 0);
  v_result jsonb;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if not app_private.chat_can_access_v1(p_character_id, p_channel_key, false) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  select coalesce(jsonb_agg(app_private.chat_message_json_v1(p_character_id, t.id) order by t.id), '[]'::jsonb)
  into v_result
  from (
    select m.id from app_private.chat_messages m
    where m.channel_key = p_channel_key
      and m.id > v_after
      and not exists (
        select 1 from app_private.chat_blocks b
        where b.blocker_character_id = p_character_id and b.blocked_character_id = m.sender_character_id)
    order by case when v_after = 0 then m.id end desc, m.id asc
    limit v_limit
  ) t;
  return v_result;
end;
$$;

create function public.chat_mark_read_v1(p_user_id uuid, p_character_id uuid, p_channel_key text, p_last_id bigint)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if not app_private.chat_can_access_v1(p_character_id, p_channel_key, false) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  insert into app_private.chat_reads (character_id, channel_key, last_read_id)
  values (p_character_id, p_channel_key, greatest(coalesce(p_last_id, 0), 0))
  on conflict (character_id, channel_key) do update set last_read_id = greatest(chat_reads.last_read_id, excluded.last_read_id);
end;
$$;

-- Game feed lines (red system / purple story) are posted by trusted server code only.
create function public.chat_post_system_v1(p_channel_key text, p_kind text, p_body text)
returns bigint
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare v_id bigint;
begin
  if p_kind not in ('system', 'story') or char_length(btrim(coalesce(p_body, ''))) not between 1 and 500
     or p_channel_key is null or char_length(p_channel_key) not between 3 and 120 then
    raise exception 'CHAT_INVALID' using errcode = '22023';
  end if;
  insert into app_private.chat_messages (channel_key, kind, body) values (p_channel_key, p_kind, btrim(p_body))
  returning id into v_id;
  return v_id;
end;
$$;

-- People you can @mention: friends first, then recent speakers in the channel.
create function public.chat_mention_candidates_v1(
  p_user_id uuid, p_character_id uuid, p_channel_key text, p_prefix text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_prefix text := lower(btrim(coalesce(p_prefix, '')));
  v_result jsonb;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if not app_private.chat_can_access_v1(p_character_id, p_channel_key, false) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  if v_prefix !~ '^[a-z0-9 ''-]{0,40}$' then v_prefix := ''; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', t.id, 'name', t.name, 'level', t.level, 'friend', t.friend,
      'online', t.online) order by t.friend desc, t.last_at desc nulls last, t.name), '[]'::jsonb)
  into v_result
  from (
    select c.id, c.name, c.level,
      app_private.chat_are_friends_v1(p_character_id, c.id) as friend,
      (p.last_seen_at >= now() - interval '10 minutes' and not coalesce(s.appear_offline, false)) as online,
      (select max(m.created_at) from app_private.chat_messages m
        where m.channel_key = p_channel_key and m.sender_character_id = c.id
          and m.created_at > now() - interval '1 day') as last_at
    from public.characters c
    left join public.character_presence p on p.character_id = c.id
    left join app_private.chat_settings s on s.character_id = c.id
    where c.id <> p_character_id
      and c.name_key like v_prefix || '%'
      and not app_private.chat_is_blocked_v1(p_character_id, c.id)
      and (
        app_private.chat_are_friends_v1(p_character_id, c.id)
        or exists (select 1 from app_private.chat_messages m
          where m.channel_key = p_channel_key and m.sender_character_id = c.id
            and m.created_at > now() - interval '1 day')
      )
    order by 4 desc, 6 desc nulls last, c.name
    limit 8
  ) t;
  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Friends (max 10 accepted per character), requests and blocks
-- ---------------------------------------------------------------------------------------------

create function app_private.chat_lock_pair_v1(p_a uuid, p_b uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  -- Fixed order prevents deadlocks when both players act at once.
  perform pg_advisory_xact_lock(hashtextextended('chat-friend:' || least(p_a, p_b)::text, 0));
  perform pg_advisory_xact_lock(hashtextextended('chat-friend:' || greatest(p_a, p_b)::text, 0));
end;
$$;

create function app_private.chat_friend_count_v1(p_character_id uuid)
returns integer
language sql
stable
security definer
set search_path = pg_catalog, app_private
as $$
  select count(*)::integer from app_private.chat_friendships f
  where f.status = 'accepted' and p_character_id in (f.character_low, f.character_high)
$$;

create function public.chat_friends_v1(p_user_id uuid, p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_friends jsonb; v_incoming jsonb; v_outgoing jsonb; v_blocked jsonb;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  with rel as (
    select case when f.character_low = p_character_id then f.character_high else f.character_low end as other_id,
      f.status, f.requested_by, f.accepted_at
    from app_private.chat_friendships f where p_character_id in (f.character_low, f.character_high)
  ), people as (
    select rel.*, c.name, c.level, c.portrait_ref,
      (p.last_seen_at >= now() - interval '10 minutes' and not coalesce(s.appear_offline, false)) as online
    from rel
    join public.characters c on c.id = rel.other_id
    left join public.character_presence p on p.character_id = c.id
    left join app_private.chat_settings s on s.character_id = c.id
  )
  select
    coalesce(jsonb_agg(jsonb_build_object('id', other_id, 'name', name, 'level', level, 'portraitRef', portrait_ref, 'online', coalesce(online, false))
      order by coalesce(online, false) desc, name) filter (where status = 'accepted'), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('id', other_id, 'name', name, 'level', level, 'portraitRef', portrait_ref)
      order by name) filter (where status = 'pending' and requested_by <> p_character_id), '[]'::jsonb),
    coalesce(jsonb_agg(jsonb_build_object('id', other_id, 'name', name, 'level', level, 'portraitRef', portrait_ref)
      order by name) filter (where status = 'pending' and requested_by = p_character_id), '[]'::jsonb)
  into v_friends, v_incoming, v_outgoing
  from people;
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name) order by c.name), '[]'::jsonb)
  into v_blocked
  from app_private.chat_blocks b join public.characters c on c.id = b.blocked_character_id
  where b.blocker_character_id = p_character_id;
  return jsonb_build_object('friends', v_friends, 'incoming', v_incoming, 'outgoing', v_outgoing,
    'blocked', v_blocked, 'slotsUsed', jsonb_array_length(v_friends), 'slotsMax', 10);
end;
$$;

create function public.chat_friend_request_v1(p_user_id uuid, p_character_id uuid, p_target_name text)
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
  where c.name_key = lower(btrim(coalesce(p_target_name, '')))
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

create function public.chat_friend_respond_v1(p_user_id uuid, p_character_id uuid, p_other_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_low uuid; v_high uuid;
  v_row app_private.chat_friendships;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  select low, high into v_low, v_high from app_private.chat_pair_v1(p_character_id, p_other_id);
  perform app_private.chat_lock_pair_v1(p_character_id, p_other_id);
  select * into v_row from app_private.chat_friendships
  where character_low = v_low and character_high = v_high and status = 'pending' and requested_by = p_other_id;
  if not found then raise exception 'CHAT_NOT_FOUND' using errcode = 'P0002'; end if;
  if not p_accept then
    delete from app_private.chat_friendships where character_low = v_low and character_high = v_high;
    return public.chat_friends_v1(p_user_id, p_character_id);
  end if;
  if app_private.chat_friend_count_v1(p_character_id) >= 10 then
    raise exception 'CHAT_FRIEND_LIMIT' using errcode = '54000';
  end if;
  if app_private.chat_friend_count_v1(p_other_id) >= 10 then
    raise exception 'CHAT_OTHER_FRIEND_LIMIT' using errcode = '54000';
  end if;
  update app_private.chat_friendships set status = 'accepted', accepted_at = now()
  where character_low = v_low and character_high = v_high;
  return public.chat_friends_v1(p_user_id, p_character_id);
end;
$$;

-- Also cancels our own outgoing request.
create function public.chat_friend_remove_v1(p_user_id uuid, p_character_id uuid, p_other_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  perform app_private.chat_lock_pair_v1(p_character_id, p_other_id);
  delete from app_private.chat_friendships
  where character_low = least(p_character_id, p_other_id) and character_high = greatest(p_character_id, p_other_id);
  return public.chat_friends_v1(p_user_id, p_character_id);
end;
$$;

create function public.chat_block_v1(p_user_id uuid, p_character_id uuid, p_other_id uuid, p_block boolean)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if p_other_id is null or p_other_id = p_character_id
     or not exists (select 1 from public.characters c where c.id = p_other_id) then
    raise exception 'CHAT_INVALID' using errcode = '22023';
  end if;
  perform app_private.chat_lock_pair_v1(p_character_id, p_other_id);
  if p_block then
    insert into app_private.chat_blocks (blocker_character_id, blocked_character_id)
    values (p_character_id, p_other_id) on conflict do nothing;
    delete from app_private.chat_friendships
    where character_low = least(p_character_id, p_other_id) and character_high = greatest(p_character_id, p_other_id);
    -- Remove the blocked player from groups the blocker owns, and cancel pending invites between them.
    delete from app_private.chat_group_members m
    using app_private.chat_groups g
    where g.id = m.group_id and g.owner_character_id = p_character_id and m.character_id = p_other_id;
  else
    delete from app_private.chat_blocks
    where blocker_character_id = p_character_id and blocked_character_id = p_other_id;
  end if;
  return public.chat_friends_v1(p_user_id, p_character_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Named private groups (max 10 people including pending invites)
-- ---------------------------------------------------------------------------------------------

create function app_private.chat_group_lock_v1(p_group_id uuid)
returns void
language sql
security definer
set search_path = pg_catalog
as $$ select pg_advisory_xact_lock(hashtextextended('chat-group:' || p_group_id::text, 0)) $$;

create function app_private.chat_group_invite_one_v1(p_group_id uuid, p_inviter uuid, p_target uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_privacy text;
begin
  if p_target = p_inviter or not exists (select 1 from public.characters c where c.id = p_target) then
    raise exception 'CHAT_INVALID' using errcode = '22023';
  end if;
  if app_private.chat_is_blocked_v1(p_inviter, p_target) then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  v_privacy := coalesce(
    (select s.group_invite_privacy from app_private.chat_settings s where s.character_id = p_target), 'friends');
  if v_privacy = 'nobody' or (v_privacy = 'friends' and not app_private.chat_are_friends_v1(p_inviter, p_target)) then
    raise exception 'CHAT_INVITE_NOT_ALLOWED' using errcode = '42501';
  end if;
  if (select count(*) from app_private.chat_group_members where group_id = p_group_id) >= 10 then
    raise exception 'CHAT_GROUP_FULL' using errcode = '54000';
  end if;
  insert into app_private.chat_group_members (group_id, character_id, status, invited_by)
  values (p_group_id, p_target, 'invited', p_inviter)
  on conflict do nothing;
end;
$$;

create function public.chat_group_create_v1(p_user_id uuid, p_character_id uuid, p_name text, p_invite_ids uuid[])
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[\x00-\x1F\x7F]', '', 'g'));
  v_group uuid;
  v_target uuid;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if char_length(v_name) not between 1 and 24 then raise exception 'CHAT_INVALID' using errcode = '22023'; end if;
  if cardinality(coalesce(p_invite_ids, '{}')) > 9 then raise exception 'CHAT_GROUP_FULL' using errcode = '54000'; end if;
  perform pg_advisory_xact_lock(hashtextextended('chat-groups-of:' || p_character_id::text, 0));
  if (select count(*) from app_private.chat_group_members m
      where m.character_id = p_character_id and m.status = 'member') >= 10 then
    raise exception 'CHAT_GROUP_LIMIT' using errcode = '54000';
  end if;
  insert into app_private.chat_groups (name, owner_character_id) values (v_name, p_character_id) returning id into v_group;
  insert into app_private.chat_group_members (group_id, character_id, status, joined_at)
  values (v_group, p_character_id, 'member', now());
  for v_target in select distinct unnest(coalesce(p_invite_ids, '{}')) loop
    perform app_private.chat_group_invite_one_v1(v_group, p_character_id, v_target);
  end loop;
  return jsonb_build_object('id', v_group, 'name', v_name, 'channelKey', 'group:' || v_group);
end;
$$;

create function public.chat_group_invite_v1(p_user_id uuid, p_character_id uuid, p_group_id uuid, p_target_id uuid)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  perform app_private.chat_group_lock_v1(p_group_id);
  if not exists (select 1 from app_private.chat_group_members m
      where m.group_id = p_group_id and m.character_id = p_character_id and m.status = 'member') then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  perform app_private.chat_group_invite_one_v1(p_group_id, p_character_id, p_target_id);
end;
$$;

create function public.chat_group_respond_v1(p_user_id uuid, p_character_id uuid, p_group_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  perform app_private.chat_group_lock_v1(p_group_id);
  if not exists (select 1 from app_private.chat_group_members m
      where m.group_id = p_group_id and m.character_id = p_character_id and m.status = 'invited') then
    raise exception 'CHAT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not p_accept then
    delete from app_private.chat_group_members where group_id = p_group_id and character_id = p_character_id;
    return;
  end if;
  perform pg_advisory_xact_lock(hashtextextended('chat-groups-of:' || p_character_id::text, 0));
  if (select count(*) from app_private.chat_group_members m
      where m.character_id = p_character_id and m.status = 'member') >= 10 then
    raise exception 'CHAT_GROUP_LIMIT' using errcode = '54000';
  end if;
  update app_private.chat_group_members set status = 'member', joined_at = now()
  where group_id = p_group_id and character_id = p_character_id;
end;
$$;

-- Leaving, or (owner only) removing someone else. The last member out deletes the group.
create function public.chat_group_leave_v1(p_user_id uuid, p_character_id uuid, p_group_id uuid, p_target_id uuid default null)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_target uuid := coalesce(p_target_id, p_character_id);
  v_owner uuid;
  v_next uuid;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  perform app_private.chat_group_lock_v1(p_group_id);
  select owner_character_id into v_owner from app_private.chat_groups where id = p_group_id;
  if v_owner is null then raise exception 'CHAT_NOT_FOUND' using errcode = 'P0002'; end if;
  if v_target <> p_character_id and v_owner <> p_character_id then
    raise exception 'CHAT_FORBIDDEN' using errcode = '42501';
  end if;
  delete from app_private.chat_group_members where group_id = p_group_id and character_id = v_target;
  if v_target = v_owner then
    select m.character_id into v_next from app_private.chat_group_members m
    where m.group_id = p_group_id and m.status = 'member' order by m.joined_at, m.character_id limit 1;
    if v_next is null then
      delete from app_private.chat_groups where id = p_group_id;
      delete from app_private.chat_messages where channel_key = 'group:' || p_group_id;
    else
      update app_private.chat_groups set owner_character_id = v_next where id = p_group_id;
    end if;
  end if;
end;
$$;

create function public.chat_group_rename_v1(p_user_id uuid, p_character_id uuid, p_group_id uuid, p_name text)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare v_name text := btrim(regexp_replace(coalesce(p_name, ''), '[\x00-\x1F\x7F]', '', 'g'));
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  if char_length(v_name) not between 1 and 24 then raise exception 'CHAT_INVALID' using errcode = '22023'; end if;
  update app_private.chat_groups set name = v_name where id = p_group_id and owner_character_id = p_character_id;
  if not found then raise exception 'CHAT_FORBIDDEN' using errcode = '42501'; end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Inbox: whispers, groups, invites, unread counts
-- ---------------------------------------------------------------------------------------------

create function public.chat_inbox_v1(p_user_id uuid, p_character_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  v_dms jsonb; v_groups jsonb; v_invites jsonb;
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);

  select coalesce(jsonb_agg(row_to_json(d)::jsonb order by d.last_id desc), '[]'::jsonb) into v_dms
  from (
    select o.other_id as "characterId", c.name, c.level,
      'dm:' || least(p_character_id, o.other_id) || ':' || greatest(p_character_id, o.other_id) as "channelKey",
      (p.last_seen_at >= now() - interval '10 minutes' and not coalesce(s.appear_offline, false)) as online,
      lm.id as last_id, left(lm.body, 80) as "lastBody", lm.created_at as "lastAt",
      (select count(*) from app_private.chat_messages u
        where u.channel_key = 'dm:' || least(p_character_id, o.other_id) || ':' || greatest(p_character_id, o.other_id)
          and u.sender_character_id = o.other_id
          and u.id > coalesce((select r.last_read_id from app_private.chat_reads r
            where r.character_id = p_character_id and r.channel_key =
              'dm:' || least(p_character_id, o.other_id) || ':' || greatest(p_character_id, o.other_id)), 0))::integer as unread
    from (
      select distinct case when m.sender_character_id = p_character_id then split_part(m.channel_key, ':', 3)::uuid
                           else m.sender_character_id end as other_id
      from app_private.chat_messages m
      where m.channel_key like 'dm:%' and p_character_id::text in (split_part(m.channel_key, ':', 2), split_part(m.channel_key, ':', 3))
        and m.created_at > now() - interval '30 days'
    ) o
    join public.characters c on c.id = o.other_id
    left join public.character_presence p on p.character_id = c.id
    left join app_private.chat_settings s on s.character_id = c.id
    cross join lateral (
      select m.id, m.body, m.created_at from app_private.chat_messages m
      where m.channel_key = 'dm:' || least(p_character_id, o.other_id) || ':' || greatest(p_character_id, o.other_id)
      order by m.id desc limit 1) lm
    where not exists (select 1 from app_private.chat_blocks b
      where b.blocker_character_id = p_character_id and b.blocked_character_id = o.other_id)
    limit 30
  ) d;

  select coalesce(jsonb_agg(row_to_json(g)::jsonb order by g."lastId" desc nulls last, g.name), '[]'::jsonb) into v_groups
  from (
    select grp.id, grp.name, 'group:' || grp.id as "channelKey", grp.owner_character_id = p_character_id as "isOwner",
      (select count(*) from app_private.chat_group_members x where x.group_id = grp.id and x.status = 'member')::integer as members,
      (select max(m.id) from app_private.chat_messages m where m.channel_key = 'group:' || grp.id) as "lastId",
      (select count(*) from app_private.chat_messages u
        where u.channel_key = 'group:' || grp.id and u.sender_character_id is distinct from p_character_id
          and u.id > coalesce((select r.last_read_id from app_private.chat_reads r
            where r.character_id = p_character_id and r.channel_key = 'group:' || grp.id), 0))::integer as unread
    from app_private.chat_group_members me
    join app_private.chat_groups grp on grp.id = me.group_id
    where me.character_id = p_character_id and me.status = 'member'
  ) g;

  select coalesce(jsonb_agg(jsonb_build_object('groupId', grp.id, 'name', grp.name, 'invitedBy', c.name,
    'members', (select count(*) from app_private.chat_group_members x where x.group_id = grp.id and x.status = 'member'))
    order by me.created_at), '[]'::jsonb) into v_invites
  from app_private.chat_group_members me
  join app_private.chat_groups grp on grp.id = me.group_id
  left join public.characters c on c.id = me.invited_by
  where me.character_id = p_character_id and me.status = 'invited';

  return jsonb_build_object('whispers', v_dms, 'groups', v_groups, 'groupInvites', v_invites,
    'unreadTotal', coalesce((select sum((x->>'unread')::integer) from jsonb_array_elements(v_dms || v_groups) x), 0));
end;
$$;

-- Where a character stands, so the authenticated route can decide Village membership.
create function public.chat_world_sector_v1(p_user_id uuid, p_character_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = pg_catalog, public, app_private
as $$
begin
  perform app_private.chat_assert_owner_v1(p_user_id, p_character_id);
  return (select w.sector_id from app_private.character_world_state w where w.character_id = p_character_id);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- Retention: world/village/lobby 7 days, whispers/groups 30 days
-- ---------------------------------------------------------------------------------------------

create function app_private.chat_prune_v1()
returns integer
language plpgsql
security definer
set search_path = pg_catalog, app_private
as $$
declare v_count integer;
begin
  delete from app_private.chat_messages
  where (channel_key !~ '^(dm|group):' and created_at < now() - interval '7 days')
     or created_at < now() - interval '30 days';
  get diagnostics v_count = row_count;
  delete from app_private.chat_reads r where not exists
    (select 1 from public.characters c where c.id = r.character_id);
  return v_count;
end;
$$;
revoke all on function app_private.chat_lock_pair_v1(uuid, uuid), app_private.chat_friend_count_v1(uuid),
  app_private.chat_group_lock_v1(uuid), app_private.chat_group_invite_one_v1(uuid, uuid, uuid),
  app_private.chat_prune_v1() from public, anon, authenticated;

create extension if not exists pg_cron;
select cron.schedule('chat-prune-v1', '17 4 * * *', 'select app_private.chat_prune_v1()');

-- ---------------------------------------------------------------------------------------------
-- Grants: service role only
-- ---------------------------------------------------------------------------------------------

revoke all on function
  public.chat_get_settings_v1(uuid, uuid), public.chat_set_settings_v1(uuid, uuid, jsonb),
  public.chat_send_v1(uuid, uuid, text, text, bigint), public.chat_list_v1(uuid, uuid, text, bigint, integer),
  public.chat_mark_read_v1(uuid, uuid, text, bigint), public.chat_post_system_v1(text, text, text),
  public.chat_mention_candidates_v1(uuid, uuid, text, text), public.chat_friends_v1(uuid, uuid),
  public.chat_friend_request_v1(uuid, uuid, text), public.chat_friend_respond_v1(uuid, uuid, uuid, boolean),
  public.chat_friend_remove_v1(uuid, uuid, uuid), public.chat_block_v1(uuid, uuid, uuid, boolean),
  public.chat_group_create_v1(uuid, uuid, text, uuid[]), public.chat_group_invite_v1(uuid, uuid, uuid, uuid),
  public.chat_group_respond_v1(uuid, uuid, uuid, boolean), public.chat_group_leave_v1(uuid, uuid, uuid, uuid),
  public.chat_group_rename_v1(uuid, uuid, uuid, text), public.chat_inbox_v1(uuid, uuid),
  public.chat_world_sector_v1(uuid, uuid)
from public, anon, authenticated;

grant execute on function
  public.chat_get_settings_v1(uuid, uuid), public.chat_set_settings_v1(uuid, uuid, jsonb),
  public.chat_send_v1(uuid, uuid, text, text, bigint), public.chat_list_v1(uuid, uuid, text, bigint, integer),
  public.chat_mark_read_v1(uuid, uuid, text, bigint), public.chat_post_system_v1(text, text, text),
  public.chat_mention_candidates_v1(uuid, uuid, text, text), public.chat_friends_v1(uuid, uuid),
  public.chat_friend_request_v1(uuid, uuid, text), public.chat_friend_respond_v1(uuid, uuid, uuid, boolean),
  public.chat_friend_remove_v1(uuid, uuid, uuid), public.chat_block_v1(uuid, uuid, uuid, boolean),
  public.chat_group_create_v1(uuid, uuid, text, uuid[]), public.chat_group_invite_v1(uuid, uuid, uuid, uuid),
  public.chat_group_respond_v1(uuid, uuid, uuid, boolean), public.chat_group_leave_v1(uuid, uuid, uuid, uuid),
  public.chat_group_rename_v1(uuid, uuid, uuid, text), public.chat_inbox_v1(uuid, uuid),
  public.chat_world_sector_v1(uuid, uuid)
to service_role;

commit;
