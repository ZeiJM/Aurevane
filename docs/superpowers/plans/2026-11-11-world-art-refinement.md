# World art refinement Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for continuous implementation and a fresh whole-branch review.

**Goal:** Resolve the remaining demonstrated visual shortcomings while preserving world authority.
**Architecture:** Reuse cached Canvas terrain, scenery depth/identity masking, existing quality budgets and exact-head disposable native fixtures.
**Tech Stack:** TypeScript, Canvas2D, WebP, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-11-world-art-refinement-design.md

## Global Constraints

- Preserve geometry, traversal, coordinates, crossings, private reveal boundaries, live content and player data.
- No route line; no animals in towns; same existing quality and reduced-motion controls.
- No migration or hosted fixture. Automatic deployments stay disabled.
- Never label source tests/static captures as human or physical-handset acceptance.

## Review Focus

- Loaded/unloaded and diagonal boundaries: no invented shore, terrain leak or hidden/private data.
- Fog/pool/path cosmetics: every legal exit and narrow crossing remains readable.
- Composition: full-size functional anchors, no decorative object over water/road or hidden focal landmark.
- Seasonal sheets: cold-only loading, identical anchor/crop, decoded fallback and native readiness.
- Motion: reduced-motion freezes cosmetic state; fixture weather cannot change authoritative weather.

### Task 1: Natural banks and private fringes

**Files:** map-coast.ts/.test.ts, map-water.ts/.test.ts, map-warped-fog.ts/.test.ts.
**Interfaces:** Preserve all existing exports/call signatures. Cosmetic geometry remains within its existing known-cell namespace.

- [x] Add and observe failing regressions for irregular inland bank faces, broken public wet/dry bands, stable shared endpoints and varied private fog depth without concealing exits.
- [x] Implement bounded cached edge detail and retain deep-shelf fade, sixteen-edge/surf limits and unknown-neighbor handling.
- [x] Run adjacent coast/water/fog tests; inspect diff and commit.

### Task 2: Worn paths and coherent biome transition

**Files:** new map-trail.ts/.test.ts, map-biome-transitions.ts/.test.ts, map-renderer.ts.
**Interfaces:** paintNaturalTrail(ctx,cell,tile,terrain,colour,seed,winter) uses only supplied road neighbours. Biome transition widths remain symmetric for edges/corners.

- [x] Test dry-road connectivity in each direction/junction, shared ports, no painting on water, town paving unchanged.
- [x] Paint cached soft-edged earth ribbons instead of full-square countryside road fills. Widen dry biome gradients and vary texture/tree mix coherently without visible seams or new cells.
- [x] Run relevant renderer/biome/trail tests and commit.

### Task 3: Settlement identity and winter building art

**Files:** map-dressing.ts/.test.ts, new map-settlement-composition.ts/.test.ts, map-renderer.ts/.test.ts, tools/pack-hamlet-buildings.mjs, content/art-requests/ART-WORLD-WINTER-HAMLETS-20261111.md and new hamlet-buildings-winter-v01.webp.
**Interfaces:** ScenicDressing may carry optional size/role for existing depth queue; settlementComposition(sector) returns only legal known decorative placements with bounded regional composition.

- [x] Test distinct eight regional supporting compositions, deterministic hamlet yards and no placements in water/roads/buildings or unknown/private/ferry scenes.
- [x] Produce/inspect original snowy variants of all four hamlet buildings, pack to768x672/384x336cells/y313floor with recorded provenance.
- [x] Test cold-only sheet loading/rendering and old decoded fallback; add region-specific town/hamlet props and restrained seasonal smoke/light using existing scenery path.
- [x] Run dressing/composition/renderer tests, types/lint and commit.

### Task 4: Weather, motion and native acceptance evidence

**Files:** map-weather.ts/.test.ts, e2e/world-art-review-case.ts, atlas-world.pw.ts as required.
**Interfaces:** Preserve shared weather/quality/reduced-motion authority; extend disposable scene captures with explicit visual fixture overrides.

- [x] Add focused guards for bounded wind/rain/snow detail and stable reduced-motion; improve surface response and clear/windy regional life only where existing passes support it.
- [x] Add image-ready native cases for all8towns, weather comparisons, paths/banks/biome seams and moving player identity behind buildings/trees, preserving all existing assertions/thresholds.
- [x] Run focused/adjacent World tests, TypeScript/lint/format and discovery; independently review complete diff.
- [ ] Fresh-main reconciliation, exact tree publication to new draft, configured checks and artifact review; record remaining true acceptance gaps. Stop only for actual pending native checks or access limitations.

### Task 5: Follow native findings through material, foliage and corner shape

Nick explicitly asked to continue all work. Keep the existing Canvas renderer and authoritative supplied cells; no new hydrology/layout, art import or gameplay state.

- [x] Replace the constant dark public lip backfill with a dry-to-wet regional gradient across the existing sea-only apron; preserve authored endpoints, maximum apron, shelf fade and surf/edge budgets. Guard the changed lip material plus original geometry guards.
- [x] Add deterministic in-cell woodland growth poses with clustered size variation, bounded foot offsets and seed namespaces. Keep authored town/landmark-adjacent trees and private focal clearings anchored; do not change rocks, tree biome/species, cells or walkability. Verify determinism, growth variety, in-cell containment, anchor guards and renderer integration.
- [x] Feather exposed private cell corners with bounded curved corner wisps, only when both sides are unknown; retain current side fades, known-neighbor masks and clear exit centers. Test path bounds, missing-side rejection and exit-center preservation.
- [x] Publish d46a with exact-tree protection and review its complete authenticated native collection. Record the remaining straight-bank, geometric-Void and shared-layout limitations without claiming human/handset acceptance.
- [x] Reproduce the two supported edge-shape findings with five failing regressions, then add bounded wet-sediment tongues and blocked-cell-only curved fog pockets without changing geometry, exits or traversal. Complete World coverage passes507tests/35files.
- [ ] Run focused type/lint/format review, publish the follow-up only after the active d46a Browser smoke resolves, then require new exact-head configured checks and native ordinary-zoom evidence before accepting the visual result.
