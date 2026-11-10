# Frostmere–Starfall snowline

The public World canvas already feathers ground materials across known biome boundaries. The Frostmere–Starfall countryside now also shares its existing snow pines and bare highland trees. The chance of using the other biome’s tree tapers from the boundary across three tiles. Those trees are smaller and keep their original ground contact. Selection uses the saved sector ID and tile coordinates and takes place when the existing biome field is indexed.

Only supplied tree tiles along paired dry spans are eligible. The renderer leaves towns and authored landscapes in their existing art families. Missing or private neighbors, wet spans, paths, rocks and other biome pairs do not receive this treatment. The atlas, positions, road definitions, costs, visibility and movement authority are unchanged.

The renderer regression pins the original tree anchors on both sides of `atlas:56:14` and `atlas:56:15`. The biome field tests cover the inland taper, repeatability with a reconstructed scene, and the excluded boundary cases. The World compatibility test checks the complete atlas authority fingerprint and representative route costs against the saved baseline.

Loopback Chromium Headless Shell 151.0.7922.34 ran the real World renderer on the canonical local projection in clear midday conditions. The visual control disabled only the vegetation exchange. The two 1280 × 720 desktop views on either side of the crossing were pixel-identical after reload. The 393 × 780 phone view at DPR 2.75 and 72% zoom was unchanged on reload except for differences in the rightmost three backing pixels in both the control and the changed render. On desktop, clicking the same walkable ground selected `atlas:56:15 (6, 0)` in both variants. This click measures renderer selection in the loopback fixture.

This is partial evidence for WRL-07. Other biome pairings, seasonal terrain state and regional sound remain outside this slice.
