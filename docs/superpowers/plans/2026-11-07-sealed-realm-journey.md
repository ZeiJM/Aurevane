# Sealed realm journey implementation plan

**Goal:** Exercise the Farmer Joe handover through a real, optional private World trip and a linked battle whose first victory completes the chapter.

**Architecture:** Extend the existing item exchange receipt with a captured published NPC giver, a private realm per attempt and one battle link per admission. Reuse the World version and combat admission/result authorities. No production NPC, story, item or reward is created by the migration.

**Spec:** Unified Handover sections 8.2 and 14A.

- [ ] Write the disposable Postgres fixture for published Joe and guardian, seven carried seeds, explicit travel and challenge, an unrelated victory, a loss, a retry and one rewarded win. Run it before introducing the realm contract.
- [ ] Validate and capture the realm, publish its known dialogue state only, and handle movement with server-owned destinations and current World command receipts. Test other ownership, unavailable NPC placement, expired occurrences, and exit and return.
- [ ] Use the ordinary AI battle constructor and persistence through a gated admission RPC, link the session in the same transaction, and settle only the engine's linked victory event. Verify loss, surrender/abandonment, stale/duplicate commands and unchanged ordinary Arena behavior.
- [ ] Add Events authoring fields and separate player responses, preserving the existing dialogue accessibility and world battle redirect. Run focused DB and game-core tests, World and battle regressions, formatting/lint/types and the application quality gate; native/browser and hosted verification remain separate.

The disposable fixture creates Farmer Joe and Aurevane as published NPCs, uses seven carried emberseeds and awards an existing approved XP package. This source change creates no production content, grant or occurrence. The guardian uses the ordinary high difficulty duel engine with the captured Story identity. A later retry retains the key and access even after the original occurrence expires. World departure and arrival both receive scene invalidations.

The migrated PostgreSQL fixture tests the engine-generated loss and victory receipts, single reward, duplicate and stale battle commands, an unrelated battle, privacy and expiry. The disposable Playwright fixture additionally covers Event authoring, information without acceptance, simultaneous hand-in, separate travel and challenge, surrender and reconnect on desktop and mobile. It requires native local Supabase and is not an assertion of completed browser or Owner playtesting.
