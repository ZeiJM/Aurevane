# Isola Held Movement and Rendering Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Remove reproduced held-input timing gaps and unnecessary terrain rebuilds while preserving immediate legal attack dispatch and continuous approved peer motion.

**Architecture:** Keep one server-owned route ahead of held input through a small buffer of supplied legal tiles, rather than repeatedly exhausting a one-tile plan. Release shortens travel to the current visual landing, so taps and release do not walk the buffered tail. Separate cached terrain content from its raster density so camera-only density changes can reuse the already painted legal surface.

**Tech Stack:** Existing TypeScript/React World controller, Canvas renderer, Vitest and native Playwright; existing service-only World RPCs.

**Spec:** Owner October14,08:36/08:55 movement/Attack/peer follow-up; `docs/verification/2026-10-14-world-click-continuity-places-surrender.md` records the live predecessor and failed overall movement acceptance.

## Global Constraints

- Preserve server authority, private supplied terrain, collision/road rules, attack range and blocking.
- Keep200ms minimum tiles and600ms unconfirmed preview. Do not increase prediction bounds to hide latency.
- No migration without explicit approval; none is planned. Preserve #903 Places/surrender and all current-main work.
- Attack retains immediate feedback and priority over refresh/queued walking; no scene/portrait prerequisite.
- Peers use approved route clocks; no invented movement, skipped known steps or privacy widening.
- Preserve original art, ambient animation, native identity clarity,8million cached pixel bound and high image-smoothing quality.
- Run full exact-head CI, Atlas and complete responsive browser gates before the authorized live release. Do not claim human acceptance.

## Review Focus

- Key release, focus loss and hidden/unmounted canvas must stop the stream without walking the buffered tail.
- Water, unknown terrain, different step costs and longitude boundaries must remain legal and private.
- Late timers/receipts and queued direction changes must preserve current visual progress and authored speed.
- Raster reuse must never retain newly withheld terrain or stale water/biome/bridge geometry.
- Attack during an in-flight command and peers receiving sparse/delayed updates must retain immediate dispatch priority and monotonic approved motion.

## Task1: Continuous held route

**Files:** `apps/web/src/components/world/map-renderer.ts`, `world-motion.ts`, their existing tests; server travel/service tests; existing native World input/presence cases.

**Interfaces:** Add `WorldMotion.nextLanding(now: number): WorldPosition` to return the supplied unfinished visual landing or current standing tile. Renderer keeps the existing selection callback and sends targets at most three consecutive supplied legal tiles ahead; no new server intent/schema.

- [x] Add renderer regression: key remains held, next timer is delivered at260ms after a200ms step; samples at208/224/240/256 remain moving with advancing points. Observe failure on the one-tile implementation.
- [x] Add release/tap regressions: buffer is shortened to the unfinished landing, no subsequent key timers submit; cover keyup/blur/hidden/dispose, blocked movement, direction change, slow terrain and longitude seam.
- [x] Implement legal three-tile held lookahead and release shortening through existing walk intent; keep600ms preview enforcement in WorldMotion.
- [x] Add real server-route regression using250ms replacement reads: buffered routes retain1200/1400/1600/1800 anchored landings; retain existing anti-acceleration and stale/blocked authority tests.
- [x] Run focused renderer/motion/controller/travel/service tests and record actual results.

## Task2: Camera-only cache transition

**Files:** `apps/web/src/components/world/map-renderer.ts`, `map-renderer.test.ts`, native World presentation/performance cases.

**Interfaces:** Cache entries distinguish immutable content key (private cells/material/water/bridge/biome/tile size) from raster scale. Equal-content scale changes resample the existing ground and liquid surfaces with high smoothing instead of rerunning their procedural painting; actual content/zoom changes rebuild normally.

- [x] Reproduce camera movement across a dense supplied sector scene causing raster scale changes. Measure repeated cached shore/biome painting, not merely successful arrival. Require unchanged cached content not to be regenerated on a camera-only density change; observe failure before implementation.
- [x] Implement cheap resampling only after equal-content verification; preserve logical surface coordinates and exact replacement pixel accounting/eviction bound.
- [x] Verify changed/withheld cells and water/biome/bridge joins still invalidate; repeat zoom/resize and high-DPI identity cases with no image source/quality reduction.
- [x] Add native forest movement diagnostics for frame gaps and cache rebuilding, with original ambient art retained.

## Task3: Combined action/peer verification and release

**Files:** existing World controller/player-motion tests and native World presence/input cases; verification receipt and ledgers.

- [x] Exercise Attack while walking and while scene hydration is held; retain immediate dispatch, canonical range/protection and two-account encounter confirmation.
- [x] Exercise approved peer routes under delayed reads/updates and boundary crossings; require interpolated intermediate steps without opposite-direction corrections.
- [x] Run full local quality and independent review; fresh-main reconciliation before publication.
- [x] Wait for all triggered exact-head workflows, inspect native frame/visual evidence, merge only the verified source and manually deploy the exact merge.
- [ ] Verify canonical READY/source, bounded signed-in movement and retained baseline/resources/preferences, then record Owner acceptance as open until tested.

## Owner-added rendering coverage (October14,09:28 Trinidad)

The supplied screenshot and actual scenic projection establish missing public terrain at35% zoom:25 authority/presence sectors cannot cover40 sampled desktop sectors. Add compact canonical public-only scenery rows as a separate presentation buffer (at most165 extras), without expanding the25-sector presence registration or private discovery. Render exact cells/materials/landmarks/buildings from those rows; roads/peer eligibility remain exclusively in the authority scene. Preserve presentation references across unchanged hydration. Test all four desktop/screenshot/portrait/landscape viewports and0/800/1200/2600ms approved camera progress with hydration held.

Ruling: retain the lowest already-painted terrain density during camera-only visibility changes, rebuilding normally on zoom/resize/content/art changes. Repeated down/up resampling degrades quality and causes unnecessary allocations; native identity density remains unchanged.

Review fix: disposal shortens held movement synchronously before teardown when the parent remains live, then cancels all timers. Root teardown follows existing controller-disposal semantics; no browser-close network guarantee is implied. The dispose regression fails three-tile arrival on old code and passes the one-step landing after the fix.

## Owner-added distant travel (October14,09:49 Trinidad)

Actual authority reproduction: Aureth region atlas:47:33(6,4) to Verdant town(6,4), with one previously discovered Surveycell110. Both endpoints are known/walkable, but unrelated directed-incoming-only compatibility terrain disables geographic A* and exhausts90,000 pops. Filter heuristic eligibility to the directed road component reachable from the actual start. Preserve historical/fast/portal fallback,200ms ordinary pace,90,000/1,500 search/route bounds and256-step saved windows. Add far-region and exact equivalent Aureth/Verdant regressions, actual Survey1100ms return guard, and native globe approval/continuation/Stop flow with disposable account discovery fixture.

Review fix: unchanged expanded terrain unions retain their indexed identity across main-scene reordering, JSON snapshots and authority/scenery partition changes; actual field changes and withdrawal invalidate. Lossless compact public terrain tuples reuse canonical public atlas metadata and use run encoding only when smaller. Tight viewport/2.8-second approved forward coverage preserves the existing600k baseline snapshot budget; no quality or prediction limit is relaxed.

Review fix: automatic scene pacing also requires actual viewport coverage at the current visual point and four approved forward points. Reversing direction in the same supplied sector reproduces a missing public wedge despite legal route cells; the uncovered-viewport regression now bypasses pacing. Explicit/arrival/private/crossing reads remain immediate. Both-moving native peer evidence compensates for each observer camera and restores disposable placements before existing privacy checks.

## Confirmed moving-observer peer-clock continuation

The second native run proves late reappearance and advanced-canonical-origin jumps through already supplied approved legs. Preserve standing/shared-edge phase, play an agreeing remaining approved prefix at original authored costs, and finish a completed endpoint continuously. Keep absence immediately hidden, with only100 sampled approved poses for750ms eligible after fresh authorization and geometry/version validation. Preserve old reverse/mid-route Stop policy and12-leg bound. Nine deterministic regressions and independent review precede full local and fresh native verification; no success/live claim is made until those gates pass.

Release checkpoint: all exact-head gates pass and PR #906 is live at merge36fbe14cdd44e2f4562e5cc4235e3cd484cbdb89 / deploymentdpl_9ihjPb7X6Qb88wcczLYQKXkVGAR1. Canonical READY/source and public entry/error checks pass. The final signed-in live checklist stays open because cloud-browser read/recovery attempts timed out; native and live receipts are distinguished in `docs/verification/2026-10-14-world-held-render-routing.md`. Human acceptance remains open.
