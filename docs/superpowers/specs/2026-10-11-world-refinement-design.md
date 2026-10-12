# World refinement — Owner-approved scope

Approved in the October 11 map conversation. Implement and release the whole verified result; no additional design approval is required. Preserve server authority, normal battle/training gates, permanent character state and private frontier discovery. The approved images are visual references, not executable terrain or a license to invent lore or services.

## Required result

- Match Aurevane's mature painterly environment art and refined gold/charcoal/teal interface.
- Smooth water, weather, biome vegetation and animal motion; eliminate flicker and animation-driven spikes. Suspend hidden/offscreen animation and respect reduced motion and effects controls.
- Immediate visual response to clicks/keys/actions; exact legal destination, latest-click replanning, no walk-back, silent drops or duplicate combat commands. Authority remains on the server.
- Large, uncluttered settlements across multiple sectors, wide streets/plazas, traversable foliage and substantial open countryside between major towns. Rivers/oceans/lava and buildings remain impassable; bridges remain legal crossings.
- Plan comfortable space for approximately 100 players across the world; verify bounded rendering/payloads and a synthetic population, without claiming a live 100-player load test.
- Unified local/globe sector geometry. Seamless local sector crossings with no visible tile/sector boundaries; globe has a sector grid and every ordinary land sector is reachable. Ocean is not a walking destination. Private uncharted content is never exposed early.
- Drag globe to rotate. Show only the current-position pin and details. Obscure later-game uncharted areas without hidden names/landmarks.
- Proposed occupied-land name Aurethia replaces Globe/Local Map buttons; clicking it opens the local map. Clicking the local location name opens the globe.
- Naturally integrated small POI labels such as Marketplace, Town Square, Watchtower and Bridge; no overlapping labels or new invented commerce mechanics.
- Nearby rows have Approach at a distance and Attack/Talk in its place at close range. Talk stays Coming soon until its existing authority supports it. No duplicate selected-character/action card.
- Refined right panel preserves all existing Missions, interactions, event navigation, archive, frontier, surroundings and objective authority.
- Fill the available page at 100% zoom. Only the right panel scrolls when necessary; responsive desktop/laptop/mobile layout.
- Consolidate obsolete renderers, static stage code and duplicate styling once callers and acceptance tests have migrated. Preserve useful #875 behavior, supersede its old-renderer patch after verification.

## Architecture

Keep persisted 13×9 sector-local positions and stable authored sector IDs. Add a 128×64 ordinary-world atlas at four times the former geographic resolution, with authored anchors at matching geographic positions, 3×3 town districts and connected countryside. Existing parked trail/wild/private positions remain resolvable; old incompatible routes fail closed. Ordinary charted realms expand without revealing the private survey table/content. No database schema change is needed.

The server owns deterministic terrain, crossings, route legality, discovery, safe zones and encounters. Project only the current/next-route neighbourhood's tile data, plus a compact charted-sector overview. Client code cannot manufacture authoritative destinations or reveal private cells.

Replace the monolithic iframe/SVG stage with native typed React presentation and a modular, bounded canvas scene. Cache static terrain/art chunks, animate a separate capped overlay, interpolate only confirmed legal routes or bounded local intent previews, and settle rejected intents back to authority. Reuse the existing WebGL spherical renderer with an authoritative atlas grid, opaque uncharted veil, drag input and a fallback. Existing panoramic surroundings can retain that shared renderer.

Generate original reusable runtime art rather than using UI screenshots as map backgrounds. Town layout and building footprints must match collision data. Labels and player tokens remain independent accessible UI data.

## Release

Owner explicitly authorized push live when everything is complete. Reconcile volatile main; preserve the separate urgent world-battle timeout repair. Run focused and repository-wide checks, browser movement/arrival/crossing/stop/attack/error/mission/globe/viewport tests, and performance measurements. Review the whole change once, fix meaningful findings, then publish and verify the exact live source. Close superseded Claude PRs only after their useful behavior is accounted for.

## October 12 Owner exploration refinement

Owner asks for whole countryside sectors between towns, sakura and other scenic zones, independently varied foliage motion, and the memorable town/route/landmark rhythm of a compact but substantial exploration world. Expand the ordinary atlas to 128×64 with fourfold authored spacing, broad connected land, nine full countryside sectors minimum between settlement footprints, and unchanged persisted authored IDs/local coordinates. Five multi-sector countryside destinations use original painted pink/white sakura, autumn maple, wisteria, waterfall/pool, standing stones, mushrooms and meadow flowers. These are real walkable destinations and scenery, without new reward/quest/NPC mechanics. Preserve private discovery and anchor private wilderness to the same geographic scale. Keep all existing renderer/payload/search budgets and recheck the enlarged atlas end to end before deployment.
