# World art follow-through

The controlling visual reference is the November 5 Unified Implementation Handover, sections 3 and 4 and acceptance scenarios 14H–I. Use its winter settlement and river/biome composition boards for the existing isometric camera. The October map plan supplies habitat and motion detail where it agrees with the November handover. The latest Owner directions call for full-sized, distinguishable settlements, readable town entrances, natural shorelines and remote ground, varied private Void districts, habitat-specific wildlife outside towns, and no visible route line.

| Requirement | This change | Remaining acceptance |
| --- | --- | --- |
| WRL-02 and WRL-03, world art and life | Built-up town road entrances have a narrow regional stone threshold on dry ground. Shorelines, remote edges and expedition landings retain natural ground. Frostmere, Verdant and Hollow Coast have different locally placed work and market props. | Review every major town and smaller settlement at normal zoom. Give each a distinct center, working structures, paths, vegetation, lighting and activity. |
| WRL-04 through WRL-07, terrain and water | The existing coast and terrain systems remain the basis for presentation. | Author and capture layered banks, varied shoreline and inland detail, believable connected rivers and waterfalls, stepped depth, biome seams and purposeful roads across multiple regions. Verify any proposed topology changes separately. |
| WRL-08 and WRL-09, shared weather and motion | Frostmere snowstorms use wind-driven streaks within the existing snow budget. Up to six visible Void props emit subtle weather-sensitive motes on the existing animation settings. | Capture the same areas in different weather and lighting. Expand movement across cloth, vegetation, shoreline water, fire and other assets. Check visibility and reduced motion. |
| WRL-10, ambient wildlife | No ambient spawns in town districts or on ferries. Mainland species are selected from shore, woodland and open snow habitats, and the whole local route stays in that habitat. Paths avoid roads and settlement buffers within the projected sector. Deer appear at dusk, hares at dawn, and fog or storms reduce visible animals. | Review density and borders at normal zoom, including cross-sector buffers, richer species sets and reactions. Keep interactive animals under their existing authority. |
| Void identity | The private scene picks flowering ruins, burned bells, suspended shards or geodes from the expedition's current visual theme. Dressing requires a revealed feature and keeps quiet areas open. | Review all 13 districts and the smaller settlements through representative pinned phases. Add more distinct silhouettes, strange assets and movement while preserving the ferry, landing, discoveries and existing layouts. |
| WRL-11, WRL-14 and PERF-01 | Props reuse the scene cache, load only where used and run within the existing drawing budgets. | Verify environment authoring and native desktop and mobile rendering. Measure crowded movement and weather on a physical handset before claiming performance acceptance. |

The two original AI-assisted alpha WebP atlases are each a 2 × 2 grid of 256-pixel cells with contact near y240. They are new runtime sprites inspired by the supplied composition boards. No reference painting is used as a map texture.

| Runtime atlas | Slots in row order | Bytes |
| --- | --- | ---: |
| `settlement-dressing-v01.webp` | Winter fish rack, winter firewood, woodland produce stand, coastal fishing rig | 112304 |
| `void-dressing-v01.webp` | Flowering stone, fallen bell, suspended shards, split geode | 102986 |

This is a renderer change on the existing coordinates, protection flags and traversal rules. The earlier request for major-town Quick Travel and one replaceable or clearable custom pin is tracked as a separate travel change. Native visual acceptance remains open. The local Chromium process exited before navigation because the workspace denied its process socket.
