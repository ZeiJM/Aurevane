# World surfaces and crossings Implementation Plan

> Execute inline under the existing authorization, with one fresh whole-branch review before publication. Do not ask for a new choice already delegated by Nick.

**Goal:** Add distinctive built-up flooring and stronger topographic/liquid/crossing presentation to the current world update.
**Architecture:** Existing known-terrain ground cache and depth-ordered scenery, original packed materials/sprites, shared wind and liquid budgets.
**Tech Stack:** TypeScript, Canvas2D, Sharp, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-12-world-surfaces-crossings-design.md

## Global constraints and review focus

Preserve coordinates/topology/collision, legal supplied crossings/banks, private reveal, identity, Owner data/history/Runeblade and no route line. No migration/content change or preview deployment. Shared tile/sector/wrap boundaries must match; unloaded sprites retain fallbacks; motion-off stays fixed; large assets must not hide actors or invent surface authority. No unchanged broad-suite reruns; retain all configured gates.

### Task1: Distinct settlement floors

Files: map-regional-art.ts, map-renderer.ts and renderer tests; world-art-readiness.ts; generated settlement-floors-v01 source/runtime, packer and provenance.
Interface: settlementFloorIndex(WorldSectorView):number|undefined selects8town indices0..7 and known4hamlet family indices8..11, excludes private/ferry; source uses4columns×3rows and world-continuous4tile sampling.

- [ ] RED: assert eight town/four hamlet floor identities, real decoded floor painting, fallback, dry paving/winter guards.
- [ ] Pack/verify opaque twelve-panel source and integrate only on eligible existing paving; invalidate ground cache after decode.
- [ ] GREEN: floor/renderer/settlement/snow tests, types/scoped lint/format; native readiness includes actual sheet.

### Task2: Broad relief and natural liquids

Files: map-relief.ts/.test.ts, map-water.ts/.test.ts, map-renderer.ts/.test.ts.
Interfaces: cached terrain-contour painter consumes known natural cells only; liquid-field builder supports water or lava without mutating source; lava ground/motion uses same curved profiles and fixed budgets.

- [ ] RED: pin broad shared-edge/wrap continuity, private/road exclusion and warm-cache behavior; multi-cell bank meander, unchanged collision and curved clipped lava flow.
- [ ] Implement continuous gentle world-anchored crest/basin shading in static cache; retain clipped rock ledges. Replace per-cell-period bank wiggle with multi-cell meander; add profiled crust/curved hot seams.
- [ ] GREEN: complete affected relief/water/renderer/authority/cache/weather suites and types/lint.

### Task3: Impressive and modest crossings/falls

Files: map-renderer.ts/.test.ts, map-water motion, native art readiness/review, original grand-bridges-v01 and waterfalls-v01 sources/runtime/packer/provenance.
Interface: proven placement gains optional grand source index; decoded grand source uses measured normalized feet and original small-bridge fallback; water/lava underpass remains clipped to proven supplied strips. Waterfall tiers retain standardized falling-water/splash coordinates and supplied receiving water.

- [ ] RED: assert both grand/main and modest/rural choices, decoded fallback, measured roots/span/underpass clipping and actor identity; no-water/no-crossing exclusions.
- [ ] Pack/inspect3grand bridges and3waterfalls; integrate selected sources without widening gameplay geometry or motion budgets.
- [ ] GREEN: source/crop/alpha, bridge/waterfall/occlusion/renderer tests and native discovery; fresh whole-branch review and exact-tree successor publication after current checks finish.

### Release

- [ ] Record actual source verification and unresolved visual findings. Require successor CI/Atlas/Browser and normal-zoom native review; fix supported failures, never retry-to-green.
- [ ] Fresh-main reconcile, expected-head merge and one authorized production deployment, then canonical health/source/runtime verification. Keep hourly action enabled until completion.
