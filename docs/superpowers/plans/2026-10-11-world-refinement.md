# World Refinement Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Owner authorized continuous implementation and the final verified production release.

**Goal:** Deliver the entire approved map refinement with authoritative seamless geography, responsive interaction, mature art and bounded rendering.

**Architecture:** One deterministic atlas retains persisted sector-local identities. Native React controls submit existing server intents; cached canvas chunks and a shared spherical renderer consume server-safe projections.

**Tech Stack:** Existing Next.js/React/TypeScript, Canvas2D/WebGL, Supabase RPCs, Vitest and Playwright.

**Spec:** docs/superpowers/specs/2026-10-11-world-refinement-design.md

## Global Constraints

- Sector local coordinates remain 13×9; walking pace remains 200 ms. Server authority, expected versions, idempotency, discovery and battle/training exclusion remain intact.
- Atlas 128×64, towns 3×3 sectors, foliage traversable; deep water/lava/buildings blocked. Private survey content never enters client imports.
- No unrelated combat/skill overhaul. Preserve the separate world-battle timeout fix at release.
- No page scroll at 100% zoom; panel overflow only. Talk remains Coming soon.
- No speculative infrastructure or new dependencies. Production release is authorized only after verification.

## Review Focus

- A destination clicked while a tick/replan is pending must remain the latest destination and settle there without repeated speed gains.
- Crossing sectors must not move the camera backward, strand a saved character, grant unknown discovery or allow water traversal.
- 100 visible players and low-power/high-DPI/mobile devices must have bounded scenery/particle/canvas costs.
- Hidden/offscreen/reduced-motion/globe states must suspend unused animation and recover correctly on return.
- Mission/event/frontier/surroundings controls, keyboard/touch, WebGL fallback and stale encounter responses remain usable.

### Task 1: Authoritative atlas and traversable scale

**Files:** Add `apps/web/src/world/atlas.ts`, `atlas.test.ts`, `terrain.ts`; modify world types/travel and server world-content/world-service; test existing world suites.

**Interfaces:** `atlasSectors(): readonly WorldSector[]`, `atlasAddress(sector): {column:number;row:number}|null`, `terrainWalkable(terrain:string):boolean`; WorldView adds compact atlas descriptors while sectors carries nearby authoritative cells.

- [x] Write regressions for connected land sectors, cross-edge symmetry, town area/open ground, foliage/water/buildings, saved legacy positions, bounded projection and spoiler safety; run to observe failure.
- [x] Build deterministic atlas and 3×3 districts around stable authored anchors, safe collision/bridges/POI labels, bounded A* routes and adjacent-edge crossings; preserve legacy parked sectors and private discovery.
- [x] Project a bounded neighbourhood plus overview; verify existing mission/route/battle guards and all focused world tests; commit.

### Task 2: Responsive commands and smooth movement

**Files:** Add `apps/web/src/components/world/world-controller.ts`, controller tests and `scene-motion.ts` tests; modify world-workspace to use them.

**Interfaces:** Existing WorldIntent/WorldCommand; serial latest-intent controller with bounded stale refresh/retry and receipt identity; scene coordinates consume atlasAddress and 200 ms TravelSteps.

- [x] Write failing tests for immediate callbacks, queue replacement, tick priority, stop, stale versions, exact arrival and rejection rollback.
- [x] Implement controller and confirmed/bounded predicted motion without repeated first-step acceleration; preserve single authoritative mutation stream.
- [x] Verify controller, travel and adjacent service tests; commit.

### Task 3: Native unified map/globe presentation and runtime art

**Files:** Add native scene/renderer/art/ambient/panel components and `world-workspace.module.css`; reuse spherical renderer/view and surroundings; replace WorldWorkspace iframe; retire unused static stage/bridge files and CSS only after callers migrate.

**Interfaces:** WorldView neighbourhood + overview, controller sends existing intents. Renderer exposes state/input/resize/dispose, bounded caches and diagnostic counters. Globe uses atlas dimensions, current pin and existing projection math.

- [x] Add guards for click inversion, culling/cache/particle limits, globe selection/rotation and media lifecycle; observe failures.
- [x] Integrate painterly transparent structure/vegetation assets, distinct district layouts, open ground, calm water/biome/wildlife/weather animation and legible labels.
- [x] Implement approved panel, contextual row actions, location-name switching, missions/features, globe grid/current-position/uncharted and fallback.
- [x] Fit the shared shell at desktop/laptop/mobile 100% zoom; only panel scrolls. Update atlas browser acceptance; verify; commit.

### Task 4: Verification, integration and release

**Files:** Update `apps/web/e2e/atlas-world.pw.ts`, verification report and current task/Owner docs; no unrelated changes.

- [x] Run focused tests, typecheck/lint/format, all package tests and production build; resolve real failures.
- [x] Browser-test normal/rapid movement, crossings, stop/reload, attack/mission/panel/globe/keyboard/mobile and 100-player synthetic rendering; record actual frame/cache/payload evidence.
- [x] Refresh main, reconcile overlap and preserve urgent battle repair; run one independent whole-branch review and one meaningful fix pass with regressions.
- [x] Push reviewed branch/PR, pass exact-source CI, merge, deploy authorized result, verify exact live alias/source and authenticated gameplay; close superseded #875/#874 as appropriate.
- [x] Report completed scope, factual checks and material limitations; never claim human or live-load acceptance from synthetic tests.

## Release receipt

Completed through PR #877 and production `dpl_G18UAyBsowxFTy4ReZsA5RfojWv5`, merge `61eba80261b32139cabfad135d5c74aee9b65751`, READY `2026-10-12T06:15:55.196Z`. All nine exact-head workflows and bounded authenticated live smoke pass. Evidence and limitations: `docs/verification/2026-10-11-world-refinement-progress.md`. Human gameplay and live 100-player acceptance remain open; this does not close Phase 5.
