# Migration history reconciliation — 2026-09-11

## Evidence and scope

The Supabase Preview check on main `f7248dcf` failed with `Remote migration versions not found in local migrations directory.` Production and Git both contain 73 migrations with a one-to-one name mapping, but 28 recorded versions differ from the Git filename.

For 23 affected records the SQL matches after whitespace normalization. The other five were reviewed by full textual diff: differences are comments, outer BEGIN/COMMIT wrappers, or final newline only. No gameplay SQL needs replaying. The unaffected 45 version identities remain untouched; this is not a full semantic schema diff.

The repair changes only the 28 version values in `supabase_migrations.schema_migrations`, preserving names and original recorded statements. It runs in one transaction with a short lock timeout, a migration-count guard, per-row name/content-hash guards and an exact updated-row count. Any mismatch rolls back the transaction. It does not execute historical migration bodies or modify game data.

## Reversible mapping

To reverse this specific metadata operation, map the Git version back to the former recorded version only after confirming no subsequent migration work conflicts. Preserve the same name/content guards. Never rerun migration bodies as a rollback.

| Name | Former production version | Git version |
|---|---|---|
| pvp_spectator_join_ambiguity_fix | 20260823034002 | 20260823033500 |
| account_deletion_grace_period | 20260824014357 | 20260824003500 |
| player_recent_battle_emojis | 20260824103835 | 20260824015000 |
| pvp_lobby_unseat_reseat | 20260824103900 | 20260824020500 |
| pvp_spectator_chat_write | 20260825052241 | 20260825051500 |
| battle_log_full_history_pagination | 20260826013247 | 20260826003500 |
| pvp_lobby_join_preserve_ready | 20260826164348 | 20260826164500 |
| ai_turn_clock_contention_fix | 20260829042645 | 20260829033000 |
| p31_discipline_build_authority | 20260904160645 | 20260903031500 |
| p31_character_build_provisioning | 20260904160700 | 20260903031600 |
| p32_secondary_attunement | 20260904160917 | 20260903140500 |
| p34_profile_skill_configuration | 20260904161050 | 20260903171500 |
| p34_active_build_schema_compat | 20260904161107 | 20260903171600 |
| p34_preserve_active_build_schema | 20260904161121 | 20260903171700 |
| p35_resonance_framework | 20260904161151 | 20260903190000 |
| p36_essence_framework | 20260904161221 | 20260903200000 |
| p37_saved_build_loadouts | 20260904161339 | 20260904121500 |
| p37_saved_build_loadout_upsert_fix | 20260904161603 | 20260904121600 |
| pv2_owner_test_access | 20260904162627 | 20260904163000 |
| phase3_four_technique_contract | 20260905132417 | 20260905040000 |
| character_presence_directory | 20260905182637 | 20260905162500 |
| technique_mixed_loadout_authority_fix | 20260906224100 | 20260906224000 |
| active_discipline_skill_provisioning | 20260907005739 | 20260907002000 |
| foundation_trio_class_content | 20260907021624 | 20260907013000 |
| active_player_discipline_testing_access | 20260909204253 | 20260909143000 |
| jsonb_object_length_compat | 20260910111152 | 20260909222550 |
| primary_core_attribute_profiles | 20260910111407 | 20260909222626 |
| primary_core_profile_constraint_hardening | 20260910111510 | 20260909222627 |

## Verification

Repair executed successfully on 2026-09-11. A fresh `list_migrations` read returned exactly 73 rows; every version/name pair matches the repository, with zero missing or extra pairs. Original statement records were preserved. The prior failed integration check is historical; a new check must validate the next candidate independently.

## Prevention

Follow `INFRASTRUCTURE_SETUP.md`: repository migrations must retain their committed timestamp when deployed. Generic migration tools that assign a new timestamp caused this class of drift. Before the next migration push, compare hosted history with the Git migration filenames and stop on unexpected identities.
