# World Map Correction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver every November12 post-release map correction in one reviewed release live for Owner testing.

**Architecture:** Extend canonical terrain, private continent authoring and existing layered Canvas caches. Static organic water/relief and grounded multi-tile art compose with bounded weather and movement effects. Server traversal and immutable geometry versioning remain authoritative.

**Tech Stack:** TypeScript, Canvas2D, Next/React, Vitest, Playwright, Sharp asset packing, Supabase/Postgres.

**Spec:** `docs/superpowers/specs/2026-11-12-world-map-correction-design.md`

## Global Constraints

- Preserve sector IDs, coordinate addresses, progress, Owner drafts, publications and history.
- No private geography, coordinates or encounter identities in public payloads or textures.
- Town topology and walkable town water are explicitly authorized changes; server rules, routes and teleport must agree.
- Use the built-in image generator for new raster art; retain masters, prompts, hashes and optimized derivatives.
- Keep all82 inherited requirements and ferry work tracked separately.
- One verified production release is authorized after review and quality/smoke gates; keep automatic Git deployments disabled.

## Review Focus

- Delayed/partial movement hydration, resize and extreme zoom must not withdraw supplied legal public terrain.
- Previously saved positions and queued routes must remain safe after new walls/water/architecture.
- Partial private discovery must not reveal hidden geography through contour, sprite or globe composition.
- Multi-tile sprites must not cover players, entrances or unknown cells; source alpha and foot pivots must be inspected.
- Rain/storm and low-quality/mobile/reduced-motion settings must retain readable, bounded environmental effects.

### Task 1: Coverage and performance diagnosis

**Files:** `world-service.ts`, `world-controller.ts`, `map-render-terrain.ts`, `map-renderer.ts` and their existing tests/e2e in `apps/web/src/{server/world,components/world}`.
**Interfaces:** Retain `WorldView`, `worldRenderTerrain(view, retained)` and existing render timing instrumentation.
- [ ] Reproduce coverage loss against exact source and create a failing regression for the boundary where supplied ground is lost.
- [ ] Correct that boundary; measure cold/warm ground build and moving frames, payload sizes and request cadence.
- [ ] Run focused and adjacent tests plus native movement/zoom/resize evidence. Commit diagnosis and correction.

### Task 2: Organic water and depth

**Files:** `apps/web/src/components/world/map-water.ts`, renderer, coast, atlas/terrain authoring, focused tests; new water art request/packing.
**Interfaces:** Keep `indexWaterField`, `paintWaterGround`, `paintWaterMotion` as shared liquid authority-derived presentation boundaries.
- [ ] Add failing visual/geometry tests for connected smooth lake corners, cross-sector rivers, depth contrast and withheld neighbors.
- [ ] Generate detailed round/irregular lake/bank materials; implement coherent shore contours, longer varied watercourses and lakes/ponds/basins, depth/reflection detail.
- [ ] Verify native calm/rain/storm lake, river and ocean scenes. Commit with source/runtime provenance.

### Task 3: Relief and grounding

**Files:** `map-relief.ts`, `map-renderer.ts`, dressing/asset pivots and existing tests.
**Interfaces:** Static relief may only use supplied geometry; sprite floor pivots stay world-anchored.
- [ ] Add regression reproducing square rock plates and inspect source alpha/foot pivots.
- [ ] Replace isolated cell-face plates with coherent multi-cell relief, correct audited asset anchoring, make dips/ridges legible.
- [ ] Verify snowy/temperate/desert/Void normal-scale captures and cache cost. Commit.

### Task 4: Town architecture and traversal

**Files:** `world/atlas.ts`, `catalog.ts`, `terrain.ts`, `travel.ts`, world-service, teleport registry/service/migration; settlement composition and renderer; generated architecture sources/runtime.
**Interfaces:** Server `isWalkable`/canonical terrain, route validation and versioned teleport geometry must agree. Stable IDs and positions preserved.
- [ ] Add reachability/saved-position/route tests for all eight towns, gates, moat bridge and walkable town water, plus blocked wilderness/deep water negatives.
- [ ] Generate diverse buildings, Crown walls/gates and town center landmarks; author distinct multi-sector layouts/footprints with safe approaches.
- [ ] Implement authoritative shallow town traversal and immutable geometry successor; test migration compatibility before hosted changes.
- [ ] Capture all eight actual towns and shared route/teleport checks. Commit.

### Task 5: Grand world discoveries and living weather

**Files:** atlas/dressing/surface-art/renderer/vegetation/weather, new grand-scenery art sources/runtime, focused tests.
**Interfaces:** Supplied known footprint controls placement; weather uses shared `WorldEnvironment`; footstep effects consume confirmed/presented motion without changing authority.
- [ ] Add footprint/privacy/approach tests and weather/reduced-motion/low-budget footstep tests.
- [ ] Generate and place grand bridge, ruined fortress and abandoned-town compositions at authored regional sites, genuinely larger than ordinary props.
- [ ] Correct weather-linked vegetation/water/spray motion and implement bounded shallow footstep ripple rings.
- [ ] Verify actual discoveries, calm/storm and reduced-motion captures. Commit.

### Task 6: Uncharted supercontinent

**Files:** private continent/realm authoring, `world/void-realms.ts`, globe veil/renderer/fallback/component and tests; applicable lore/world docs.
**Interfaces:** Public globe uses only a deliberate spoiler-safe continental veil; private server geography remains independently authoritative.
- [ ] Add failing scale/connected-land/privacy tests and remove misleading waters labels.
- [ ] Correct real continental extent/connected geography and depict a grand fog-veiled supercontinent; preserve old expeditions and access/discovery.
- [ ] Verify public/private payload boundaries and globe in both renderers. Commit.

### Task 7: Combined verification and release

- [ ] Update all active docs/AGENTS/task ledger with final scope and honest evidence.
- [ ] Run `pnpm check`, all configured exact-head workflows and native desktop/mobile scenes covering every spec requirement. No tests weakened to conceal visual failures.
- [ ] Fresh whole-branch review; fix material findings with RED→GREEN regressions. Refresh/reconcile main before finalization.
- [ ] Merge verified exact tree, apply only required reviewed additive migrations under controlled preservation checks, create one exact-source production build and perform authenticated/public native postflight.
- [ ] Supply live link and honest open human/device checks; retain separate inherited/ferry backlog.

## Verification map

Development loops cover changed world rendering/travel/teleport/privacy files and adjacent existing suites. Unrelated combat/appearance/Event source is excluded from focused loops because this release does not alter those rules. Full final `pnpm check` and configured workflows still run. Browser visual evidence must address the reported screenshots, not only generated atlas previews. Hosted or physical limits are reported honestly.
