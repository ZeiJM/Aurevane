# ART-WORLD-001 — Living Atlas

Status: generated implementation candidate. Owner approved the navy/parchment/gold world-map style, rich terrain, settlement walls, square movement grid, uncharted areas and View 360. Browser acceptance remains open; this is not a release approval.

Original generated artwork, OpenAI image generation, 2026-09-22. No third-party asset or code copied. Generation IDs, source hashes, dimensions, runtime hashes and encoding are in `apps/web/public/media/art/world/provenance.json`; source masters remain attached to the originating conversation. Runtime descriptors are registered in `src/media/world-art.ts`.

Design brief used for the generation requests (summarized, not a transcript):

- Local maps: richly detailed, easy-on-the-eyes painterly fantasy travel map, elevated near-top-down view, no UI, labels, characters or baked-in grid. 13:9 movement composition, walled village in left portion, gate/road toward a bridge near the middle-right, watchtower at the right edge. Muted natural colors, warm windows, hand-painted trees, roofs, rocks and river detail. Original Aurevane style, not another game's assets.
- Eight distinct biomes: golden Crown farmland/citadel; Verdant green forest; Ember volcanic basalt/lava; Frostmere snow/ice; Glasswind dunes/oasis; Hollow misty shore/tidal settlement; Starfall violet highlands/observatory; Umbral dark woods/watchfires. Authored collision data accompanies the paintings.
- Globe: equirectangular 2:1 painterly planetary atlas texture, diverse broad continental biomes and blue oceans, no names or UI. It is decorative charted geography, not an authoritative hidden-world data source. Uncharted display is blank silver-blue cartography. Actual undiscovered terrain, names and landmarks are server-only and never encoded into this public image.
- Panoramas: separate 2:1 equirectangular environments for each region, eye-level immersive surroundings with a horizontal horizon, full wrap composition, no UI/text/people. Match each corresponding settlement and biome; View 360 is an ambient regional view, not a simulation of every cell.

Sharp converts original PNG masters into WebP at quality 86, retaining original dimensions. No terrain code, private frontier art, game state or third-party source material is baked into public media.
