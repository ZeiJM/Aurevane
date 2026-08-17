begin;

create index battle_participants_character_idx
  on app_private.battle_participants (character_id)
  where character_id is not null;

comment on index app_private.battle_participants_character_idx is
  'Supports character-first foreign-key maintenance and participant lookups without relying on the session-leading uniqueness index.';

commit;
