# World environment graphics overhaul

Nick explicitly requested generation, fixes and implementation on November 12 after clarifying that the previous art pass had not transformed the environment to the supplied reference quality. This new task starts from released main16883ffd. PR1037 and its watcher remain completed.

## Visual target and scope

Use the two supplied references as the overall direction: a textured snowy lakeside village with warm inhabited buildings, and a lush river valley with layered foliage, clear water and believable banks. They are reference direction, not source textures to copy. This pass must visibly change the game environment at normal playing zoom, not merely add peripheral decals. Preserve the original painterly identity across all eight mainland regions and all thirteen Void districts.

- Wilderness: substantially quieter, narrower, intermittent worn paths; retain readable approaches, bridges and authored navigation authority. No new route line.
- Settlements: coherent regional paving across built-up yards/plazas and streets, soft transition to grass outside the built-up area; preserve gardens, water, building footprints and full settlement size.
- Terrain and vegetation: original high quality ground and living regional tree assets. Embervale/Emberreach keeps its volcanic identity through warm mineral ground, copper foliage, hardy plants and restrained ash; dead trees must not dominate ordinary inhabited/wilderness scenery. Winter remains cold but richly textured. Other regions keep distinct material and vegetation identities.
- Water: richer depth, clear shallows, reflected light and restrained coherent ripples in the existing water compositor; preserve all legal banks, crossings and collision masks.
- Motion: bounded wind-driven vegetation, water and existing weather-responsive particles, with anchored roots and stable reduced-motion/ambient-off presentation.
- Void: original district-specific combinations of existing focal landmarks, richer ground/foliage/material/water treatment and readable exits; no new private data or invented explored ground. Do not call the prior 20-view collection full visual acceptance of this new pass.
- Loading: trace visible blue gaps from scene projection/fetch through client retention and raster caches; reproduce and fix supported causes. Measure loaded-ground continuity separately from crowd frame scheduling. Never paint invented land to hide missing private data.

## Implementation choices

Retain the existing Canvas renderer, projection and server-owned geography. Generate original versioned compressed atlases and integrate through existing loading, ground caching and depth-ordered scenery. Reuse current identity/occlusion/motion budgets. Favor a shared small set of high quality material families with deterministic variation over per-sector full images and download bloat. Static material goes in cached ground; animation never rebuilds all ground per frame.

Alternatives: another decal-only pass would not satisfy Nick's explicit correction. Replacing the renderer/world geometry would incur unrelated gameplay and migration risk. The chosen approach replaces major visible materials and vegetation inside the existing authority/rendering system.

## Preservation and evidence

No migrations, live content republishing, player-data edits, coordinate/topology changes, Runeblade changes, wildlife in towns or biome-rule changes. Automatic Git deployments stay disabled. Implementation approval is explicit; a further deployment is not silently inferred from prior consumed releases.

Record generated masters, prompts, alpha/crop contracts, hashes and compression. Verify actual native normal-zoom comparisons for eight towns,72hamlets,13Void districts/rare phases, weather, walking/occlusion and delayed scene delivery. Source tests and generated sheets are not a claim of human reference fidelity, physical-handset acceptance or a completed blue-gap/performance fix.


## November 12 continuation — expanded living-world direction

Nick restated that the snowy lakeside village and lush river-valley references apply to the entire world: richer, more vibrant and more interesting to inhabit. He additionally requests yellow/spectral-white Void ground and purple/orange/strange water, more regional scenic assets and points of interest, simulated cliffs/inclines/declines/valleys, shifting water depths and detailed banks, occasional crashing waves among gentle surf, and small weather-responsive environmental animations. He explicitly authorizes this expanded update's production release after all quality/smoke gates pass, with hourly checks that resume implementation through completion. This supersedes the implementation-only release boundary above for PR1038; the earlier1037 release remains consumed/completed.

Implementation call: reuse existing supplied-terrain, cached ground and bounded scenery/wind/water systems. Give each Void material family a strong consistent ground/water palette, carried through depths, banks, bridges and reflections. Add original eight-cell regional scenic art: woodland arch, winter lantern cairn, basalt vent, desert windstone, tidal rock, highland terrace, willow shrine and Void crescent. Deterministic local placement uses complete known dry footprints, clear of roads, buildings, authored sites and private boundaries. These scenic points do not invent quests/rewards or interactions. Cache layered relief at existing known rock/dry boundaries to suggest upper ledges and lower valleys without changing traversal/coordinates. Surf moves shoreward, with a slow seeded occasional breaker envelope enhanced by wind; retain existing per-frame crest/edge limits and stationary reduced-motion/ambient-off presentation.

Generated masters alone do not satisfy this scope. Require packed alpha/crop/hash validation, normal-zoom native scene review, rooted weather motion and continuous loading observations before claiming the references achieved. Remaining broad geography/layout limitations must remain visible. No speculative performance claims.


November12 living-world continuation: Owner requests twelve ordinary regional scenic pieces (50% above the original eight), plus four rare celestial/time-warped ruins, weighted toward Void; larger pieces span about three tiles. Yellow/spectral-white Void ground and purple/orange water join richer ground/water/foliage, simulated cliff/valley relief, detailed banks and occasional weather-driven surf. The two reference scenes remain the whole-world graphics target. Production release is explicitly authorized after quality/native smoke gates, with hourly action through verified live completion. No new reward mechanics, topology/collision, private reveal or data/content mutation. Current implementation/evidence: docs/verification/2026-11-12-world-environment-overhaul.md.
