# Resonance quality publication recovery — 2026-10-22

**LIVE for testing — corrected publication verified October 22, 2026.**

The final corrected publication executed in a single CAS-guarded transaction and passed a complete **72/72 live JSONB definition comparison** against the exact reviewed `after` records. Catalogue current definitions remain 294, of which 136 are Resonances; 72 have revised current versions, 64 retain their existing versions. Immutable history is now **1,097** records (the initial 953 + 72 failed historical +1 versions + 72 corrected +2 versions); drafts remain zero and global timing policy stays at version 8. The public current-content reader exposes the corrected Returning Current definition at version 10. The canonical production domain resolves to Vercel deployment `dpl_BQgHdRJQDYndXDRtexL5AZ8uLihh` (READY), build commit `874a14ce5b7f9aabed8df11140a9017fbfa4f71e`. No new app deployment was needed for the versioned catalogue publication. Initial post-publication Vercel warning/error/fatal scan found no entries.

The corrected rollback asset was also rehearsed with a top-level `ROLLBACK`; after the rehearsal the catalogue token, 1,097 history count and 72 revised pointers remained unchanged. The final-head Skill Engine and focused controlled-combat/modular-reader/Discipline DB browser workflows succeeded; broader CI/browser workflows were still running at the last inspection, so they are not represented as passed. Authenticated human gameplay, physical-device and multiplayer/load acceptance remain unverified.

## Initial attempt and containment
- Initial 72-definition publication committed 72 additional immutable version records (history 953 → 1025) and moved current pointers.
- Exact live definition comparison immediately caught **72/72 missing unchanged ability-behavior fields**. The faulty PostgreSQL expression `(current_definition #> path) || row->'behaviorPatch'` was parsed as a lookup of `behaviorPatch` on the joined expression. The initial in-transaction assertion only compared the stored result to the same malformed proposed object.
- No other kind was intentionally modified; current inventory remained 294, Resonances 136, drafts 0 and timing policy 8.
- The initial rollback asset first failed its catalogue token guard because the replacement matched the comment rather than the SQL placeholder. The next attempt encountered an ambiguous PL/pgSQL identifier. Both failures rolled back without changing pointers.
- Corrected emergency rollback used **one transaction-wide catalogue token check** and `public.set_combat_content_publication_v1` for each historical pointer. A readback verified all 72 revised pointers were no longer current: `new_current = 0`, current total 294, history 1025. The invalid +1 versions remain immutable historical rows; they were never deleted.

## Corrected publication candidate
- Reserves `previousVersion + 2` for each of the 72 corrected new versions (expected history 1025 → 1097).
- Explicit parentheses on **both** JSONB operands preserve the complete behavior object: `(current_definition #> path) || (row->'behaviorPatch')`.
- In-transaction structural checks require preservation of `behavior.id`, `activation`, `mode` and an effects array. Complete published definitions must then be compared to all 72 reviewed `after` JSON objects outside the transaction before sign-off.
- Version-floor check demands the failed +1 historical version is still present and the original baseline is current.
- All 72 revised originals and native tags/targeting remain in the versioned candidate. Ordinary Skills, Essences, Basics and global timing policy must remain unchanged.
- The corrected publication transaction was rehearsed using a top-level `ROLLBACK` and returned successfully, with the original live pointers remaining unchanged.

## Mandatory sign-off
1. Verify the latest live application supports the candidate and the exact-head candidate tests pass.
2. Refresh the live catalogue token and recheck 294 current, 136 Resonances, history 1025, drafts 0, policy 8 and 72/72 original baseline matches.
3. Execute the reviewed corrected publication under catalogue CAS.
4. Compare **the complete JSONB definitions** for all 72 revised current pointers to the candidate; require 72/72. Recheck current 294, Resonances 136, history 1097, drafts 0 and timing policy 8.
5. Verify public readers, the canonical production alias and warning/error/fatal logs. Retain the corrected rollback asset and make no claims of authenticated human/gameplay acceptance without those tests.

Immutable historical +1 versions must never be reused or pointed to by rollback.

## Final corrected release receipt

- Source: merged PR #964, `a0601d29769f136f98c31208457ebec7e98d0803`; initial quality proposal PR #963, `01799fb599055b2543312636ae83bbaf41bff9ac`.
- The post-release exact current-content comparison returned `expected:72, read:72, exact:72, mismatches:[]`.
- Returning Current: `Primed [Self]` → `Haste [Self]` one turn, automatic with 3-turn cooldown.
- Still Target: `Rooted [Affected]`, Enemy, range 1–3, LOS, Dmg [3], 3 MP, automatic Damage Dealt, once-per-action/round and 3-turn cooldown.
- Crystal Impact: `Frozen [Affected]`, Enemy, range 1–2, LOS, Dmg [3], 3 MP, automatic Damage Dealt, once-per-action/round and 3-turn cooldown.
- Current Resonance acceptance census: 132 automatic and 4 ongoing (passive), zero manual, zero empty effect lists and zero with more than two effects.
- Historical +1 records from the failed attempt remain immutable and are not active. Corrected +2 records are the only revised current pointers. No Skill, Essence, Basic, timeline policy or other game-content publication was performed.
