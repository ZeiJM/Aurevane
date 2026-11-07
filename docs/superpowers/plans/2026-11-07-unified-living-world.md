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
