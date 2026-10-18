# World viewport rendering and public-ground traversal — October 18

Status: candidate verification in progress; this document does not certify production or human movement acceptance.

## Reproduced causes and changes

- Pointer picking searched only the navigation/peer sectors even when additional charted public ground was visibly rendered. A visible walkable target outside those sectors produced no walk intent. Picking now uses the rendered public terrain for pointer destinations; keyboard routing retains navigation terrain and the server still approves all walks. Private/withdrawn scenery remains excluded.
- Five separately rendered scenery image sheets invalidated all ground layers when they finished loading. One recorded late load rebuilt thirteen ground layers. Only the terrain sheet now invalidates the ground cache; every image still requests a draw.
- Public scenery used fixed 1296×944 dimensions and a fixed sector neighborhood, leaving gaps on larger/taller stages. Authenticated full scene reads now accept bounded viewport dimensions (maximum 3840×2160), and projection supplies intersecting charted public scenery at minimum zoom, bounded to 512 scenery sectors. The authoritative navigation/peer scene remains at most 25 sectors.
- Mount, resize and zoom check minimum-zoom coverage. A viewport change during an existing scene request is coalesced and rechecked after that request completes, using the latest dimensions. Already supplied coverage and disposal do not trigger a replay. Scene reads remain independent of the authority command queue.

No migration, artwork, movement duration, private discovery rule, collision rule or 600 ms unconfirmed prediction bound changes.

## Regression evidence

Observed failing tests before their fixes: visible public cell ignored; late scenery image recreated ground caches; large viewport uncovered; viewport GET dimensions not forwarded; viewport refresh incorrectly selected compact presence; resize during a pending scene request dropped the second extent.

Focused regression suites cover canonical scenery pointer intent and withdrawn scenery, each image load, desktop/4K/tall-phone projection coverage, authenticated query clamping, compact-presence compatibility, coalesced pending resize and disposal. The controller suite passes 29 tests after the resize repair, including restoring a previously covered larger viewport while a smaller read is active. Independent review found the resize race; no other Important/Critical issue was reported.

Native browser coverage adds an actual 2560×1440 resize, bounded full-scene response, 35% zoom and click on rendered walkable ground beyond the peer snapshot, followed by a server-approved route receipt. Existing delayed-scene browser intercepts include viewport query strings. Local Chromium installation failed because its download was truncated; this native case must run in CI.

## Whole-candidate local gate

Frozen `pnpm check` exits 0: formatting, lint, generated routes/types, 9,212 Vitest tests, seven Node checks and production builds. Independent follow-up confirms the resize finding closed and reruns all 29 controller tests successfully. No production release is claimed by these local checks.

## First native run

Exact source `6932f2d6c11b840939935890028bd1a3565ecaa4` passes CI quality and database checks (run 39151345737). Living Atlas run 39151345715 passes all 50 pre-existing cases; the new large-viewport case passes its coverage, pointer click and server route-approval assertions, then fails its cleanup because it looks for a removed Stop travel button. Cleanup now uses the supported focused-map Escape command and asserts its successful stop receipt and empty route. No movement assertion or timeout is relaxed.

The full failed-run artifact 12145867058 is downloaded and SHA256 verified as `d836e21b76482eeed06df531162f581b75b7b1b13e85d9c606912d3ca4eed924`; the large-viewport approval capture is inspected. Compact artifact 12145682813 verifies as `fd68af3280021f816a0ead8150c9196052d40a638a812541d6644bc672e000ad`. The synthetic high-DPI/lower-CPU phone case records 15 ms sampled frame p95 after warming (70 ms initial baseline), 101 peers and 103 scenery sectors; these are native synthetic samples, not hosted or human performance acceptance.

## Remaining release gates

- Exact-head CI, Living Atlas and complete Browser smoke.
- Merge the verified source and explicitly deploy its merged SHA to the existing production project; confirm READY, canonical alias and public entry health.
- Signed-in hosted movement/resize and physical phone/human acceptance remain separate from native test results. No zero-lag, 60 FPS, multiplayer-load or full-overhaul completion claim is made.
