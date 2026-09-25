# ART-WORLD-001 — Living Atlas

Status: generated implementation candidate. Owner approved the navy/parchment/gold world-map style, rich terrain, settlement walls, square movement grid, uncharted areas and View 360. Browser acceptance remains open; this is not a release approval.

Original generated artwork, OpenAI image generation, 2026-09-22. No third-party asset or code copied. Generation IDs, source hashes, dimensions, runtime hashes and encoding are in `apps/web/public/media/art/world/provenance.json`; source masters remain attached to the originating conversation. Runtime descriptors are registered in `src/media/world-art.ts`.

Design brief used for the generation requests (summarized, not a transcript):

- Local maps: richly detailed, easy-on-the-eyes painterly fantasy travel map, elevated near-top-down view, no UI, labels, characters or baked-in grid. 13:9 movement composition, walled village in left portion, gate/road toward a bridge near the middle-right, watchtower at the right edge. Muted natural colors, warm windows, hand-painted trees, roofs, rocks and river detail. Original Aurevane style, not another game's assets.
- Eight distinct biomes: golden Crown farmland/citadel; Verdant green forest; Ember volcanic basalt/lava; Frostmere snow/ice; Glasswind dunes/oasis; Hollow misty shore/tidal settlement; Starfall violet highlands/observatory; Umbral dark woods/watchfires. Authored collision data accompanies the paintings.
- Globe: equirectangular 2:1 painterly planetary atlas texture, diverse broad continental biomes and blue oceans, no names or UI. It is decorative charted geography, not an authoritative hidden-world data source. Uncharted display is blank silver-blue cartography. Actual undiscovered terrain, names and landmarks are server-only and never encoded into this public image.
- Panoramas: separate 2:1 equirectangular environments for each region, eye-level immersive surroundings with a horizontal horizon, full wrap composition, no UI/text/people. Match each corresponding settlement and biome; View 360 is an ambient regional view, not a simulation of every cell.

Sharp converts original PNG masters into WebP at quality 86, retaining original dimensions. No terrain code, private frontier art, game state or third-party source material is baked into public media.


## P5-W3 v02 alignment dependency — inspected 2026-09-25

**Open; no replacement media approved or delivered in this presentation slice.** The brief above records the delivered v01 composition. It must not be reused as the geometry specification for #681. Candidate inspected: `702eb44c2f93d8f17935363d86255f9142fce702` on `agent/phase5-distinct-region-layouts-20260923`. Its `REGION_LAYOUTS` in `apps/web/src/world/catalog.ts` is the exact authored 13×9 collision/safe-zone source; all eight runtime art references still point to v01. Refresh that head before producing assets.

Coordinates below are zero-based candidate tile coordinates, not new gameplay or canon. Every candidate retains the explicit row-4 east/west boundary road. Preserve the actual cell rows, protected footprints and service/landmark anchors in painting review; atmosphere alone does not establish alignment.

| Region | Candidate settlement anchor | Candidate watch anchor | Composition constraint from actual rows |
| --- | --- | --- | --- |
| Aureth Crown | Civic Quarter (3,2) | Road Ward (9,4) | Broad northwestern protected civic footprint; southern road spur; water at x=8 crossed by row 4. |
| Verdant Expanse | Forest Settlement (2,4) | Eastern Watchtower (12,4) | Existing western woodland footprint and southern exit spur; water at x=10 and row-4 bridge. |
| Emberreach | Basalt Citadel (1,2) | Forge Watch (8,4) | Narrow northwestern protected pocket; segmented rock barriers and shifting two-cell hazard channel. |
| Frostmere | Mountain Refuge (5,2) | Pass Watch (9,4) | Central protected refuge bounded by mountain cells; southern sheltered road spur. |
| Glasswind Desert | Oasis Enclave (3,3) | Caravan Watch (10,4) | Western protected oasis footprint with open eastern approach and separate rock clusters. |
| Hollow Coast | Harbor Quarter (2,6) | Tide Watch (7,4) | Southwestern protected harbor; eastern water begins at x=7/8, with the authored row-4 crossing kept clear. |
| Starfall Highlands | Observatory Terrace (5,2) | Highland Watch (8,4) | Northern terrace footprint; eastern/southeastern rock mass and southern bent path. |
| Umbral March | Frontier Outpost (2,5) | March Watch (10,4) | Small western protected outpost, narrow north–south clearing and solid southern boundary. |

Acceptance remains open for each region: matching original Aurevane v02 painting, authorized provenance/registry update, overlaid walkable/blocked/protected/landmark inspection, legible environmental masks at desktop/laptop/phone sizes, and geometry/art integration together. Do not paint extra apparent routes through blocked cells or move authoritative anchors to fit a picture. Panorama alignment must also be reviewed if its visible town composition contradicts the accepted local map. No reference-game media, new settlement lore or placeholder-as-complete claim is authorized by this checklist.
