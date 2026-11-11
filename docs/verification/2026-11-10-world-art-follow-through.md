# World art follow-through

The visual reference is the November 5 Unified Implementation Handover, sections 3 and 4 and acceptance scenarios 14H–I. The winter settlement and river/biome boards guide the existing isometric camera. The October map plan supplies habitat and motion detail. The Owner requested full-sized, distinguishable settlements, quieter shorelines and remote ground, varied private Void districts, habitat-specific wildlife outside towns, and no visible route line.

| Requirement | Implemented in PR #1036 | Remaining acceptance |
| --- | --- | --- |
| WRL-02, WRL-03 and WRL-15, art and settlement identity | Eight mainland centers use distinct focal props. The four named hamlet families use a hay shelter, grain mill, herb frame or skiff. Small fishing and market props support the existing town layouts. Dry, built-up road entrances have narrow stone thresholds. | Review each major town and smaller settlement at normal zoom. Check scale, occlusion, identity and approaches in motion. |
| WRL-04 through WRL-07, terrain and water | All eight mainland regions have painted material families, with mirrored edges and existing biome blends. Remote trails use earth instead of stone. Revealed water and public coast edges drive natural bank faces, reeds, gravel and shallow shelf depth. | Capture representative shorelines, biome seams, bridges and waterfalls. Proposed hydrology or topology changes require their own authority and traversal review. |
| WRL-08 and WRL-09, shared weather and motion | Existing tree, smoke, snow and water animation gains wind-responsive surf and plants, softer fog and storm light, and local town and Void glows. Reduced motion keeps the artwork static. | Capture the same areas in clear, windy, foggy and storm conditions, including Frostmere snowfall and snowstorm. Check weather readability and reduced motion at normal zoom. |
| WRL-10, ambient wildlife | No ambient spawns in town districts or on ferries. Mainland species are selected from shore, woodland and open snow habitats. Routes avoid roads and settlement buffers within the projected sector. Deer appear at dusk, hares at dawn, and fog or storms reduce visible animals. | Review density and borders at normal zoom, including cross-sector buffers, richer species sets and reactions. Keep interactive animals under their existing authority. |
| VOID-04, Void identity | All thirteen districts have fixed focal compositions supplied through the private scene projection on surveyed ground. Existing phase-based landmarks, refuges and observations remain in use. New relics include a broken orrery, fractured arches, mirrored slabs, a burned signpost, mineral reeds, floating stone and fungal ruins. | Review all districts and smaller settlements across representative pinned and rare phases. Capture the landing and ferry approach. |
| WRL-11, WRL-14 and PERF-01 | Ground materials use the existing raster cache. Small props use visible scene budgets, and their sheets load when the scene needs them. Each sector gets at most two new natural plant patches. | Verify environment authoring and native desktop and mobile rendering. Measure crowded movement and weather on a physical handset before claiming performance acceptance. |

The artwork is original AI-assisted game scenery inspired by the supplied composition boards. The alpha atlases are 2 × 2 grids of 256-pixel cells with contact near y240. The ground atlas is an opaque 4 × 2 grid of 256-pixel materials. The encoded set is 1,051,696 bytes. The scene loads its relevant sheets as needed.

| Runtime atlas | Slots in row order | Bytes |
| --- | --- | ---: |
| `settlement-dressing-v01.webp` | Winter fish rack, winter firewood, woodland produce stand, coastal fishing rig | 112304 |
| `town-centres-north-v01.webp` | Aureth fountain, Verdant apothecary, Frostmere watch shelter, Starfall armillary | 104558 |
| `town-centres-south-v01.webp` | Emberreach forge, Glasswind well, Hollow Coast beacon, Umbral shrine gate | 119590 |
| `hamlet-dressing-v01.webp` | Hayward hay shelter, Millers' Rest mill, Thistledown herb frame, Brookside skiff | 102852 |
| `void-dressing-v01.webp` | Flowering stone, fallen bell, suspended shards, split geode | 102986 |
| `void-relics-v01.webp` | Shattered orrery, split arch, obsidian mirrors, charred signpost | 105298 |
| `void-frontier-v01.webp` | Supply rig, mineral reeds, hovering spiral, fungal doorway | 110730 |
| `wild-verges-v01.webp` | Forest ferns, marsh reeds, alpine scrub, dune grasses | 112328 |
| `regional-ground-v01.webp` | Aureth meadow, Verdant moss, Frostmere snow, Starfall slate, Emberreach ash, Glasswind sand, Hollow Coast grass, Umbral forest earth | 181050 |

This renderer update uses the existing coordinates, protection flags and traversal rules. The earlier request for major-town Quick Travel and one replaceable or clearable custom pin is tracked as a separate travel change. Native visual acceptance remains open. Local Chromium exited before navigation because the workspace denied its process socket.

## Native follow-through

The completed runs for `b406726a322b2032f110b82f7d41296a23b31457` passed CI, Living Atlas and Responsive browser smoke. The reviewed Frostmere capture confirms that the deep shelf no longer covers neighboring shallows. Long straight shore edges remain visible and still need natural shaping review.

The eight-session test reports 2.9 ms p95 renderer work after arrival, but 150 ms p95 browser frame intervals. The rolling renderer counter still includes 250 ms p95 earlier work. Physical-handset performance remains open. The next run also records each session's elapsed, main-thread task, script, layout and style time across that sample to investigate the delay.

Native capture coverage now enumerates all 72 existing mainland hamlets by region and all thirteen private Void districts. Seven additional phase views cover the five rare observations and the Cinderfields and Relic Valley refuges. Phase zero already includes Lantern Refuge. The fixtures survey only disposable local characters and exercise the authenticated World page and its private scene projection. These captures require visual review after the browser run.

Verification for this follow-up covers TypeScript, targeted ESLint and formatting, Playwright discovery, the real hamlet and Void placement preflight, and adjacent dressing, projection and timing tests. Runtime game logic and migrations are outside this follow-up. The configured CI and browser workflows provide the native final verification.
