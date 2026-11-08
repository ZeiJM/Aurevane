# Aurevane unified upgrade implementation and evidence

The November 5 unified handover is the controlling product specification. Its 70 requirement IDs are preserved in [requirements.csv](requirements.csv). UI-01 and UI-02 track Nick's two November 7 additions. Mark a row verified only when its stated acceptance evidence is attached. A source change, fixture screenshot, or passing unit test can support a partial row.

## Current source and review boundaries

- Starting main is `b219eb1464e19b265a57ff57e8bd7f2aa12ea245` (PR #1024). The Vercel connector reported production build `dpl_CBPxHC4kMSnbSmRYsGNfKFTTexJT` on source `3efadd14ff7bb17d9b4dc4beb1990e8e7040dad2` (PR #1023), so current main includes a subsequent release-receipt commit. There are no production edits in this work.
- [#765](https://github.com/ZeiJM/Aurevane/pull/765) was closed as superseded. Its Watch conversation scope is covered by the shared World dialogue, with projected replies, interruption, keyboard dismissal and authenticated journey tests. [#681](https://github.com/ZeiJM/Aurevane/pull/681) remains open for separate topology review. Its draft changes collision rows, bridge/water placement and named locations. The unified upgrade preserves the current atlas and adds regional art at existing sites. [#373](https://github.com/ZeiJM/Aurevane/pull/373) remains dormant.
- `apps/web/vercel.json` disables automatic Git deployments for all branches. The repository requires explicit authorization for a preview or production deployment. This effort uses local checks and GitHub draft review. Merge and production deployment have separate owner approval gates.
- Prepare the full unified upgrade as one production release. Review branches and their evidence are intermediate checkpoints. Consolidate the accepted changes onto one candidate against current main, run the release gates on its exact tree, and record the migration order, content publications and rollback steps for that candidate before requesting approval.
- [#1035](https://github.com/ZeiJM/Aurevane/pull/1035) is the combined release draft. All ten current heads, #1025 through #1034, are ancestors of the candidate. This includes the requirements and equipment UI, World contention fallback, private sealed realm, shared ferry and Void, appearance and both Cinderwake routes. Review and release use the combined candidate.
- The current fixture names are **Maren Vale**, **Alder Venn’s Wolf Hunt**, **Reforging Cinderwake**, and **The Ashen Sentinel**. The restored blade is **Cinderwake**. The Sentinel fixture uses Ashbound raiders and a configurable daily combat discovery.

## Production preflight

The previous verified application baseline is `e65e6bebde6ceb23eb1eb68ed5af58cc536503db`, tree `4e68e3daa38282ea21054dcf9d2da9c2c520b9d0`. All 21 workflows passed on that tree. [Living Atlas browser](https://github.com/ZeiJM/Aurevane/actions/runs/42442258030) passed seven authored Event and World NPC cases and 57 Atlas cases, including the eight-account private presence and reconnect case. [World timing](https://github.com/ZeiJM/Aurevane/actions/runs/42442257970) repeated both movement cases twenty times. Carry this evidence forward as a baseline and require fresh checks for any successor tree.

The production migration ledger ends at `20261107103304`. It contains none of the 32 unified migrations from `20261107114807_npc_design_arena_opponents` through `20261108031500_appearance_cuff_constructions`. Generate the ordered list from the approved main-to-candidate diff and record each file's hash before applying it. Production also returned zero legacy v1 appearance URLs in the profile pointer that the activation migration would move. Refresh those read-only checks immediately before the release. Match existing hosted migrations by their reviewed history mapping before applying any new migration.

Prepare the one production rollout against the exact tested tree. Before admitting new writes, verify the application build, ordered migration plan, predecessor function bodies and ACLs, and an owner-approved content publication list. Keep the disposable fixtures out of that list. Preserve both production aliases and the existing retirement guards. Capture the relevant current configuration, draft, reward, player, and battle-pin baselines for the postflight.

Rehearse rollback on a disposable stack that has the new schema. The previous application source has no versioned appearance media route. After accepting an appearance activation or pin created by this release, recovery needs a build that continues serving those immutable URLs. Keep the migration ledger and recorded progress intact. A previous-build alias switch is a recovery option only after compatibility has been demonstrated for the state at the time of the switch.

The Mentor successor adds `20261108122349_mentor_world_challenge.sql` as the 33rd candidate migration. Mentor authoring uses approved Character XP packages, an untagged published World opponent, and one challenge per configured recurrence. Canonical battle receipts determine the exclusive outcome and any additive fast-victory bonus. A genuine defeat unlocks separate practice with no Mentor reward. Isolated database coverage exercises pause and replay. The [authenticated Living Atlas run](https://github.com/ZeiJM/Aurevane/actions/runs/42483853765) on `7b6a504b` passed Mentor authoring and fast-victory claims on desktop and mobile Chromium. Repeat that evidence on the final tree. Authenticated defeat and practice, illegitimate-loss exclusion and physical-handset acceptance remain open.

The [World timing run](https://github.com/ZeiJM/Aurevane/actions/runs/42483853711) on `7b6a504b` passed 38 of 40 cases. One setup request lost its socket and one simultaneous-walking case measured a peer jumping backward by 0.45 tiles when the scene receipt omitted the approved route. The 34th candidate migration, `20261108140122_world_scene_fallback_movement.sql`, keeps the bounded approved route in the existing read-only scene fallback. Isolated Postgres checks cover the route prefix, scene scope, permissions and absence of registration. Rerun the full authenticated timing gate on the successor tree.

## Authority map

| Surface | Current authority | Integration and verification boundary |
| --- | --- | --- |
| Atlas and travel | `world/atlas.ts`, `world/topology.ts`, `world/sector-crossings.ts`, `world/travel.ts`, `server/world/world-content.ts`, `server/world/world-service.ts`, `server/world/world-repository.ts` | Render from the projection. Compare resolved sector rows, positions, roads, crossing costs and representative routes before and after. |
| Presence and world rendering | `server/world/world-live-presence-repository.ts`, `world/live-presence.ts`, `components/world/world-controller.ts`, `map-render-terrain.ts`, `map-renderer.ts` | Keep scenery, nearby actors and navigation distinct. Time projection/commands and paint separately from transport. Compare dispersed and dense sessions with crossings and reconnect. |
| Weather | `world/environment.ts` and server `WorldView.environment`, with client `components/world/map-weather.ts` | Authoritative condition reads use server environment. Visual interpolation and personal cues must never satisfy gameplay-weather rules. |
| Appearance and battle | Character create/update APIs, `character-portrait-image.tsx`, world canvas actors and React-owned battle tokens; battle sessions capture admitted data | Validate the shared manifest at server entry points, preserve legacy portraits, and test client fallback, actual action cues, combat footprint and captured identity across refresh. |
| NPC Design | Master page permissions, Battle Hall, `POST /api/battles`, Recruit combat and authoritative AI | Keep reusable NPC identity, private drafts and Arena publication separate from Events. Verify authenticated reads, direct mutation authorization and existing battle capture. |
| Existing quest interactions | `server/world/world-objectives.ts`, `world-service.ts`, the versioned world command endpoint | Extend local projection and command validation. Preserve exact scope for accept/report, stale requests and private state. |
| Persistent Events | `event-authoring-service.ts`, `event-operations-service.ts`, corresponding Supabase stores, `game-core/events/persistent-event.ts` and lifecycle SQL | Separate category, occurrence status and personal state. Existing October 25 migration intentionally gates objective/reward publication when the producer is missing. Remove only a specific guard covered by a verified producer and recoverable entitlement path. |
| Inventory, equipment and rewards | `character-items-service.ts`, Items publication snapshots, database command/RPC boundaries and persistent Event participation ledger | Check current carried items server-side. Use atomic exchange, stable entitlement identity, captured rewards and claim retry. Leave earned entitlements when inventory is full. |

## Staged execution and evidence gates

| Stage | Source work | Required evidence before sign-off |
| --- | --- | --- |
| 0 | Pin main and Vercel production, audit open work, capture atlas inventory and paths, record browser and database environment. | Source SHAs, route/extent comparison, actual-game baseline and supported test environments. |
| 1 | Extend current scene and actor renderers with limited Frostmere and nearby shore pass. Show three identities in world and battle, keep the existing actor hit plane. | Side-by-side reference and gameplay captures, desktop/mobile, real action states, actor silhouettes, weather direction, anchors, selection and frame-time deltas. |
| 2 | Add shared appearance and actor contracts, preserve fallback, define only typed quest functions that can receive authoritative evidence, and preserve the transaction boundary. | Direct-call authorization, compatibility and concurrent retry tests, migration dry run and producer/evidence map. |
| 3 | Extend creation, Account and NPC Design. Publish an Arena-only test NPC with optional committed lore and legal combat. | Actual card and battle, refresh-safe draft, independent Arena readiness, old/failed appearance and NPC-only rejection checks. |
| 4 | Use local world interactions in the dialogue overlay and connect Event Library, picker, journal and first full story. | Desktop/mobile, named actions, seven-seed concurrent hand-in and durable access before optional travel/battle. |
| 5 | Add branches, catalog producers, campaign timing, conditional rewards, secrets and category-specific Live Ops. | Maren Vale, Alder Venn, The Ashen Sentinel, Cinderwake, Arena-only and Mentor journeys with real outcomes, pause, claim and privacy checks. |
| 6 | Finish appearance catalog, optional image proposal, regeneration and field/battle animation. | Five matched expressions, twenty outfits and 100–200 seeded identities, at least 10,000 verified compatible garment constructions, quotas and activation race checks. |
| 7 | Apply coherent regional art and environmental profiles across the atlas, validate editing, compare authority, test multiplayer. | Routes through hubs and wilderness, banks and bridges, weather/quality clips, stable geography, and actual dispersed/hotspot load with crossing, reconnect and simultaneous battle evidence. |
| 8 | Reconcile main, integrate the dependency-ordered branches, run quality and browser/database gates on the same review candidate. | Exact head, CI and test results, linked captures and metrics, documented genuine blockers, [owner audit](owner-audit.md) and separate production approval. |

## Review grouping

Keep the two UI changes in a small draft based on main. Prepare world visuals, shared appearance, NPC Design, dialogue and Events as reviewable slices. If one slice requires another's types or schema, stack it explicitly or verify the combined branch. Verify again after resolving any shared file. Keep fixture content out of production catalogs and apply migrations only against isolated persistence during implementation.

For the asset review, match the reference boards at actual zoom. Check a purposeful market center, distinct building uses, narrow destination paths, natural dry-to-wet shoreline layers, coherent falls and river outlets, biome mixing and five matched character expressions. Compare actual captures and record discrepancies. Concept PNGs and schematics remain design inputs.

For the UI review, run the Character Items and simple requirement component suites, existing master target and resonance suites, and both production-component Chromium regressions. Keep the None option first. Sort by English display label using the same ordering as the effect picker. Preserve executable tag IDs and preserve the equipment total and slot repair/blocked hints.

## Checkpoint measurements

The checked-in atlas contains 1,870 charted sectors in eight regions and occupies a 1,664 × 576 tile address space. The charted atlas has 214,969 walkable cells. The compatibility test includes legacy and protected server sectors in the authority fingerprint. It separately checks three long routes, the east–west seam, and the existing frontier return. A loopback Chromium fixture using the production renderer and canonical world resolver traveled 150 steps through 19 sectors from Verdant Expanse to Hollow Coast in 30.004 seconds.

The browser evidence also shows three distinct painted appearances walking and issuing real combat commands through the isolated game rules. The highest-load phone fixture misses the 30 FPS target. Its desktop and mobile captures use isolated fixture peers.

The [authenticated Atlas run](https://github.com/ZeiJM/Aurevane/actions/runs/42372364205) on the visual draft `390df911` exercised eight concurrent sessions in disposable Auth, PostgreSQL and Realtime. Chromium emulated a 393 × 851 CSS-pixel phone viewport at DPR 2.75 without CPU throttling. Eight accounts joined World channels again after a reload burst, all eight saw the other seven in hotspot snapshots, one crossed a sector boundary and two opened separate battles concurrently.

| Measurement | Dispersed p95 | Hotspot p95 |
| --- | ---: | ---: |
| Canvas ready | 5.11 s | 6.13 s |
| Move approval round trip | 572 ms | 447 ms |
| Arrival observed by polling | 3.61 s | 3.53 s |
| Full World snapshot | 603,592 B | 619,443 B |

The observer's renderer callback p95 was 117 ms. The eight-session capture recorded zero broadcasts and four socket errors, but the sampler discarded binary frames and the test allowed fallback polling. The same run's separate two-player test observed peer movement in 538 ms through presence-only authority while blocking the general World fallback read. The eight-session case establishes the tested gameplay behavior and snapshot timings at that load. [The revised cohort gate](world-multiplayer-evidence.md) checks private delivery separately. Its native run and production capacity remain open.

The zoomed-out Balanced phone renderer now caches display-sized biome crops after profiling repeated large atlas resamples. The fixture used Chromium at 393 × 851 CSS pixels, DPR 2.75 and 4× simulated CPU slowdown, sampled for six seconds per case. Peer markers, nameplates and ground anchors stayed visible.

| Visible fixture peers | Previous callback p95 | Cached callback p95 |
| ---: | ---: | ---: |
| 25 | 77.0 ms | 17.9 ms |
| 50 | 80.5 ms | 21.2 ms |
| 100 | 73.7 ms | 22.1 ms |

Browser frame interval p95 stayed near 100 ms in these runs. The 30 FPS goal remains open. The evidence records callback time, canvas draw time and browser frame interval separately.

The later [stationary phone ground benchmark](stationary-phone-ground.md) reduced browser frame interval p95 to about 50 ms for 25, 50 and 100 fixture peers. This was an A/B run on the same emulated phone with a 4× CPU slowdown. A later six-second sample per load, after correcting idle frame scheduling, kept all 25, 50 and 100 fixture peers visible. Browser interval p50 was 33.3 ms and p95 was about 50 ms at each load. Renderer callback p95 was 19.3–19.9 ms. Stable 30 FPS and a real-device result still need verification.

The isolated Maren Vale database fixture uses a published World and Story NPC as the giver and a captured Story combat preset as the guardian. It exercises the seven-seed hand-over, a separate private realm trip, admission, loss recovery, and an exactly-once linked victory reward. The Living Atlas workflow includes authenticated desktop and mobile browser cases for dialogue, realm travel, battle admission and loss recovery.

For owed personal items, the isolated player flow frees an ordinary inventory stack through the confirmed Discard action before collecting the reward. In Master Events, Live Ops can show pending and delivered personal rewards for the selected run. Review both paths with a full inventory and a role restricted to NPC Design to verify the visibility boundary.

## Review checkpoints

The capture set uses the game renderer and existing terrain in isolated browser sessions. Frostmere shows a market, chapel, forge, storehouse and crossing at gameplay scale. The eight mainland center captures establish regional building and material styles. Several centers share the same arrangement of market, fountain, watchtower and bridge. The reviewed coast shows wet and shallow layers along an edge that remains straight in places. Willow Cascades has an animated closed pool, and its source, elevation and outlet remain open. The 19-sector route recording covers Verdant Expanse to Hollow Coast. Broader routes, biome seams and secondary settlements need their own captures.

The Event Builder and Live Ops fixture uses the production shell and styles with private in-memory responses. It passed at 1366 × 768, 390 × 844 and 200% zoom. Starter checks cover the rendered field palette, supported phase conditions and no automatic save. This fixture establishes layout and interaction behavior. Disposable authenticated browser runs cover account, database and World commands separately.

The shared appearance capture and measurement cover the manual rig, three painted presets and the qualifying catalog combinations at representative World and battle sizes. Account activation, battle pinning, NPC authoring, catalog construction and native device performance each have separate acceptance evidence in the matrix. Treat each verification result within its recorded environment and scope.
