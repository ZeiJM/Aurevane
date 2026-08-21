begin;

-- Cover foreign-key columns used by account/character cascade deletes as spectator/chat volume grows.
create index if not exists pvp_battle_spectator_presence_user_idx
  on app_private.pvp_battle_spectator_presence (user_id);

create index if not exists pvp_battle_chat_messages_sender_user_idx
  on app_private.pvp_battle_chat_messages (sender_user_id);

create index if not exists pvp_battle_chat_messages_sender_character_idx
  on app_private.pvp_battle_chat_messages (sender_character_id);

commit;
