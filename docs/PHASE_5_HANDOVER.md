Current World/battle release — October 12: PR #881 is LIVE for testing at https://aurevane.vercel.app/game/world, production `dpl_2HH6uzKfqGspBxP8NdFZKh3wG2KZ`, READY `2026-10-13T02:56:58.234Z`, exact verified merge `468b6017a5cf5e29a0ffc0f5b0b08c327ce96429`. All eight final-source workflows and bounded signed-in production World checks pass. No new migration or phase closeout; human acceptance and live 100-player evidence remain pending. See docs/verification/2026-10-12-world-battle-followup.md for the current receipt.

# Aurevane — Living Atlas / Phase 5 handover

## Release boundary and evidence

This is the post-release handover prepared in [PR #671](https://github.com/ZeiJM/Aurevane/pull/671). That PR must land only after the Owner-authorized Atlas production deployment is verified. The exact final CI results, applied migration version, production commit/deployment ID and live-check scope are recorded in [PR #609](https://github.com/ZeiJM/Aurevane/pull/609). Verify that record and current production rather than inferring deployment from a local branch.

Live testing destination: https://aurevane.vercel.app — sign in and open World. Automatic Vercel Git deployment returns to the normal `**: false` lock with this handover. The release authorization covered this Atlas release, not future unrelated deployments.

The final application candidate and reconciled main SHA are recorded in PR #609. The post-release branch changes only the deployment lock and documentation. Phase 4 is closed by explicit Owner decision recorded in PRs #659/#660; do not reopen its acceptance checklist or invent independent tester evidence. Full Phase 5 and Owner acceptance of the live Atlas remain open.

## Delivered Atlas scope

- Interactive globe, eight canonical regional scenes, eight authored 13-square road sectors and a private frontier survey scene.
- Roads: Crown, Coastal, Ember, Southern Caravan, Highland, Northern Pass, Eastern March and Old Coast.
- Four-second local movement, persistent routes, stopping/resuming, blocked terrain, authoritative exits, private discovery and proximity PvP using committed builds.
- Ambient 360-degree sector panoramas; these are not per-cell 3D environments.
- Restrained regional water/lava flow, coastal wash, wind, light and smoke/motes. Decoration remains beneath controls and honors motion-off and reduced-motion preferences.
- Real Postgres contention coverage for command retries, mutual attacks, movement against attack, and training/build changes after encounter snapshot preparation.

## Verification context

The candidate's full local gate passed: **2,811 Vitest tests plus seven report/audio Node checks**, formatting, lint, workspace types and production builds. Seventy-six focused world tests cover traversal, collision, projection and all 56 ordered regional journeys. The preceding candidate’s corrected desktop workflow passed all 47 scenarios; candidate-specific final results are in the release record. Final workflow results belong to the release record in PR #609; do not substitute an earlier candidate's green results.

Earlier application candidate `c49921f1` passed all 13 workflows, including 18 Atlas browser scenarios, 220 main smoke scenarios, 20 preliminary checks and four Edge checks. Screenshot review confirmed the corrected laptop Training reward text is readable beside its actions. The delivery notes preserve detailed browser, visual and media-provenance evidence.

Latest main reconciliation preserved the persistent roaming shell, compact public profiles, Battle Hall fit/scrollbars and approved Bastion artwork. Two stale test expectations were corrected: directory dismissal uses Escape and checks focus restoration, and the media test requires the approved Fortress WebP. Existing containment, audio-hash and generated-art fallback coverage remains. The focused media suites passed 17 tests. A runner database-port collision was handled by retrying only that failed workflow; a corrupt local Turbopack cache was set aside and a clean build passed. Neither required runtime changes. Final CI also exposed a transient buildcraft-status assertion and compact Hall inputs below the existing 40-pixel minimum. The browser test now verifies the successful save response, exact committed selection and reload persistence; the compact inputs retain a 40-pixel minimum. Existing no-scroll, readability and containment assertions remain intact.

Authenticated journeys and concurrency scenarios run against disposable CI accounts/databases. Consult the release record for the actual production smoke coverage; do not represent automated CI as human live acceptance.

## Database and repository safeguards

Migration source: `supabase/migrations/20260923190443_living_atlas_world_travel.sql`. Production database: `luazfeupwfgnilohfsya`. The migration adds private world state/encounter provenance, four service-role-only RPCs and battle/training/spectator guards. The release record contains its actual applied version and post-migration checks. Older migration-history bookkeeping drift does not authorize replaying unrelated migrations.

Read `AGENTS.md`, `docs/GAME_MASTER_PLAN.md`, `docs/ROADMAP.md`, `TASKS.md`, `docs/PHASE_5_TICKETS.md` and `docs/LIVING_ATLAS_DELIVERY.md`. The approved Atlas contract is `docs/superpowers/specs/2026-09-22-living-atlas.md`, with its implementation plan beside it.

Refresh main explicitly with `git fetch origin refs/heads/main:refs/remotes/origin/main`; the original checkout's fetch configuration tracked only the feature branch. Main changed repeatedly across other chats during this release. Preserve newer approved work and follow `docs/CONCURRENT_AGENT_WORKFLOW.md` before editing or releasing.

## Continue next

Start with the Owner's live Atlas feedback and concrete defects. Then take the next small approved Phase 5 slice: settlements/locations, NPC dialogue, quests, vendors, Archive/lore and player-facing world events. Supernatural choice and the first authored frontier/Cartographic Drift slice remain later work. Reuse completed Phase 4 infrastructure; this Atlas is not all of Phase 5.

Keep persistent state server-authoritative, preserve normal supernatural exclusivity and spoiler boundaries, and never repurpose Owner-granted Anomaly states as frontier rewards.

## Initial October 11/12 map refinement — historical #877 release

PR #877 is merged at `61eba80261b32139cabfad135d5c74aee9b65751`. Production `dpl_G18UAyBsowxFTy4ReZsA5RfojWv5` became READY at `2026-10-12T06:15:55.196Z` with the canonical https://aurevane.vercel.app/game/world alias and that exact source SHA. The native painted map shares its 128×64 atlas with movement/projection/globe, with seamless crossing at every shared walkable ordinary land edge. Eight distinct nine-sector towns have at least nine entire countryside sectors between footprints; five multi-sector scenic destinations add sakura, autumn, wisteria, willow cascades and wildflowers. Legacy trails/private surveys retain saved state and explicit exit controls. Minimum 200 ms steps and overlapping ≤256-step saved route windows preserve authority without a migration. The PvP clock/resource repair is included.

All nine exact-head workflows pass, including 27 Atlas browser cases, responsive smoke and the complete long journey. Final screenshot review and bounded authenticated live movement, Places/Missions, atlas fallback, six-boundary Cherryblossom Grove arrival and return checks pass. Exact evidence, failed candidates and repairs are in `docs/verification/2026-10-11-world-refinement-progress.md`. #875 is closed as superseded; #874 was already closed; #869 remains parked. Automatic Git deployment remains locked. Human gameplay acceptance, live 100-player load evidence and overall Phase 5 acceptance remain open.

## Current October 12 World correction — released for testing

Owner world-map refinement — October 11/12: LIVE for testing through PR #879, merge `a15434206e7f1aef26a94807b00bea4f77259123`, production `dpl_EoovxVApidZZVTdHMihEjiwmpY1u`, READY at https://aurevane.vercel.app/game/world since `2026-10-12T19:10:49.444Z`. Restored cloud shadows, rain/cold-region snow, dust/embers, independent rooted canopy motion and articulated wildlife; coherent flowing water/bridges/cascades/coasts; accurate public globe terrain and selectable main towns; continuous longitude routing with 214 connected countryside sectors and 31 ponds. Full-height quarter-width teal/gold panel, Settings zoom/lock, WASD/wheel/pinch, settled arrival, clearer custom-first portraits, viewport Nearby and Active/Completed Missions with canonical quest completion are delivered. All nine exact-head workflows and bounded signed-in live checks pass. Only the explicitly approved service-only scene-player migration was applied (`20261012144305_world_scene_players` hosted history). Preserve minimum 200 ms authoritative steps, bounded saved route windows, private discovery and encounter authority. #875 is superseded; #869 remains parked. See docs/verification/2026-10-12-world-ambient-restoration.md and docs/superpowers/specs/2026-10-11-world-refinement-design.md. Human gameplay acceptance and live 100-player evidence remain pending; no phase closeout is implied.

Final source head `42380d2b2b8526e764ef75f94e55a6d638bf08f7` passes all nine exact-head workflows, including 39 Atlas cases and 73 focused/337 full-suite/10 Edge browser cases. The merged source tree exactly matches the tested tree. Local checks pass 4,931 Vitest plus seven Node checks, formatting/lint/eight-package types/build. Actual live layout/portraits, wheel zoom/lock, WASD step-and-return, settled camera, main-town selection, globe/local return and Mission filters pass; the initial bounded error/fatal runtime query is clear.

The approved scene-player reader is the only hosted migration in this correction. The constrained 101-token rendering benchmark is 36ms draw p95 at 4×CPU/DPR2.625; this does not establish live 100-player capacity. Preserve the deployment lock, original database/private discovery and canonical rewards. Human gameplay acceptance remains pending. Earlier #877 receipt is retained above as historical rollback evidence; this correction is the current live World.
