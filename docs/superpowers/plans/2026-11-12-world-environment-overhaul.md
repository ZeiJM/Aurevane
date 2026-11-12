# World environment overhaul Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for continuous implementation and a fresh whole-branch review.

**Goal:** Transform the normal playing view toward Nick's winter-village/river-valley references, with quieter wilderness, built-up settlements, living vegetation, visible water depth and reliable terrain loading.
**Architecture:** Existing authoritative server scenes and Canvas renderer. New original compressed materials/trees replace broad visible surfaces; static detail is cached. Existing depth/identity, weather and reduced-motion paths stay authoritative.
**Tech Stack:** TypeScript, Canvas2D, WebP/Sharp, Vitest, Playwright.
**Spec:** docs/superpowers/specs/2026-11-12-world-environment-overhaul-design.md

## Global constraints

Preserve player data, coordinates, topology, collision, crossings, private reveal, Runebladev6, Owner drafts, no route line and biome-only wildlife outside settlements. No migrations or hosted fixtures. Git automatic deployments remain disabled. The prior release is complete; no replay.

## Review focus

- Missing/private neighbors cannot become invented land, new travel authority or inferred secret shores.
- Pavement stays on dry built-up ground; gardens, water, access routes and existing interaction anchors remain readable.
- New tree crops cannot overlap neighboring source cells or hide private focal landmarks/player identity.
- Water depth is cosmetic and must join at public sector wraps, crossings and narrow channels without a tile-checker pattern.
- Motion must stop under ambient-off/reduced-motion, anchor roots and retain bounded quality budgets.

### Task1: Original broad material and living-tree replacement

Files: art request/source/runtime atlases, tools/pack-world-environment.mjs, map-renderer.ts/.test.ts, e2e/world-art-review-case.ts.
Interface: new regional-ground-v02 retains4x2 source layout; living-trees-v01 uses4x2 cells with measured normalized crops/root anchors. Ordinary region indexes match regionalGround. Existing specialised sakura/autumn/wisteria trees retain their art.

- [ ] Record generation prompts and source masters, inspect crop/alpha and deterministically pack compressed versioned runtime files.
- [ ] Add renderer regressions requiring new ground/living Ember foliage and decoded old-art fallback; observe missing behavior before wiring assets.
- [ ] Load/use new sheets, preserving static cache and anchor/occlusion behavior; add readiness to native captures.
- [ ] Verify renderer/vegetation/image checks, types/lint/format and record actual evidence.

### Task2: Quieter wilderness and settlement paving

Files: map-settlement-edge.ts/.test.ts, map-trail.ts/.test.ts, map-renderer.ts/.test.ts.
Interface: buildSettlementGround returns an additional pavedCells Map<string,Set<string>> selected exclusively from supplied dry built-up cells. Natural-trail paint retains existing ports, with lower visual footprint away from built-up access.

- [ ] Reproduce missing plaza/hamlet paving and overly broad remote trails with focused tests. Include gardens, liquid, rocks, bridge and shoreline exclusions.
- [ ] Paint built-up paving using coherent regional stone and quiet thin worn trails elsewhere; do not change terrain/route data.
- [ ] Run settlement/trail/renderer authority guards and types/lint.

### Task3: Richer water depths and vegetation motion

Files: map-water.ts/.test.ts, map-renderer.ts/.test.ts, map-vegetation.ts/.test.ts, original water source/runtime atlas.
Interfaces: WaterCell carries optional depth derived from supplied water/dry neighbors only. Cache depth-colour/texture transitions in paintWaterGround; existing moving ripples/reflections remain in overlay. Existing scenery sway path continues to operate on new trees with roots fixed.

- [ ] Add shallow-to-deep, shared-sector/wrap, unknown/private, no-water-geometry-change and ambient/reduced-motion regressions; observe failures.
- [ ] Integrate new2x2 water-material source using world-continuous sampling and gentle depth blends. Preserve current lava and bridge-underwater compositing.
- [ ] Verify water/coast/ferry/render/motion suites and native depth/weather cases; do not call stills continuous-motion acceptance.

### Task4: Blue-gap root cause and supported repair

Files: world-scene-coverage.ts/.test.ts, world-controller.ts/.test.ts, world-workspace.tsx, server/world-service.ts/.test.ts only where evidence requires.
Interfaces: keep worldSceneCoversViewport and server-only presentation projection. No client-generated private geometry, wider PvP presence or changed movement timing.

- [ ] Reproduce missing ground across moving viewport, delayed scene delivery, zoom/resize, rejected/stale receipts and private transitions; distinguish real ocean from missing charted ground.
- [ ] Repair demonstrated fetching/retention/coverage defect with failing-to-passing regression, or add bounded native diagnostics when root cause is not yet supported. No speculative cache-budget or smoothing change.
- [ ] Verify focused scene/controller/motion/projection authority tests and authenticated native delayed-delivery traversal. Record latency/coverage separately from crowd frame timing.

### Task5: Void integration, review and exact-tree publication

Files: original Void material/scenery where necessary, map-renderer, atlas-world.pw.ts, verification doc.

- [ ] Apply coherent richer material/water/foliage treatment across13Void districts while retaining individually authored landmarks, rare phases, readable exits and hidden-ground privacy.
- [ ] Review eight mainland towns,72hamlets and20Void/rare/refuge views at normal zoom, plus representative wet/deep water, remote trails, plazas and continuous motion.
- [ ] Fresh-main reconcile, full applicable local/configured gates, independent whole-branch review, exact-tree Git publication to a NEW draft PR. Never update merged1037 or restart its watcher.
- [ ] Record unresolved actual human/handset/reference/performance limits. Deployment requires applicable authorization for this new release.

## Verification map

During editing: affected pure helpers and renderer, adjacent World/controller/scene/projection/motion/server suites; TypeScript and scoped zero-warning ESLint/format/diff. Unchanged combat/catalogue/database suites excluded from short development loops because no rules/schema/content changes; full configured CI, Living Atlas and Browser smoke still required on final candidate. Broad final source needs pnpm check. Discovery is not native execution. No unchanged broad reruns without new evidence or a changed tree.
