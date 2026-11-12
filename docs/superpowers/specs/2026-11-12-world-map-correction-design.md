# World map correction — Owner mandate, November 12

Nick requests a separate corrective release after PR1038 and explicitly authorizes pushing it live for testing after implementation, review and quality/smoke checks. This release precedes the separate ferry/inherited-backlog update. Earlier visual releases are not acceptance of the defects shown in the six November12 screenshots.

## Required outcome

1. Remove square/diamond shadows beneath rocks and correct floating scenery throughout representative biomes.
2. Reproduce and fix map lag and visible missing ground during loading, movement, zoom and viewport changes. Measure the actual rendering/loading path; source checks alone cannot close performance.
3. Replace short rectangular water with longer natural rivers and rounded irregular lakes, ponds and basins. Nick explicitly requests generated detailed lake art. Distinguish transparent shallows, deeper water and ocean, with shore detail, reflections, currents, ripples and weather-driven effects.
4. Allow walking through town water using server-authoritative rules. Shallow walking creates restrained footstep ripples. Wilderness deep water remains governed by its actual traversal rules.
5. Reconfigure all eight major towns with materially different layouts, buildings and landmarks, rather than recoloring the same fountain/bridge/river. Features may span multiple tiles. Aureth Crown has grand surrounding walls; one town has a moat with bridge access. Generate varied architecture and needed assets.
6. Make elevations, dips and valleys visible through coherent contouring, gradients and grounded relief rather than square shadow plates.
7. Place occasional world-scale discoveries: grand bridges, ruined fortresses and abandoned towns. Sites need generous clear footprints, readable approaches and coherent regional materials. Scenic discovery does not invent rewards, quests or story canon.
8. Link vegetation, water, spray and other environmental motion to actual weather, with bounded work and reduced-motion behavior.
9. Correct Uncharted as a SUPERCONTINENT in its real geography, globe scale/silhouette and naming, replacing the small 'Uncharted Waters' fog patch. Preserve private discovery and the existing navigation/access contracts. Do not reveal private cells, coordinates, names or encounter identities through globe texture or payloads.
10. Generate two special remote discoveries: a monumental waterfall valley with original fire and ice stone avatars, and a grand colosseum. Both have genuinely large footprints and readable approaches. Preserve the abstract elemental-statue/waterfall intent without copying franchise characters or a distinctive existing composition.
11. Generate comparably detailed ocean assets and compose islets, reefs, shoals, sea stacks/arches and other occasional water features, richer sea depths and weather-driven surf. Keep broad sea readable; illustrative features do not grant new maritime traversal.
12. Rebuild the entire globe's visual presentation: remove blurry, blocky, pixelated patchwork; use smooth organic coastlines, rich crisp terrain/sea detail and accurate town locations/known geography. This applies to both WebGL and fallback rendering.

Owner refinement: the colosseum must be larger, including its eventual map footprint; both elemental avatars should look more imposing and legendary while retaining the fire-and-ice pairing.
The colosseum must emphasize a vast open arena floor where visible players can stand, with architectural depth and high surrounding tiers. Smooth upgraded surface graphics apply to the sea tiles themselves, rivers, lakes, waterfalls, lava/fire streams, lava pools and lavafalls, not just the decorative sprites.

## Engineering decisions

Extend the existing Canvas renderer, canonical terrain authoring and compressed sprite pipeline. No new rendering engine or dependency is warranted. Static shore/depth/relief belongs in ground caches; bounded live weather/footstep effects belong in motion passes. Use organic connected liquid contours shared across known cell/sector boundaries, not an unrelated decorative lake that contradicts collision. Generated bitmap details complement geometry; they do not determine authority.

Nick's town-layout and walkable-town-water requests explicitly supersede older no-topology-change restrictions. Preserve sector IDs, coordinate addresses, player progress, Owner drafts, publications and history. New obstacles require reachable gates and compatible saved positions/routes. Immutable teleport geometry must receive a new version rather than overwriting prior hashes. Existing ferry/legacy expeditions remain safe; the broader ferry redesign remains separately tracked.

## Acceptance

Use actual rendered scenes at ordinary/minimum zoom: all eight towns, snowy rocks, floating-asset examples, rounded lakes, extended rivers, coastal depths, major ruins/bridge, shallow footsteps, calm/rain/storm and reduced motion, mainland/Uncharted globe. Cover desktop/mobile and movement/loading. Record what was measured and what still needs human/physical-device acceptance. Final branch review, configured workflows, exact-source production deployment and postflight are mandatory. Do not describe this update as complete while any requirement above lacks implementation and evidence.

## Deferred but retained

All82 historical handover rows/all70 original requirement IDs, ferry-to-selected-Void integration, actual Void gameplay acceptance, appearance/shared NPC identity/five expressions, NPC presentation/privacy/AI, Events composition/campaigns/rewards/timing/dialogue/journal/LiveOps, accessibility and broader performance remain separate. This map release does not silently close them.

## Final art selection and quality refinements

Nick reuploaded image(20261112-175551).png and explicitly selected that ORIGINAL fire/ice pair after rejecting muscular/abs/icicle and feminine robed variants. Use `elemental-waterfall-valley-owner-selected-v01.png` unchanged as the selected source; superseded candidates are not release assets. The valley water must be animated, with flowing falls, moving spray, currents and basin ripples reacting to weather. Large land and ocean assets must retain HQ at gameplay zoom; native-scale visual inspection is required, not just enlarged thumbnails or mathematical upscaling. Some ocean discoveries may be genuinely large.
