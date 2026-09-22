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

Focused domain/service tests cover legal routes, one-step advancement, hidden projection, cell centres, globe geometry, input validation and event policy isolation. PGlite executes the actual new PostgreSQL migration and the existing production PvP-creation function against minimal dependency tables; tests cover ownership/RPC restrictions, replay/version/timing rejection, training exclusion, route interruption, protected/moved targets, stale builds, competing attacks and transaction rollback. This is not a full Supabase migration-chain or distributed-concurrency test.

The cloud browser rejected the local preview URL with `ERR_BLOCKED_BY_CLIENT`. Desktop/mobile visual review, live 360/keyboard interactions and authenticated two-player acceptance remain open. Temporary fixture page/API changes were restored; no fixture authentication bypass ships. Keep this PR in draft until these checks can run in an authorized preview.

Before release: apply migration through the normal approved migration workflow, run the complete migration chain in staging, exercise two authenticated players and competing movement/attack/build/training operations, then inspect 1440×900, 1366×768 and mobile layouts and all eight panoramas. Neither migration nor deployment is authorized by this implementation branch. Vercel git deployment remains disabled.

## Decisions recorded

- Bounded authored sectors and timed road transitions avoid procedural filler; the cost is further authored content before claiming a large seamless world.
- Domain, persistence and UI are delivered together because they share a new interface; the cost is a larger review patch.
- Browser acceptance stays open because local preview access was blocked; the cost is a separate preview review before release.

Local gate result: `pnpm check` passed on 2026-09-22 after reconciliation with `db578185`: formatting, lint, all workspace type checks, 2,700 Vitest tests, six Node report tests and production builds. This validates the implementation candidate; it does not replace the open browser/staging gates above.

Independent review found three important concurrency defects; all were reproduced by four failing SQL regression tests and fixed. A guard now runs before the legacy owner-battle replacement trigger for world encounters. Training and spectator writes recheck battle eligibility under the shared character/account locks. Movement successor deadlines are rebased on the database clock after acquiring locks. The migration suite now has 12 passing tests and executes the existing owner-replacement trigger as well as PvP creation.

Two minor follow-ups remain: expired training requires visiting the existing Training workflow to materialize completion; a repeated successful HTTP travel command returns a stale-version refresh rather than replaying its saved response. Neither permits duplicate movement or rewards. These are explicitly deferred, alongside the separate staging and browser gates. The independent reviewer reviewed source and production dependency paths; the implementation agent ran the full local checks.

Final gate after review fixes: `pnpm check` passed again (exit 0), including 2,704 Vitest tests, six Node report tests, formatting, lint, workspace type checks and production builds. A final fetch still resolves main to `db578185`; no additional conflict was introduced. Implementation proceeded under the Owner's existing approval without another permission round. This is a reviewable draft with the stated limitations, not a release claim.
