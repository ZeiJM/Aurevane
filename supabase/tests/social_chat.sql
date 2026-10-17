-- Run against a disposable, fully migrated Supabase stack:
-- pnpm exec supabase test db --local supabase/tests/social_chat.sql
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pg_catalog;
select plan(69);

-- Surface and privileges -------------------------------------------------------------------
select has_function('public', 'chat_send_v1', array['uuid','uuid','text','text','bigint'], 'send exists');
select has_function('public', 'chat_friend_request_v1', array['uuid','uuid','text'], 'friend request exists');
select has_function('public', 'chat_group_create_v1', array['uuid','uuid','text','uuid[]'], 'group create exists');
select ok(has_function_privilege('service_role','public.chat_send_v1(uuid,uuid,text,text,bigint)','execute'), 'service role can send');
select ok(not has_function_privilege('authenticated','public.chat_send_v1(uuid,uuid,text,text,bigint)','execute'), 'browser cannot call send directly');
select ok(not has_function_privilege('anon','public.chat_list_v1(uuid,uuid,text,bigint,integer)','execute'), 'anon cannot list');
select ok(not has_function_privilege('authenticated','public.chat_post_system_v1(text,text,text)','execute'), 'browser cannot post system lines');
select ok(not has_table_privilege('authenticated','app_private.chat_messages','select,insert,update,delete'), 'messages have no browser grants');
select is((select count(*)::integer from pg_class where relnamespace='app_private'::regnamespace and relname in ('chat_settings','chat_messages','chat_reads','chat_friendships','chat_blocks','chat_groups','chat_group_members') and relrowsecurity), 7, 'every chat table uses RLS');

-- Fixtures: twelve characters on twelve accounts -------------------------------------------
insert into auth.users(id)
select ('82000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 12) n;
insert into public.player_profiles(user_id)
select ('82000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid from generate_series(1, 12) n on conflict do nothing;
insert into public.characters(
  id,user_id,slot_index,rules_version,name,name_key,presentation_id,pronoun_preset_id,
  portrait_ref,starter_appearance_ref,foundation_discipline_id,might,finesse,vitality,agility,intellect,resolve,
  level,xp,progression_cycle,created_at,cycle_started_at,last_active_at
)
select ('82000000-0000-4000-8000-0000000001' || lpad(actor.n::text, 2, '0'))::uuid,
  ('82000000-0000-4000-8000-0000000000' || lpad(actor.n::text, 2, '0'))::uuid,0,1,
  'Chat Tester ' || lpad(actor.n::text, 2, '0'),'chat tester ' || lpad(actor.n::text, 2, '0'),
  'presentation.chat-test','pronoun.they','portrait.chat-test','appearance.chat-test',definition.discipline_id,
  (profile.core_base_attributes->>'might')::integer+1,
  (profile.core_base_attributes->>'finesse')::integer+1,
  (profile.core_base_attributes->>'vitality')::integer+1,
  (profile.core_base_attributes->>'agility')::integer+1,
  (profile.core_base_attributes->>'intellect')::integer+1,
  (profile.core_base_attributes->>'resolve')::integer,
  1,0,1,clock_timestamp(),clock_timestamp(),clock_timestamp()
from generate_series(1, 12) actor(n)
cross join lateral (
  select distinct on (d.discipline_id) d.discipline_id,d.primary_profile_version
  from app_private.discipline_definitions d where d.enabled_for_primary
  order by d.discipline_id,d.definition_version desc limit 1
) definition
join app_private.discipline_primary_profiles profile on profile.discipline_id=definition.discipline_id and profile.profile_version=definition.primary_profile_version;

-- Readable aliases: u01..u12 accounts, c01..c12 characters.
create temporary table ids as
select n, ('82000000-0000-4000-8000-0000000000' || lpad(n::text, 2, '0'))::uuid as u,
  ('82000000-0000-4000-8000-0000000001' || lpad(n::text, 2, '0'))::uuid as c
from generate_series(1, 12) n;

-- World channel ---------------------------------------------------------------------------
select ok((public.chat_send_v1((select u from ids where n=1), (select c from ids where n=1), 'world', '  Hello, Aurevane  ')->>'body') = 'Hello, Aurevane', 'world send trims the body');
select is(jsonb_array_length(public.chat_list_v1((select u from ids where n=2), (select c from ids where n=2), 'world', 0, 60)), 1, 'another player reads the world line');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,'world','spoof')$q$, (select u from ids where n=2), (select c from ids where n=1)), '42501', 'CHAT_FORBIDDEN', 'cannot speak as a character you do not own');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,'world','')$q$, (select u from ids where n=1), (select c from ids where n=1)), '22023', 'CHAT_INVALID', 'empty message rejected');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,'world',%L)$q$, (select u from ids where n=1), (select c from ids where n=1), repeat('x', 501)), '22023', 'CHAT_INVALID', '501 characters rejected');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,'world','Hello, Aurevane')$q$, (select u from ids where n=1), (select c from ids where n=1)), '54000', 'CHAT_DUPLICATE', 'immediate repeat rejected');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,'nonsense','hi')$q$, (select u from ids where n=1), (select c from ids where n=1)), '42501', 'CHAT_FORBIDDEN', 'unknown channel keys are refused');
select ok((public.chat_send_v1((select u from ids where n=1), (select c from ids where n=1), 'village:duskhaven', 'Anyone at the chapel?', (public.chat_list_v1((select u from ids where n=1), (select c from ids where n=1), 'world', 0, 1)->0->>'id')::bigint)->>'id') is not null, 'village send works');
select is((public.chat_list_v1((select u from ids where n=1), (select c from ids where n=1), 'village:duskhaven', 0, 10)->0->'replyTo'), 'null'::jsonb, 'reply targets from another channel are dropped');

-- Rate limit: six per ten seconds ---------------------------------------------------------
do $$
declare k integer; r record;
begin
  select u, c into r from ids where ids.n = 3;
  for k in 1..6 loop
    perform public.chat_send_v1(r.u, r.c, 'world', 'burst ' || k);
  end loop;
end $$;
select throws_ok(format($q$select public.chat_send_v1(%L,%L,'world','burst 7')$q$, (select u from ids where n=3), (select c from ids where n=3)), '54000', 'CHAT_RATE_LIMITED', 'seventh message in ten seconds is limited');

-- Whispers: privacy, blocks, ordering -----------------------------------------------------
create temporary table dm as
select 'dm:' || least(a.c, b.c) || ':' || greatest(a.c, b.c) as key_14,
       'dm:' || greatest(a.c, b.c) || ':' || least(a.c, b.c) as key_14_bad
from ids a, ids b where a.n = 4 and b.n = 5;
select ok((public.chat_send_v1((select u from ids where n=4), (select c from ids where n=4), (select key_14 from dm), 'psst')->>'id') is not null, 'whisper allowed by default');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,%L,'psst2')$q$, (select u from ids where n=4), (select c from ids where n=4), (select key_14_bad from dm)), '42501', 'CHAT_FORBIDDEN', 'non-canonical whisper keys are refused');
select throws_ok(format($q$select public.chat_list_v1(%L,%L,%L,0,10)$q$, (select u from ids where n=6), (select c from ids where n=6), (select key_14 from dm)), '42501', 'CHAT_FORBIDDEN', 'strangers cannot read a whisper');
select is((public.chat_inbox_v1((select u from ids where n=5), (select c from ids where n=5))->'whispers'->0->>'unread')::integer, 1, 'recipient sees one unread whisper');
select public.chat_mark_read_v1((select u from ids where n=5), (select c from ids where n=5), (select key_14 from dm), 999999999);
select is((public.chat_inbox_v1((select u from ids where n=5), (select c from ids where n=5))->'whispers'->0->>'unread')::integer, 0, 'marking read clears unread');
select public.chat_set_settings_v1((select u from ids where n=5), (select c from ids where n=5), '{"whisperPrivacy":"friends"}');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,%L,'again')$q$, (select u from ids where n=4), (select c from ids where n=4), (select key_14 from dm)), '42501', 'CHAT_FORBIDDEN', 'friends-only whispers refuse strangers');
select public.chat_set_settings_v1((select u from ids where n=5), (select c from ids where n=5), '{"whisperPrivacy":"nobody"}');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,%L,'again')$q$, (select u from ids where n=4), (select c from ids where n=4), (select key_14 from dm)), '42501', 'CHAT_FORBIDDEN', 'nobody-whisper refuses everyone');
select throws_ok(format($q$select public.chat_set_settings_v1(%L,%L,'{"whisperPrivacy":"everybody"}')$q$, (select u from ids where n=5), (select c from ids where n=5)), '22023', 'CHAT_INVALID', 'bad settings values rejected');

-- Blocks -----------------------------------------------------------------------------------
select public.chat_block_v1((select u from ids where n=2), (select c from ids where n=2), (select c from ids where n=1), true);
select is((select count(*)::integer from jsonb_array_elements(public.chat_list_v1((select u from ids where n=2), (select c from ids where n=2), 'world', 0, 100)) m where m->>'senderCharacterId' = (select c::text from ids where n=1)), 0, 'blocked players vanish from your world feed');
select ok(jsonb_array_length(public.chat_list_v1((select u from ids where n=6), (select c from ids where n=6), 'world', 0, 60)) >= 1, 'others still see them');
select public.chat_set_settings_v1((select u from ids where n=2), (select c from ids where n=2), '{"whisperPrivacy":"everyone"}');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,%L,'hey')$q$, (select u from ids where n=1), (select c from ids where n=1), 'dm:' || (select least(a.c,b.c) from ids a, ids b where a.n=1 and b.n=2) || ':' || (select greatest(a.c,b.c) from ids a, ids b where a.n=1 and b.n=2)), '42501', 'CHAT_FORBIDDEN', 'a blocked player cannot whisper the blocker');
select throws_ok(format($q$select public.chat_friend_request_v1(%L,%L,'Chat Tester 02')$q$, (select u from ids where n=1), (select c from ids where n=1)), '42501', 'CHAT_FORBIDDEN', 'cannot befriend someone who blocked you');
select public.chat_block_v1((select u from ids where n=2), (select c from ids where n=2), (select c from ids where n=1), false);
select is((public.chat_friends_v1((select u from ids where n=2), (select c from ids where n=2))->'blocked'), '[]'::jsonb, 'unblock clears the list');

-- Friends: maximum ten -------------------------------------------------------------------
do $$
declare i integer; r1 record; ri record;
begin
  select u, c into r1 from ids where ids.n = 7;
  for i in 1..10 loop
    select u, c into ri from ids where ids.n = case when i < 7 then i else i + 1 end;
    -- characters 1..6 and 8..11 befriend character 7
    perform public.chat_friend_request_v1(ri.u, ri.c, 'Chat Tester 07');
    perform public.chat_friend_respond_v1(r1.u, r1.c, ri.c, true);
  end loop;
end $$;
select is((public.chat_friends_v1((select u from ids where n=7), (select c from ids where n=7))->>'slotsUsed')::integer, 10, 'ten friends fill the list');
select throws_ok(format($q$select public.chat_friend_request_v1(%L,%L,'Chat Tester 12')$q$, (select u from ids where n=7), (select c from ids where n=7)), '54000', 'CHAT_FRIEND_LIMIT', 'an eleventh friend request is refused');
select public.chat_friend_request_v1((select u from ids where n=12), (select c from ids where n=12), 'Chat Tester 07');
select throws_ok(format($q$select public.chat_friend_respond_v1(%L,%L,%L,true)$q$, (select u from ids where n=7), (select c from ids where n=7), (select c from ids where n=12)), '54000', 'CHAT_FRIEND_LIMIT', 'accepting past ten is refused');
select throws_ok(format($q$select public.chat_friend_request_v1(%L,%L,'Chat Tester 08')$q$, (select u from ids where n=7), (select c from ids where n=7)), '23505', 'CHAT_ALREADY_FRIENDS', 'duplicate friendship refused');
select throws_ok(format($q$select public.chat_friend_request_v1(%L,%L,'nobody by this name')$q$, (select u from ids where n=7), (select c from ids where n=7)), 'P0002', 'CHAT_NOT_FOUND', 'unknown names are not found');
select public.chat_friend_remove_v1((select u from ids where n=7), (select c from ids where n=7), (select c from ids where n=1));
select is((public.chat_friends_v1((select u from ids where n=7), (select c from ids where n=7))->>'slotsUsed')::integer, 9, 'removing a friend frees a slot');
select is((public.chat_friends_v1((select u from ids where n=7), (select c from ids where n=7))->'incoming'->0->>'name'), 'Chat Tester 12', 'pending request is listed');
select ok(public.chat_friend_respond_v1((select u from ids where n=7), (select c from ids where n=7), (select c from ids where n=12), true) is not null, 'accepting after a slot frees works');
select ok(jsonb_array_length(public.chat_mention_candidates_v1((select u from ids where n=7), (select c from ids where n=7), 'world', 'chat tester 0')) >= 1, 'mention candidates include friends');

-- Groups: names and ten-person cap --------------------------------------------------------
create temporary table grp as
select public.chat_group_create_v1((select u from ids where n=7), (select c from ids where n=7), '  Moonwake Pact  ',
  array(select c from ids where n in (2, 3))) as g;
select is((select g->>'name' from grp), 'Moonwake Pact', 'group names are trimmed');
select throws_ok(format($q$select public.chat_group_create_v1(%L,%L,%L,'{}')$q$, (select u from ids where n=7), (select c from ids where n=7), repeat('n', 25)), '22023', 'CHAT_INVALID', 'group names are limited to 24 characters');
select throws_ok(format($q$select public.chat_send_v1(%L,%L,%L,'hi group')$q$, (select u from ids where n=2), (select c from ids where n=2), (select g->>'channelKey' from grp)), '42501', 'CHAT_FORBIDDEN', 'invited players cannot speak until they accept');
select public.chat_group_respond_v1((select u from ids where n=2), (select c from ids where n=2), (select (g->>'id')::uuid from grp), true);
select ok((public.chat_send_v1((select u from ids where n=2), (select c from ids where n=2), (select g->>'channelKey' from grp), 'hi group')->>'id') is not null, 'members can speak');
select throws_ok(format($q$select public.chat_list_v1(%L,%L,%L,0,10)$q$, (select u from ids where n=9), (select c from ids where n=9), (select g->>'channelKey' from grp)), '42501', 'CHAT_FORBIDDEN', 'outsiders cannot read a group');
select public.chat_set_settings_v1((select u from ids where n=10), (select c from ids where n=10), '{"groupInvitePrivacy":"nobody"}');
select throws_ok(format($q$select public.chat_group_invite_v1(%L,%L,%L,%L)$q$, (select u from ids where n=7), (select c from ids where n=7), (select (g->>'id')::uuid from grp), (select c from ids where n=10)), '42501', 'CHAT_INVITE_NOT_ALLOWED', 'nobody-invite refuses everyone');
select public.chat_set_settings_v1((select u from ids where n=9), (select c from ids where n=9), '{"groupInvitePrivacy":"everyone"}');
select public.chat_set_settings_v1((select u from ids where n=11), (select c from ids where n=11), '{"groupInvitePrivacy":"everyone"}');
select public.chat_set_settings_v1((select u from ids where n=12), (select c from ids where n=12), '{"groupInvitePrivacy":"everyone"}');
select public.chat_set_settings_v1((select u from ids where n=1), (select c from ids where n=1), '{"groupInvitePrivacy":"everyone"}');
select public.chat_set_settings_v1((select u from ids where n=4), (select c from ids where n=4), '{"groupInvitePrivacy":"everyone"}');
select public.chat_set_settings_v1((select u from ids where n=5), (select c from ids where n=5), '{"groupInvitePrivacy":"everyone"}');
select public.chat_set_settings_v1((select u from ids where n=6), (select c from ids where n=6), '{"groupInvitePrivacy":"everyone"}');
select public.chat_set_settings_v1((select u from ids where n=8), (select c from ids where n=8), '{"groupInvitePrivacy":"everyone"}');
-- Group has 7 (owner), 2, 3 so far; add 4,5,6,8,9,11,12 (seven more) -> ten total.
do $$
declare r record; g uuid := (select (g->>'id')::uuid from grp);
begin
  for r in select u, c from ids where n in (4, 5, 6, 8, 9, 11, 1) order by n loop
    perform public.chat_group_invite_v1((select u from ids where n=7), (select c from ids where n=7), g, r.c);
  end loop;
end $$;
select is((select count(*)::integer from app_private.chat_group_members where group_id = (select (g->>'id')::uuid from grp)), 10, 'ten people fill a group');
select throws_ok(format($q$select public.chat_group_invite_v1(%L,%L,%L,%L)$q$, (select u from ids where n=7), (select c from ids where n=7), (select (g->>'id')::uuid from grp), (select c from ids where n=12)), '54000', 'CHAT_GROUP_FULL', 'an eleventh person is refused');
select public.chat_group_leave_v1((select u from ids where n=7), (select c from ids where n=7), (select (g->>'id')::uuid from grp), (select c from ids where n=1));
select public.chat_group_invite_v1((select u from ids where n=7), (select c from ids where n=7), (select (g->>'id')::uuid from grp), (select c from ids where n=12));
select is((select count(*)::integer from app_private.chat_group_members where group_id = (select (g->>'id')::uuid from grp)), 10, 'kicking frees a seat');
select throws_ok(format($q$select public.chat_group_leave_v1(%L,%L,%L,%L)$q$, (select u from ids where n=2), (select c from ids where n=2), (select (g->>'id')::uuid from grp), (select c from ids where n=3)), '42501', 'CHAT_FORBIDDEN', 'only the owner can remove others');
select public.chat_group_leave_v1((select u from ids where n=7), (select c from ids where n=7), (select (g->>'id')::uuid from grp));
select is((select owner_character_id from app_private.chat_groups where id = (select (g->>'id')::uuid from grp)), (select c from ids where n=2), 'ownership passes to the longest-standing member');

-- Lobby channel is members-only ------------------------------------------------------------
select throws_ok(format($q$select public.chat_list_v1(%L,%L,'lobby:11111111-1111-4111-8111-111111111111',0,10)$q$, (select u from ids where n=1), (select c from ids where n=1)), '42501', 'CHAT_FORBIDDEN', 'lobby chat requires a lobby seat');

-- Game feed lines and retention -----------------------------------------------------------
select ok(public.chat_post_system_v1('world', 'system', 'The Ember Warden has fallen in Sector 112.') > 0, 'server can post a system line');
select throws_ok($q$select public.chat_post_system_v1('world', 'chat', 'forged')$q$, '22023', 'CHAT_INVALID', 'system posts cannot pose as chat');
update app_private.chat_messages set created_at = now() - interval '8 days' where channel_key = 'world';
select ok(app_private.chat_prune_v1() >= 1, 'retention prunes old world lines');
select is((select count(*)::integer from app_private.chat_messages where channel_key like 'dm:%'), 1, 'recent whispers survive pruning');


-- Chat follow-ups -------------------------------------------------------------------------
select has_table('app_private', 'chat_reactions', 'reaction ledger exists');
select has_table('app_private', 'chat_typing', 'ephemeral typing state exists');
select has_function('public', 'chat_react_v1', array['uuid','uuid','bigint','text'], 'reaction RPC exists');
select has_function('public', 'chat_typing_v1', array['uuid','uuid','text','boolean'], 'typing RPC exists');
select has_function('public', 'chat_typers_v1', array['uuid','uuid','text'], 'typing reader exists');
select ok(not has_function_privilege('authenticated','public.chat_react_v1(uuid,uuid,bigint,text)','execute'), 'browser cannot invoke reaction RPC directly');
select ok(not app_private.chat_can_access_v1((select c from ids where n=2), 'feed:' || (select c from ids where n=1), false), 'another character cannot read a private feed');
select ok(public.chat_post_system_v1('feed:' || (select c from ids where n=1), 'story', 'A new chapter begins.') > 0, 'trusted source posts a story feed event');
select is(jsonb_array_length(public.chat_list_v1((select u from ids where n=1), (select c from ids where n=1), 'feed:' || (select c from ids where n=1), 0, 10)), 1, 'owner sees private feed events');
select public.chat_send_v1((select u from ids where n=8), (select c from ids where n=8), 'world', 'reaction smoke');
select is(jsonb_array_length(public.chat_react_v1((select u from ids where n=8), (select c from ids where n=8), (select max(id) from app_private.chat_messages where body = 'reaction smoke'), '🔥')), 1, 'reaction toggle adds an emoji');
select is(jsonb_array_length(public.chat_react_v1((select u from ids where n=8), (select c from ids where n=8), (select max(id) from app_private.chat_messages where body = 'reaction smoke'), '🔥')), 0, 'reaction toggle removes an emoji');
select public.chat_typing_v1((select u from ids where n=2), (select c from ids where n=2), 'group:' || (select (g->>'id')::uuid from grp), true);
select is(jsonb_array_length(public.chat_typers_v1((select u from ids where n=3), (select c from ids where n=3), 'group:' || (select (g->>'id')::uuid from grp))), 1, 'group member sees an active typist');

select * from finish();
rollback;
