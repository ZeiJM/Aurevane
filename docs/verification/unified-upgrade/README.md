# Aurevane unified upgrade implementation and evidence

The November 5 unified handover is the controlling product specification. Its 70 requirement IDs are preserved in [requirements.csv](requirements.csv). UI-01 and UI-02 track Nick's two November 7 additions. Mark a row verified only when its stated acceptance evidence is attached. A source change, fixture screenshot, or passing unit test can support a partial row.

## Current source and review boundaries

- Starting main is `b219eb1464e19b265a57ff57e8bd7f2aa12ea245` (PR #1024). The Vercel connector reported production build `dpl_CBPxHC4kMSnbSmRYsGNfKFTTexJT` on source `3efadd14ff7bb17d9b4dc4beb1990e8e7040dad2` (PR #1023), so current main includes a subsequent release-receipt commit. There are no production edits in this work.
- [#765](https://github.com/ZeiJM/Aurevane/pull/765) is an older stacked Watch dialogue draft. Use current world projection and command interfaces. [#681](https://github.com/ZeiJM/Aurevane/pull/681) changes region geometry and remains a separate topology review. [#373](https://github.com/ZeiJM/Aurevane/pull/373) informs identity terminology only.
- `apps/web/vercel.json` disables automatic Git deployments for all branches. The repository requires explicit authorization for a preview or production deployment. This effort uses local checks and GitHub draft review. Merge and production deployment have separate owner approval gates.

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
| 5 | Add branches, catalog producers, campaign timing, conditional rewards, secrets and category-specific Live Ops. | Joe, Brown, Chicken Avenger, Sanalex, Arena-only and Mentor journeys with real outcomes, pause, claim and privacy checks. |
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

The later [stationary phone ground benchmark](stationary-phone-ground.md) reduced browser frame interval p95 to about 50 ms for 25, 50 and 100 fixture peers. This was an A/B run on the same emulated phone with a 4× CPU slowdown. Stable 30 FPS and a real-device result still need verification.

The isolated Farmer Joe database fixture uses a published World and Story NPC as the giver and a captured Story combat preset as the guardian. It exercises the seven-seed hand-over, a separate private realm trip, admission, loss recovery, and an exactly-once linked victory reward. The Living Atlas workflow includes authenticated desktop and mobile browser cases for dialogue, realm travel, battle admission and loss recovery.

For owed personal items, the isolated player flow frees an ordinary inventory stack through the confirmed Discard action before collecting the reward. In Master Events, Live Ops can show pending and delivered personal rewards for the selected run. Review both paths with a full inventory and a role restricted to NPC Design to verify the visibility boundary.
