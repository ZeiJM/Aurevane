# Living world art and private expedition verification

The world painter remains on the original map and battle authority. The public atlas still has 1,870 charted sectors across eight regions, with a 128 × 64 address space and 13 × 9 local cells. The terrain, walkable cells, placements, crossings and paths on that atlas were unchanged by the snow-road and shoreline work. Cosmetic shallows outside the legal banks remain unselectable.

## Runtime art

These are original AI-assisted Aurevane sprites, exported as alpha WebP and packed into fixed source cells. They are painted by the existing world canvas, with their feet at the existing isometric placement anchors; these are not substitutes for the underlying roads, buildings, encounter tiles or map interaction rules.

| Asset | Source cell geometry | Bytes | SHA-256 |
| --- | --- | ---: | --- |
| `frostmere-v01.webp` | Four 384 × 336 cells; contact near y306 | 160,038 | `d767503bccad944c9862f92d2b335ede9cc3dc03bc93eb9c6c9a12be7eb815ae` |
| `regional-settlements-v01.webp` | 4 × 2 grid of 384 × 336 cells; seven occupied; contact near y313 | 283,372 | `74e53302275e5010b004a948172ebad6958590fa896792860317c5500eb3a77b` |
| `warped-landmarks-v01.webp` | Six 384 × 336 cells; contact near y313 | 214,310 | `aeb05e209c81df971829939a00ef1fe090d9011bd228b7d322ed4dfcd143d0e8` |
| `warped-refuges-v01.webp` | 3 × 2 grid of 384 × 336 cells; five occupied; contact near y313 | 232,718 | `df44db7c1494d41622140c5a294ca1582329e1b389e1f120096d736864ed3ba3` |

The regional sheet adds an Aureth guildhall, Verdant mill, Hollow Coast tavern, Emberreach forge, Glasswind caravanserai, Starfall observatory inn and Umbral lodge. Frostmere has its own chapel, forge, storehouse and covered market. A featured structure is placed at the existing main town building site, with scattered regional variations mixed into existing districts. Loading is conditional on those assets appearing in the loaded scene. The existing sprite is available while the new art loads.

The Void has thirteen connected, addressless districts with separate land and lakes and no mainland walking connection. Its six visual palettes cover a quiet haven, ash, fracture, expedition camps, amber, and a rare amethyst lake. Sparse refuges, abandoned buildings and rare landmarks appear on authored phase cadences. Occupied-looking shelters are environment art and carry no claim about playable resident NPCs. A field observation is recorded only when a player stops at a rare feature in the active expedition phase; ordinary globe data never contains these placements. Those discoveries can be read back in the character’s archive. The real-time settings interval applies at safe expedition boundaries; collision, exits and saved positions are stable across phases.

## Evidence boundaries

The handover references were used as a target for believable materials, shoreline layers, building variety and coherent motion. They are composition references; preserving the existing authored geography retains elements that cannot match the reference silhouettes one for one. Public world hills, river drainage and settlement block layout are not globally reauthored by this change.

Browser fixtures exercise production Chromium rendering and production `projectWorld` or Master GET code against controlled state. Mobile viewports and the forced software globe are emulated. They do not certify hosted device performance, hosted ferry concurrency, migrations in a production database, or the full authoring workflow. See the review evidence for exact revision, measurements and captures.
