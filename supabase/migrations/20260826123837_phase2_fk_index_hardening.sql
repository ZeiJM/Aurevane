-- Phase 2 behavior-preserving database hardening.
-- Mirrors Supabase migration 20260826123837 / phase2_fk_index_hardening.
-- No gameplay, authority, timer, reward, progression, RLS, or API semantics change.

create index if not exists pvp_lobby_members_user_id_idx
  on app_private.pvp_lobby_members (user_id);

create index if not exists product_validation_events_character_id_idx
  on app_private.product_validation_events (character_id);
