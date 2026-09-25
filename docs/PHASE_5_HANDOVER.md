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

Migration source: `supabase/migrations/20260922203418_living_atlas_world_travel.sql`. Production database: `luazfeupwfgnilohfsya`. The migration adds private world state/encounter provenance, four service-role-only RPCs and battle/training/spectator guards. The release record contains its actual applied version and post-migration checks. Older migration-history bookkeeping drift does not authorize replaying unrelated migrations.

Read `AGENTS.md`, `docs/GAME_MASTER_PLAN.md`, `docs/ROADMAP.md`, `TASKS.md`, `docs/PHASE_5_TICKETS.md` and `docs/LIVING_ATLAS_DELIVERY.md`. The approved Atlas contract is `docs/superpowers/specs/2026-09-22-living-atlas.md`, with its implementation plan beside it.

Refresh main explicitly with `git fetch origin refs/heads/main:refs/remotes/origin/main`; the original checkout's fetch configuration tracked only the feature branch. Main changed repeatedly across other chats during this release. Preserve newer approved work and follow `docs/CONCURRENT_AGENT_WORKFLOW.md` before editing or releasing.

## Continue next

Start with the Owner's live Atlas feedback and concrete defects. Then take the next small approved Phase 5 slice: settlements/locations, NPC dialogue, quests, vendors, Archive/lore and player-facing world events. Supernatural choice and the first authored frontier/Cartographic Drift slice remain later work. Reuse completed Phase 4 infrastructure; this Atlas is not all of Phase 5.

Keep persistent state server-authoritative, preserve normal supernatural exclusivity and spoiler boundaries, and never repurpose Owner-granted Anomaly states as frontier rewards.


## Current presentation handoff — 2026-09-25

The release narrative above describes the original Atlas handover, not the current work queue. Use `ROADMAP_WORLD_EXPERIENCE.md` and the dated presentation entry in `TASKS.md` for P5-W1–W4 ownership and current evidence. No later deployment is authorized by that historical release.

- Presentation branch: `agent/phase5-map-identity-presentation-20260925`, reconciled with main `cd86b4f0`. #730 at `cd0646ea` is the only incorporated open prerequisite; its existing Profile state/choice loading remains authoritative. #724's public-avatar resolver is preserved. The Owner explicitly authorized branch publication and a draft PR on 2026-09-25 after the initial automatic-review block; merge and deployment remain outside that authorization.
- Presentation-owned files: `components/world/{world-workspace,sector-map,globe}` and `world.module.css`; Profile identity/shell/path/choice components and their styles; associated source/browser tests; this handoff, the task ledger and existing Atlas art request. #719 also touches `world-workspace.tsx`: combine its Anchor history panel with this branch's location/selection changes explicitly when integrating. Avoid replacing either file wholesale.
- Shared contract is unchanged: `WorldView`, world intents and `/api/world`; existing Profile build props; #730's `supernatural.state` and eligible choice tuples; existing `/api/character/supernatural` PUT. The presentation branch edits no world catalog, server service, persistence, migration or game-core rule. No shared DTO extension has been agreed or implemented.
- Next contract sequence: the existing Phase 5 chat authors/approves representative power facts and extends its safe versioned projection; agree field names and eligibility before presentation consumes them. Current UI truthfully states that power details are unavailable. Keep unrevealed/Owner-only data out of the payload and preserve deliberate confirmation, expected-state-version writes and idempotency.
- Art sequence: refresh #681's actual rows/landmarks before any painting work, fulfill its candidate-specific checklist in `ART-WORLD-001-living-atlas.md`, review approved v02 assets with collision/safe-zone overlays, then integrate geometry/art together. Current v01 geography/art remains in place. The matching-art merge hold is unchanged.
- Full local quality and supplemental rendered-component checks are recorded in `TASKS.md`. Authenticated real-Postgres Living Atlas/Profile browser runs and Owner visual acceptance remain open; no phase-complete or release claim follows from this local candidate.
