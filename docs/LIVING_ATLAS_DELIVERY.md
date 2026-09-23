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

This is a bounded authored first slice: one 13×9 local scene per canonical region, one distinct Crown Road wilderness sector and one surveyed frontier scene. Crown Road now connects Aureth Crown and Verdant Expanse through 13 encounterable squares, with four-second minimum local steps and ordinary boundary crossings. Other regional road links remain 60–85 second elapsed-time transitions: a traveller remains encounterable at the departure cell until arrival. They are not yet continuous multi-sector corridors. More authored sectors, route encounters and settlements are needed to achieve the full expansive-world content goal.

View 360 is a regional ambient panorama, not a unique scene for every square; it is unavailable for undiscovered frontier scenes. Landmark arrival records a discovery, not a reward or full narrative quest completion. The two initial travel objectives do not implement the full quest system. Frontier Anchors, controlled Cartographic Drift, Archive integration, NPC dialogue, vendors, supernatural fork and region-specific tactical battle scenes remain later Phase 5 work. There is no claim that these are finished.

## Verification and release boundary

Focused domain/service tests cover legal routes, one-step advancement, hidden projection, cell centres, globe geometry, input validation and event policy isolation. PGlite executes the actual new PostgreSQL migration and the existing production PvP-creation function against minimal dependency tables; tests cover ownership/RPC restrictions, replay/version/timing rejection, training exclusion, route interruption, protected/moved targets, stale builds, competing attacks and transaction rollback. These focused tests do not simulate distributed concurrency. The Foundation Security DB workflow additionally passed a full disposable Supabase migration reset on candidate `bcab717e` (run 35787185303).

The cloud browser rejected the local preview URL with `ERR_BLOCKED_BY_CLIENT`, so actual browser acceptance uses disposable-local Supabase in CI. On `bfc15306`, [Living Atlas browser run 35795492891](https://github.com/ZeiJM/Aurevane/actions/runs/35795492891) passed all five runnable scenarios (four intentional viewport-duplicate skips). Authenticated checks cover desktop/laptop/mobile map geometry and travel, globe and temporary surroundings, all eight regional panoramas, expired training, private frontier discovery, and a two-player attack while the target views 360. No preview deployment or fixture authentication bypass is used.

Before release: apply migration through the normal approved migration workflow, run the complete migration chain in staging, stress competing movement/attack/build/training operations, and obtain Owner visual acceptance. CI screenshots have been inspected at 1440×900, 1366×768 and mobile, including all eight sectors and panoramas. Neither remote migration nor deployment is authorized by this implementation branch. Vercel git deployment remains disabled.

## Decisions recorded

- Expand travel one authored road at a time, starting with Crown Road, while keeping the other timed links; the cost is further authored content before claiming a large seamless world.
- Domain, persistence and UI are delivered together because they share a new interface; the cost is a larger review patch.
- Authenticated browser acceptance runs in CI because local preview access was blocked; Owner acceptance and staging concurrency verification remain separate release gates.

Local gate result: `pnpm check` passed on 2026-09-22 after reconciliation with `db578185`: formatting, lint, all workspace type checks, 2,700 Vitest tests, six Node report tests and production builds. This validates the implementation candidate; it does not replace the open browser/staging gates above.

Independent review found three important concurrency defects; all were reproduced by four failing SQL regression tests and fixed. A guard now runs before the legacy owner-battle replacement trigger for world encounters. Training and spectator writes recheck battle eligibility under the shared character/account locks. Movement successor deadlines are rebased on the database clock after acquiring locks. The migration suite now has 12 passing tests and executes the existing owner-replacement trigger as well as PvP creation.

Follow-up fixes: map reads now materialize expired training through the existing report authority in a separate transaction, without claiming rewards. Travel requests carry a stable intent fingerprint, allowing a successful HTTP retry to return current authoritative state without a second mutation; reuse with different intent conflicts. Replay receipts remain server-only and cover the most recent committed command. Seven new service/SQL regressions exercise these boundaries. The old browser rail-count assertion now expects the requested fifth World entry.

Final gate after review fixes: `pnpm check` passed again (exit 0), including 2,704 Vitest tests, six Node report tests, formatting, lint, workspace type checks and production builds. A final fetch still resolves main to `db578185`; no additional conflict was introduced. Implementation proceeded under the Owner's existing approval without another permission round. This is a reviewable draft with the stated limitations, not a release claim.

Continuation validation: reconciled main through `d2c7d913` (Essence artwork plus deployment relock; no conflicting feature changes). `pnpm check` passed with 2,712 Vitest tests and six Node report tests, formatting, lint, type checks and production builds. The new authenticated Atlas browser suite is queued for existing CI. No merge, remote migration or deployment is included.

Focused follow-up review additionally covered early no-op tick receipts and expired second plans with an older pending report. Both now have regression guards; expired plans cannot block travel, pending rewards remain untouched, and report materialization waits until the earlier report is claimed.

Browser integration finding: candidate `5dc2510a` passed 11 workflows and 202 existing browser scenarios, but all five runnable Atlas scenarios stopped at entry. The SQL incorrectly treated the slots RPC's `deletion_execute_after` alias as a physical character column; the minimal test fixture repeated that mistake. The query now uses the existing `app_private.character_deletion_requests` table, with deletion eligibility rechecked after mutation locks. The SQL suite imports that production table definition, reproduces the former missing-column failure, and covers pending deletion exclusion. The corrected candidate passed the focused browser run above and the complete disposable migration chain in Foundation Security DB run 35795492510. The local gate passed with 2,713 Vitest tests and six Node report tests.

Screenshot review then identified phone identity-card clipping, a laptop globe extending below its viewport, and low-contrast hover states. World-specific compact card rules retain the name, portrait, progression and resources; the globe uses available container dimensions; selected tabs and panorama controls preserve dark backgrounds on hover. Browser geometry guards now require identity contents and the complete default globe to fit their containers. The latest PR check results supply the verification for this presentation follow-up. Shared identity markup adds only presentation hooks; other pages keep their existing styles.

## Crown Road continuation — 2026-09-23

The Owner's continued implementation instruction advances the approved authored-world direction with one real road sector, rather than declaring every regional transition complete. Crown Road has original map/panorama art, explicit blocked river cells and a bridge, no settlement immunity, stable sector `S16-08`, and local coordinates. Both directions use the same existing server-owned routing and PvP authority. No database schema or combat rule changes are required.

Roads & crossings controls expose only exits already present in the server's filtered sector view. The travel bar estimates remaining time from the authoritative current-step deadline plus subsequent steps; it does not advance state or simulate offline catch-up. The globe marker now derives its cell centre from the actual sector coordinate, so a road does not place the portrait at its parent region's centre. View 360 uses the current sector's registered panorama and remains unavailable for the unsurveyed frontier.

New regression coverage exercises both complete road directions, bridge collision, open-territory encounter range, hidden-frontier preservation, the road's globe cell and partial-step timing. Authenticated browser coverage adds a full real-time journey, stopping/reloading mid-road, the distinct panorama, and two-player PvP on Crown Road. Current verification results are recorded on draft PR #609; no merge, migration or deployment is included.

The continuation reconciles Phase-4 A03 roster rebalance through main `4c188261`. Focused review identified that a saved pre-update route could retain the removed direct Crown Road edge. Every tick now validates the remaining authored edges, walkability, knowledge and durations; an obsolete route stops at the saved position instead of skipping the new sector. Regressions reproduce both former directions and stale movement costs before the fix. The opposite-bank bridge test also explicitly checks the detour through the bridge. The Atlas migration has not been released by this branch.

Crown Road local gate: `pnpm check` passed after the main reconciliation and saved-route fix: formatting, lint, workspace type checks, 2,743 Vitest tests, six Node report tests and production builds. The 32 focused world domain/service tests pass. Authenticated browser verification of the new road is pending the updated draft branch CI run.
