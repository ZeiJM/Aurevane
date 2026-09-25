# ART-WORLD-001 — Living Atlas

Status: generated implementation candidate. Owner approved the navy/parchment/gold world-map style, rich terrain, settlement walls, square movement grid, uncharted areas and View 360. Browser acceptance remains open; this is not a release approval.

Original generated artwork, OpenAI image generation, 2026-09-22. No third-party asset or code copied. Generation IDs, source hashes, dimensions, runtime hashes and encoding are in `apps/web/public/media/art/world/provenance.json`; source masters remain attached to the originating conversation. Runtime descriptors are registered in `src/media/world-art.ts`.

Design brief used for the generation requests (summarized, not a transcript):

- Local maps: richly detailed, easy-on-the-eyes painterly fantasy travel map, elevated near-top-down view, no UI, labels, characters or baked-in grid. 13:9 movement composition, walled village in left portion, gate/road toward a bridge near the middle-right, watchtower at the right edge. Muted natural colors, warm windows, hand-painted trees, roofs, rocks and river detail. Original Aurevane style, not another game's assets.
- Eight distinct biomes: golden Crown farmland/citadel; Verdant green forest; Ember volcanic basalt/lava; Frostmere snow/ice; Glasswind dunes/oasis; Hollow misty shore/tidal settlement; Starfall violet highlands/observatory; Umbral dark woods/watchfires. Authored collision data accompanies the paintings.
- Globe: equirectangular 2:1 painterly planetary atlas texture, diverse broad continental biomes and blue oceans, no names or UI. It is decorative charted geography, not an authoritative hidden-world data source. Uncharted display is blank silver-blue cartography. Actual undiscovered terrain, names and landmarks are server-only and never encoded into this public image.
- Panoramas: separate 2:1 equirectangular environments for each region, eye-level immersive surroundings with a horizontal horizon, full wrap composition, no UI/text/people. Match each corresponding settlement and biome; View 360 is an ambient regional view, not a simulation of every cell.

Sharp converts original PNG masters into WebP at quality 86, retaining original dimensions. No terrain code, private frontier art, game state or third-party source material is baked into public media.


## 2026-09-23 regional-layout redesign direction

Owner live feedback identified that the eight starting regional maps read as the same settlement composition with biome reskins. The original shared brief ("walled village left, bridge middle-right, watchtower right") is therefore **retired for major-region v02 maps**. New regional paintings must follow the distinct authored geometry in `apps/web/src/world/catalog.ts` and should be compositionally recognizable even in grayscale.

Required major-region archetypes:

- **Aureth Crown — planned civic/agricultural center:** broad plaza and ordered streets opening into farms/estates; river infrastructure supports trade rather than acting as the map's dominant obstacle.
- **Verdant Expanse — dispersed woodland settlement:** grovehold-like clusters, natural clearings, streams and living forest paths; intentionally less centralized than a fortified town.
- **Emberreach — terraced volcanic citadel:** basalt terraces, forge/industrial yards, hardened causeways and hazard-adapted vertical structure; do not reuse Crown's plaza/bridge silhouette.
- **Frostmere — compact alpine refuge:** inward-facing clustered shelter around warmth/water, steep mountain constraints and short protected lanes rather than a sprawling road town.
- **Glasswind Desert — oasis/caravan settlement:** radial life around water/cisterns, caravan enclosures and exposed ruins with long open sightlines.
- **Hollow Coast — harbor/cliff settlement:** shoreline-first composition with docks, seawalls, coves/tidal space and buildings stretched along the coast instead of a central inland town.
- **Starfall Highlands — terrace/observatory settlement:** stepped plateaus, switchbacks, observatory/watch structures and ceremonially spaced highland architecture.
- **Umbral March — fortified frontier outpost:** segmented stockades/watchfires and defensive perimeter logic; sparse and wary rather than another comfortable regional town.

Permanent composition rules for v02 major-region maps:

1. Do not reuse a common town silhouette, bridge placement, settlement footprint or landmark triangle across regions.
2. Settlement position, safe-zone footprint, road grammar and major terrain obstacle must visually agree with the authored `REGION_LAYOUTS` data.
3. Every region still needs clear walkable square centers and readable routes at 13:9, but route readability must not force identical geography.
4. Major labels on the globe identify regions/civilizations, not the only eventual explorable land. Art must leave room for surrounding wilderness-sector expansion.
5. Preserve the approved painterly Aurevane atlas style and biome identities while making composition—not palette alone—the primary differentiator.
