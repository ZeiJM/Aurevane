# Living Atlas — implementation candidate, 2026-09-22

Owner explicitly authorized Phase 5 and the approved map style in parallel with Phase 4. This branch delivers the initial Strategic Atlas/travel slice. It does not close Phase 4 acceptance or all of Phase 5.

## Implemented

- Dedicated World Map rail entry and the existing character identity rail, without location metadata.
- Globe and square-grid Sector views; all eight canonical regions, distinct original paintings, settlement walls, centered portraits and eastings at the bottom.
- Server-owned travel, timed regional road links, quest Start/Stop Auto-path, persistent survey knowledge and a deliberate first frontier crossing.
- Live production event objectives read from the existing event platform. Authors can configure destination, guidance and auto-path per objective in Event Builder; published versions remain immutable and settings apply to new runs. Pausing/ending a run withdraws its auto-path on the next server tick. No unrelated quest is disabled.
- Open-territory proximity attacks reuse existing tactical PvP creation and committed builds. Protected settlements, ownership, stale versions, server timing, training and active battle checks apply. Battle entry interrupts routes.
- Subtle environmental motion, a motion toggle, reduced-motion support and temporary regional View 360 with drag/keyboard/zoom/Escape. Polling remains active while looking around; viewing gives no immunity.
- Hidden frontier cells, landmarks, routes and players are filtered on the server. Public artwork is decorative known-world scenery, with no private frontier geography encoded into it.

## Deliberate scope and remaining content

This is a bounded authored first slice: one 13×9 local scene per canonical region and one surveyed frontier scene. The 45–85 second regional road links are elapsed-time transitions: a traveller remains encounterable at the departure cell until arrival. They are not yet continuous multi-sector corridors. More authored sectors, route encounters and settlements are needed to achieve the full expansive-world content goal.

View 360 is a regional ambient panorama, not a unique scene for every square; it is unavailable for undiscovered frontier scenes. Landmark arrival records a discovery, not a reward or full narrative quest completion. The two initial travel objectives do not implement the full quest system. Frontier Anchors, controlled Cartographic Drift, Archive integration, NPC dialogue, vendors, supernatural fork and region-specific tactical battle scenes remain later Phase 5 work. There is no claim that these are finished.

## Verification and release boundary

Focused domain/service tests cover legal routes, one-step advancement, hidden projection, cell centres, globe geometry, input validation and event policy isolation. PGlite executes the actual new PostgreSQL migration and the existing production PvP-creation function against minimal dependency tables; tests cover ownership/RPC restrictions, replay/version/timing rejection, training exclusion, route interruption, protected/moved targets, stale builds, competing attacks and transaction rollback. These focused tests do not simulate distributed concurrency. The Foundation Security DB workflow additionally passed a full disposable Supabase migration reset on candidate `bcab717e` (run 35787185303).

The cloud browser rejected the local preview URL with `ERR_BLOCKED_BY_CLIENT`. New authenticated Playwright acceptance now covers desktop/laptop/mobile map geometry and travel, globe and temporary surroundings, all eight regional panoramas, expired training, private frontier discovery, and a two-player attack while the target views 360. It uses the existing disposable-local Supabase browser CI; no preview deployment is needed. Results are pending until the updated branch runs. No fixture authentication bypass ships.

Before release: apply migration through the normal approved migration workflow, run the complete migration chain in staging, exercise two authenticated players and competing movement/attack/build/training operations, then inspect 1440×900, 1366×768 and mobile layouts and all eight panoramas. Neither migration nor deployment is authorized by this implementation branch. Vercel git deployment remains disabled.

## Decisions recorded

- Bounded authored sectors and timed road transitions avoid procedural filler; the cost is further authored content before claiming a large seamless world.
- Domain, persistence and UI are delivered together because they share a new interface; the cost is a larger review patch.
- Browser acceptance stays open because local preview access was blocked; the cost is a separate preview review before release.

Local gate result: `pnpm check` passed on 2026-09-22 after reconciliation with `db578185`: formatting, lint, all workspace type checks, 2,700 Vitest tests, six Node report tests and production builds. This validates the implementation candidate; it does not replace the open browser/staging gates above.

Independent review found three important concurrency defects; all were reproduced by four failing SQL regression tests and fixed. A guard now runs before the legacy owner-battle replacement trigger for world encounters. Training and spectator writes recheck battle eligibility under the shared character/account locks. Movement successor deadlines are rebased on the database clock after acquiring locks. The migration suite now has 12 passing tests and executes the existing owner-replacement trigger as well as PvP creation.

Follow-up fixes: map reads now materialize expired training through the existing report authority in a separate transaction, without claiming rewards. Travel requests carry a stable intent fingerprint, allowing a successful HTTP retry to return current authoritative state without a second mutation; reuse with different intent conflicts. Replay receipts remain server-only and cover the most recent committed command. Seven new service/SQL regressions exercise these boundaries. The old browser rail-count assertion now expects the requested fifth World entry.

Final gate after review fixes: `pnpm check` passed again (exit 0), including 2,704 Vitest tests, six Node report tests, formatting, lint, workspace type checks and production builds. A final fetch still resolves main to `db578185`; no additional conflict was introduced. Implementation proceeded under the Owner's existing approval without another permission round. This is a reviewable draft with the stated limitations, not a release claim.

Continuation validation: reconciled main through `d2c7d913` (Essence artwork plus deployment relock; no conflicting feature changes). `pnpm check` passed with 2,712 Vitest tests and six Node report tests, formatting, lint, type checks and production builds. The new authenticated Atlas browser suite is queued for existing CI. No merge, remote migration or deployment is included.

Focused follow-up review additionally covered early no-op tick receipts and expired second plans with an older pending report. Both now have regression guards; expired plans cannot block travel, pending rewards remain untouched, and report materialization waits until the earlier report is claimed.
