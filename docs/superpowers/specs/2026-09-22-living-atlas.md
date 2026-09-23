# Living Atlas — approved visual and gameplay contract

Owner authorized Phase 5 in parallel with Phase 4 and approved the latest globe/local-map concepts on 2026-09-22. Subsequent steering adds uncharted territory and an optional temporary View 360 experience. This ticket implements the Atlas/world-travel slice of 5A; it does not claim all Phase 5 story content is complete. Phase 4 human acceptance remains open.

## Presentation

- Match the approved navy, cream parchment, fine gold borders and richly painted environments. Reuse the existing character identity rail, without any location information, on the World Map page; retain it on Character, Arsenal, Battle Hall and Training.
- World Map gets its own compass button in the primary rail. Globe and Sector are the two map views. No Sector Overview panel.
- Globe: eight known canon regions, distinct terrain textures, drag rotation, zoom, search/region selection, My Position, grid/layers. Looking elsewhere never moves the character.
- Local: square 13 by 9 cells, northings on the left and eastings along the bottom. Portrait tokens sit exactly at cell centres. Walls surround settlements. The river, bridges, buildings and blocked terrain align with navigation data.
- Subtle flowing water, smoke, cloud shadows and foliage; pause decorative motion in reduced-motion mode and provide a motion control. Responsive panels must not squeeze square cells into rectangles.
- View 360 opens an accessible temporary panorama of the current location with drag/look controls and Close/Escape. Camera movement changes no game state; world polling and encounter redirection remain active.

## Geography and mystery

The known world is finite and authored; eight named regions are not the full extent of the globe. Aureth Crown, Verdant Expanse, Emberreach, Frostmere, Glasswind Desert, Hollow Coast, Starfall Highlands and Umbral March retain canon identities. Stable sector IDs and local coordinates identify traversable places. Authored regional roads connect local sectors with elapsed travel time, not instant teleportation. Initial local scenes are bounded authored content rather than an unbounded procedural generator.

Distinguish public charted geography, character survey knowledge, and the Unwritten Reach. The Reach is beyond reliable cartography, not a literal planetary edge. The globe fades to blank silver-blue cartography beyond surveyed geography; no hidden towns, route endpoints, players or coastlines appear under transparent fog. Canon region names remain visible without revealing undiscovered sites within them.

A deliberate frontier crossing is separate from ordinary walking. Auto-path stops at the last known approach and cannot solve hidden routes. Discovery is persistent and server-owned. Hidden terrain/landmarks/players and associated private art must be absent from unauthorized responses and client bundles. Stable Anchor history can survive future route changes; changing routes must invalidate travel safely. No late-story cosmology in public text or filenames.

## Authoritative play

- Client sends intent; authenticated server resolves character ownership, route, walkability, movement interval, discoveries and encounter eligibility.
- Persist location, version, route and next step time. Auto-path walks the same legal steps as manual travel. Reload cannot teleport, multiply speed or forget saved discovery. Stop cancels remaining movement. No catch-up burst through other players after a disconnected browser.
- Quest auto-path has a real Start/Stop button. A disabled event objective affects that objective only, not unrelated quests. Unknown/clue-only objectives do not expose exact destinations.
- Settlements are safe. Clearly marked wilderness permits proximity attacks without a challenge invitation. Server revalidates both positions and eligibility atomically with battle creation; routes stop and existing tactical PvP consumes committed build snapshots. No balance formula changes or custom combat engine.
- No fabricated online players. Empty encounter panels explain how players appear. Viewing another region does not reveal its players remotely.
- Travel and attack cannot bypass active battle/spectator/training restrictions, ownership checks, replay/version checks or existing private-table access controls.

## Verification and delivery

Tests cover routing, obstacles, cell centres, frontier boundaries, no hidden payloads, stale/concurrent movement, event auto-path policy and attack races. Verify the actual globe/sector/panorama at desktop and mobile sizes. Run repository quality gates. Use an independent branch; refresh main before finalizing. Prepare migrations and a reviewable draft PR. No remote migration, merge or deployment is authorized by implementation approval.
