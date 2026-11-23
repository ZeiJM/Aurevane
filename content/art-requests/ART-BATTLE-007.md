# ART-BATTLE-007 — Battle production scenery and terrain materials

Owner authorized new battle backgrounds, terrain assets and the updated key for the 2026-09-30 correction. The accepted battle concept is a direction reference; it is not used as a runtime image or cropped into any asset. These original source candidates were generated with the OpenAI built-in image_gen tool on 2026-09-30. Integrated Owner review and production release remain with the parent correction work item.

Direction: mature detailed anime dark fantasy, believable weathered masonry, ruins and restrained cyan engraving, warm perimeter lighting and cool dusk shadows. Each background is a separate clean reusable environment with no characters, game grid, text, HUD or controls. Each terrain material is a separate square orthographic overhead surface with no game UI or painted selection outlines.

- `citadel-dusk-v01`: ruined citadel terrace, navy banners and ivy, amber braziers, cyan engraved perimeter stones, distant spires and arched bridge under a gold dusk sky. A broad clear central floor supports the separately rendered board.
- `enchanted-arena-v01`: overgrown ruined woodland colonnade at blue-violet dusk, perimeter runestones and amber lanterns, a broad quiet stone arena floor and distant forest mist.
- `terrain-open-stone-v01`: broad irregular limestone pavement, fine weathering and small moss flecks; existing ordinary open ground only.
- `terrain-rough-moss-v01`: angular broken stones, loose rubble and patchy olive moss; existing traversable rough/difficult ground only.
- `terrain-raised-stone-v01`: broad heavy dressed masonry floor courses; existing raised/elevated ground only. The renderer supplies its elevation number and edge cue. This does not depict or imply an impassable pillar.

The accepted concept's decorative Water/Cover/Blocked labels do not introduce terrain rules. These assets preserve current gameplay ground types and elevation; temporary Frozen/Steam overlays remain separate existing state presentation.

Full exact prompts: `content/media-candidates/battle-task7/generation-prompts.json`. High-resolution PNG source masters: `content/media-candidates/battle-task7/art/masters/`. Source/runtime SHA-256 hashes, dimensions, actual sizes, provider and transformation records: `content/media-candidates/battle-task7/provenance.json`.

Runtime: `apps/web/public/media/art/battle/`. Backgrounds are full-source 1672×941 WebP; terrain materials are deterministic 384×384 Lanczos derivatives. All use WebP quality 86, method 6, without painting, compositing, altered content or screenshot reuse. Stable descriptors are in `apps/web/src/media/battle-art.ts`, registered by the existing shared media registry. Descriptor approval denotes suitability for this authorized review integration; it does not claim final Owner visual acceptance or deployment.

Inspection: all five full-resolution sources were visually reviewed. Both scenic backgrounds have coherent perimeter architecture and no baked interface or actors. Terrain surfaces retain distinguishable broad smooth/rough/heavy masonry shapes, with no new hazard or water type. Decode and source/runtime integrity checks follow generation. In-context desktop/mobile and mode-parity review belongs to the integrated battle presentation correction.
