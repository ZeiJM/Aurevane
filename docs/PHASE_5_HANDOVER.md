# Aurevane — Living Atlas / Phase 5 handover

## Release boundary and evidence

This is the post-release handover prepared in [PR #671](https://github.com/ZeiJM/Aurevane/pull/671). That PR must land only after the Owner-authorized Atlas production deployment is verified. The exact final CI results, applied migration version, production commit/deployment ID and live-check scope are recorded in [PR #609](https://github.com/ZeiJM/Aurevane/pull/609). Verify that record and current production rather than inferring deployment from a local branch.

Live testing destination: https://aurevane.vercel.app — sign in and open World. Automatic Vercel Git deployment returns to the normal `**: false` lock with this handover. The release authorization covered this Atlas release, not future unrelated deployments.

The final application candidate and reconciled main SHA are recorded in PR #609. The post-release branch changes only the deployment lock and documentation. Phase 4 is closed by explicit Owner decision recorded in PRs #659/#660; do not reopen its acceptance checklist or invent independent tester evidence. Full Phase 5 and Owner acceptance of the live Atlas remain open.

## Repository advances after the initial Atlas Production release

The live deployment described above is an older Phase-5 baseline, not the current repository head. Preserve this distinction when reporting status.

- PR #764 merged the Owner's 2026-09-29 travel retune: ordinary authoritative world steps are **275 ms** (4× faster than the preceding 1,100 ms baseline), active World synchronization uses the same interval and player-marker interpolation is 210 ms. Saved 1,100 ms/4,000 ms routes fail closed rather than silently changing timing. This retune is merged but **not yet deployed to Production**.
- PR #763 merged P5-W2/P5-W4 presentation: explicit inspect versus travel, actual-location versus viewed-location context, route/ETA continuity, label-safe globe presentation, build identity and the existing Ascension/Severence choice presentation. This is also merged but **not yet deployed to Production**.
- PR #684 already merged the first spoiler-safe Field Observation → Archive vertical slice; do not reopen it as unimplemented.
- PRs #710/#717/#747 merged supernatural story-state authority, version-pinned proof identities/transitions and approved identity projection. The committed migration `20260924003000_phase5_supernatural_story_state.sql` is **not applied to live Supabase**.
- PRs #742/#743 merged immutable Cartographic Drift ledger persistence and the server-only persisted-resolution service. The committed migration `20260925180000_cartographic_drift_cycle_ledger.sql` is **not applied to live Supabase**.
- PR #765 is the active P5-W3A in-world NPC conversation presentation slice over the already-authoritative Eastern Watch/Hinterland Patrol objective interactions. It must not be represented as merged/live until its current-main verification and integration are complete.

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

Start with the Owner's live Atlas feedback and concrete defects. Current repository priority is:

1. Finish and integrate the verified P5-W3A NPC conversation presentation (#765) over the existing authoritative objective interactions.
2. Keep #681's distinct-settlement geometry on merge hold until matching reviewed v02 regional art exists; do not move geometry to fit old paintings.
3. Expand settlements/NPCs/quests/vendors only from approved authored content and reward facts. The Eastern Watch and Crown Hinterland loops already prove persistent accept → progress → return/completion without inventing rewards.
4. Extend Archive work with Fragment Sets/deeper lore provenance only when approved content contracts exist; the first Field Observation → Archive slice is already merged.
5. Release the already-merged supernatural story-state and Cartographic Drift persistence migrations only under explicit Production authorization, then verify the matching application flows live.
6. Continue the remaining outer-Reach/far-inhabitant/Horizon and location-coherent battle-scene work without absorbing Phase-6 continuous rendering.

Player-facing World Pulse is already built on Phase-4 event operations; do not create a parallel event system. Keep persistent state server-authoritative, preserve normal supernatural exclusivity and spoiler boundaries, and never repurpose Owner-granted Anomaly states as frontier rewards.
