# Aurevane Living World Implementation Plan

**Goal:** Give public coastlines, routes and settlements clearer material transitions and shared environmental motion at Aurevane’s existing MMORPG scale.

**Architecture:** Extend the active canvas renderer, its bounded terrain raster cache and the existing Map settings. Use only server-supplied terrain and weather for visual decisions. Keep location, path, costs, exits, placement, weather authority and realtime rules on their existing paths.

**Tech stack:** Next.js, TypeScript, Canvas 2D, Vitest and the local Supabase Playwright workflow.

**Spec:** Unified implementation handover sections 3, 4, 12, 13 and 14H–I. Applicable rows include WRL-01 through WRL-14 and PERF-01.

- [ ] Establish current map and renderer baseline on main, including the representative Frostmere shore, battle and travelling peers.
- [ ] Extend public coast rendering in `map-coast.ts` with regional dry/wet materials and irregular outlines. Keep inland colour work cached, keep offshore and surf details on the sea side, and check loaded, unloaded and unknown edges plus coastline corners. Integrate in `map-renderer.ts`.
- [ ] Derive a shared regional wind presentation in `map-weather.ts` and apply it to the existing tree, precipitation, cloud, petal and smoke passes. Verify direction agreement, weather transitions and immutable server weather.
- [ ] Provide persistent High, Balanced and Low quality choices through the existing World Map settings. Apply budgets to visible cosmetic passes only and preserve movement, camera, targets and hit testing. Keep operating-system reduced-motion and the existing animation switch.
- [ ] Record before/after snapshots and world topology checks, then test real local movement, viewport crossing, weather and crowded movement on desktop and mobile. Record measured counts and scope limits.
- [ ] Reconcile with current main, run affected world and application checks, and prepare review evidence with remaining hydrology, settlement art, environment editing and load gaps marked explicitly.

The atlas geometry, public terrain, crossing definitions, location data and server command paths are authority and receive no changes in this renderer stage. Native Playwright provides the player journey and performance gates when the disposable local environment is available.

## November 11 public coast follow-through

Native review found that the public shore still ends on a straight sector border: `coastPoint(edge, t, 0)` has no displacement, and the cached land raster clips at that border. Extend the existing cosmetic wet bank a maximum quarter-cell into public sea with a deterministic tapered contour, filling the apron in the sea pass before the rectangular land cache. Anchor both endpoints, keep inner sediment inland and retain the existing deep-shelf fade and surf budget. No terrain, interaction or traversal data changes.

- [x] Add a failing geometry regression for all four sides: a varied outward outline, fixed endpoints and along-edge coordinates, bounded sea-only apron and inland sediment.
- [x] Update `map-coast.ts` only for the contour and matching wet apron; verify adjacent coast/water/renderer tests, web TypeScript, scoped ESLint and formatting.
- [ ] Review the patch independently and verify fresh main/head before an expected-head draft update. Avoid cancelling an active full browser run; record a prepared commit if necessary.
- [ ] Require exact-head native shore captures for visual review; automated geometry is not visual acceptance. Retain the outstanding settlement, weather and physical-handset findings.

The existing art follow-through and Owner reference direction authorize this presentation correction. Runtime authority and database suites are excluded from this focused development loop because no world state, schema, path or command code changes; configured remote checks remain required. Nick authorized one production release of the completed #1036 pass on November 11; use the existing release procedure once ready.

## November 11 hamlet silhouettes

Replace the repeated red-roof marker with the four original full-building silhouettes specified in `content/art-requests/ART-WORLD-HAMLETS-20261111.md`. Reuse the existing family-to-index map for work props and buildings. Load one 204,422-byte alpha sheet only for recognized public hamlets, preserve the landmark anchor and existing scenery depth/identity occlusion, and retain fallback art until decoded. Private Void art and unknown names keep their own behavior. Native capture readiness must include the new sheet.

- [x] Observe four failing renderer cases for absent family-specific building art, then implement conditional loading, source cells, substantial scale and fallback.
- [x] Verify all four anchors, crops and fallback cases, negative unknown/private loading, all adjacent World tests, TypeScript/lint/format and real WebP alpha/dimensions.
- [ ] Review independently and collect exact-head native captures before claiming in-world scale/placement acceptance.
