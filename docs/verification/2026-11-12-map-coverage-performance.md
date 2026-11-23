# Map ground coverage and performance investigation — 2026-11-12

Status: a canonical public-ground loss boundary is corrected and regression tested. Native rendering/performance acceptance remains open. No production or remote mutation was performed by this task.

## Source and ownership

Investigation started from `2c3c73d1` (PR1038 merge), in the parent's isolated `agent/world-map-correction-20261112` workspace. The parent owns current-main refresh, integration, full quality/CI, deployment and postflight. Concurrent town/Uncharted/renderer changes are present; the measurements below identify which source variation they use and are not an exact final-release benchmark.

Changed boundaries: `world/movement-receipt.ts`, its test, `components/world/map-render-terrain.test.ts`, `server/world/world-content.ts`, `server/world/world-service.ts` and its test, plus localized native coverage instrumentation consumers under `e2e/`. No renderer, atlas, collision, travel, town authoring or private-continent generation was changed by this task.

## Authoritative data flow and reproduced defect

1. `world-content.ts` resolves canonical atlas/private terrain and visibility. Missing atlas addresses can be real ocean; client retention must never invent land or hidden cells.
2. `projectWorld` supplies at most25 navigation/presence sectors. Compact `scenery` separately supplies charted canonical ground intersecting supported minimum-zoom viewports and the next14 route positions, capped512. It deliberately excludes the25 scene IDs.
3. `mergeWorldMovement` accepts owned movement receipts and can supply a newly reached `currentSector` before a full scene read completes. Before correction, appending a new sector used `sectors.slice(0,24)`, silently discarding the25th supplied sector.
4. Because that displaced sector was excluded from the original compact scenery, `worldRenderTerrain` no longer received it in either partition. Its `retained` argument reuses unchanged supplied objects; it does not grant permission to keep withdrawn terrain. Thus a real whole-sector hole appears until scene hydration.
5. The Canvas renderer draws the supplied render terrain; the controller separately loads scenes with viewport information, paces covered public movement at750ms, and guards stale scenes. Those interfaces and privacy/explicit-withdrawal behavior remain intact.

The focused canonical Frostmere reproduction follows a real `resolveWorldIntent` route, advances its actual authored deadlines through `advanceWorldRoute`, and applies the real canonical `projectWorldSector` as a movement receipt. Against original `HEAD` movement merging it loses `atlas:64:15` (49 supplied public sectors become48); with the correction all49 remain, with exact canonical cells. The original file was temporarily substituted only for this falsification run and restored in a `finally` block; no branch or commit changed.

The uploaded snowy screenshot was visually inspected. It shows large angular blue cutouts, consistent in shape with missing sector ground. No exact coordinate or live browser reproduction was supplied, so this evidence proves an actual mechanism, not that every blue area in that screenshot is caused by this boundary. Real coastline/unknown ground remains legitimate.

## Correction and bounds

When a new current sector displaces an authority slot, only previously supplied, complete117-cell, charted terrain whose atlas metadata is also charted is demoted into the existing lossless public scenery format. It carries the existing terrain, landscape, buildings and landmarks, with no exits/presence authority. The incoming current sector is removed from duplicate compact presentation; scenery stays capped512. Navigation/presence remains capped25.

Partial/private terrain is never demoted. A later explicit `scenery: []` or authoritative scene replacement still withdraws presentation. This corrects partition loss rather than changing `worldRenderTerrain` to retain arbitrary withdrawn data.

## Adjacent integrations

- Added the lazy Uncharted resolver to `resolveSector`. On-continent visibility includes current, discovered and known approved-route candidates. Scene reads use the continent author's cheap5×5 address enumeration and next8 known route positions, avoiding eager construction of the full continent; off-continent private discoveries remain absent. A focused projection regression verifies only one discovered interior cell is supplied, no extra scenery appears, and the same saved discovery is absent on mainland.
- The town author's new canonical `w` shallow water now participates in `publicAtlasSurface.waterTiles`, alongside existing water/lava. The regression failed before the export recognized `w`, then passed. The payload contains exact public117-cell water footprints; private surfaces still omit them.
- Existing public-water and obsolete-building-route fixtures now select actual canonical wet districts and actual blocked building boundaries. Their authority/privacy assertions remain; the new town layout no longer matches the previous hardcoded fixtures.

## Local source measurements

Node24.22.1 / Vitest, default viewport1296×944, no players, `projectWorld(state,[],1000)`, lossless JSON/gzip (`node:zlib.gzipSync`), first expansion through `worldRenderTerrain`, then30 repeated samples. Timings measure source projection/expansion only: no Canvas ground construction, RAF, transport, database, image decode, physical device or live request timings.

| Source/case | Full JSON bytes | Full gzip bytes | Known-atlas JSON bytes | Known-atlas gzip bytes |
| --- | ---: | ---: | ---: | ---: |
| Canonical Frostmere during early concurrent implementation | 593004 | 34260 | 319534 | 15417 |
| Starter with original committed atlas substituted, current projection code | 599914 | 34418 | 325114 | 15431 |
| Starter with concurrent new town atlas | 615208 | 35464 | 337083 | 16030 |

The known-atlas receipt was produced by `worldAtlasReceipt` after its ordinary owner/token validation. Its compact response omits the atlas, not terrain authority or private checks.

| Local source timing | Frostmere cold / warm p50 / warm p95 | New-town starter cold / warm p50 / warm p95 |
| --- | ---: | ---: |
| Projection ms | 41.91 / 7.14 / 13.10 | 32.62 / 5.96 / 12.31 |
| Terrain expansion ms | 2.43 / 0.0042 / 0.0077 | 2.81 / 0.0027 / 0.0350 |
| Retained identical receipt expansion ms | — / 0.0072 / 0.0178 | — / 0.0039 / 0.0190 |

The starter payload increase is15294 bytes (+2.55%), consisting of11969 scene bytes and3325 atlas bytes; compact scenery remains2171 bytes. The old600000-byte assertion had only86 bytes of headroom. Full gzip increases1046 bytes and known-atlas gzip599 bytes. New public town water footprints and geometry account for actual feature growth; no roads, public water or privacy checks were removed to conceal it. Final payload budgets belong to the combined candidate review.

No speculative renderer/server optimization was made from these source measurements. Existing retained expansion is already small; source numbers do not establish that live map lag is resolved.

## Regression and verification evidence

RED:

- New movement receipt regression fails on original code: `public-24` disappears from terrain.
- Canonical Frostmere regression against original movement merge fails specifically on missing `atlas:64:15`.
- New Uncharted projection regression fails before resolver integration (`resolveSector` returns null).
- New public shallow-water projection expectation fails before `w` is exported (`waterTiles` undefined).

GREEN focused command:130 tests across9 files on the final task verification run:

```bash
pnpm --filter @aurevane/web exec vitest run \
  src/world/movement-receipt.test.ts \
  src/components/world/map-render-terrain.test.ts \
  src/components/world/world-controller.test.ts \
  src/components/world/world-scene-coverage.test.ts \
  src/components/world/world-scene-pacing.test.ts \
  src/server/world/world-service.test.ts \
  src/server/world/warped-continent.test.ts \
  src/server/world/uncharted-supercontinent.test.ts \
  e2e/world-ground-coverage.test.ts
```

The final receipt/terrain pair after original-code falsification passes7/7. Focused ESLint passes for the changed service/content/receipt/e2e files. Playwright discovery finds the new snowy native case in all three configured projects; laptop is intentionally skipped because desktop and phone cover the same boundary. This is discovery, not native execution.

At the recorded typecheck, no changed-file error remains. `tsc --noEmit` is blocked by missing checked-out `concept-ui/provenance.json` and `wayfarer/provenance.json` media assets, including the resulting implicit-any in the latter media test. The parent owns restoring final source/runtime assets and the full quality gate.

## Native coverage/performance gate still required

`world-presentation-case.ts` now contains a native desktop/phone snowy-ground case. It holds only GET scene reads while real authenticated movement leaves the initial25 authority scene toward the displaced sector. It samples completed browser paints through the opt-in renderer `paintedGroundIds` diagnostic, compares previously supplied complete public cell bodies to actual painted IDs each frame, requires the displaced sector body to be visible after crossing, and attaches actual render timing samples plus page API request cadence. It does not treat a sector's bounding box alone as proof its isometric ground body is visible. The ordinary renderer carries no extra ID dataset.

Local native Chromium launch failed before a page opened:

```text
FATAL:chrome/browser/process_singleton_posix.cc:297
socket() failed: Operation not permitted (1)
```

No workaround or sandbox bypass was attempted. Consequently cold/warm Canvas build, moving-frame cost, actual page request cadence, desktop/phone pixel appearance and the new native case remain unexecuted here. Run the configured native CI and inspect its attached timing/coverage artifacts on the final integrated source; source tests and this document cannot close performance or visual acceptance. The parent also retains ordinary/minimum zoom, resize, delayed loading, screenshot-matched scenes and physical-device/human acceptance in the combined release gate.

## Follow-up: canonical proof for giant public sites

The new giant valley/arena can exceed one loaded camera. `WorldView.publicGrandDiscoveries` now carries only IDs proved against full canonical public terrain, using the same `grandDiscoveryPlacements` validator as the renderer. The server first restricts projection to public site-overlap neighborhoods, constructs cells with actual canonical `isWalkable`/`isSafe`, checks terrain/buildings/landmarks and approaches, then freezes/caches the four successful IDs once per immutable server module. Private views omit the property; no private geometry, new interaction or reward is projected.

The controller's full scene merge explicitly accepts or withdraws this field. Compact movement preserves the current supplied proof. RED→GREEN tests cover all four actual public footprints, cache reference reuse, absence on private views, the same-version scene merge, retention through pending compact movement and explicit withdrawal. The renderer integration is owned by the parent: it must consume the supplied proof and invalidate placements when proof changes.

## Follow-up: bounded continental private routing

The expanded private worlds exposed a separate real routing regression: the existing atlas-only A* lower bound returned zero on private scene coordinates, producing a Dijkstra flood. Original `HEAD` on the expanded Fallen Firmament graph returns null after90000 queue pops/expansions, with90432 stored states and432 frontier entries. The existing focal-route assertion at `void-realms.test.ts` fails at the destination check. This is search-budget exhaustion, not the1500-step result cap or disconnected geography.

The correction extends the existing Manhattan A* estimate to private scene coordinates only when every reachable sector has those coordinates, every local cell step costs at least200ms and every known road moves exactly one cardinal cell for at least200ms. Every edge then costs at least its Manhattan-distance decrease, so the estimate is consistent and admissible. Wrapped public geometry keeps its original estimate; faster historical cells, portals and non-geographic graphs retain Dijkstra fallback. Known-ground filtering still removes disallowed destinations. Neither the90000 search cap nor the1500 route-step cap increased.

A temporary local measurement isolated route search from terrain construction:

| Fallen Firmament source | Unique expanded states | Heap pops | Stored states | Route result | Route-only ms |
| --- | ---: | ---: | ---: | --- | ---: |
| Original committed route finder | 90000 | 90000 | 90432 | null, cap exhausted | 957.20 |
| Scene-coordinate A* | 31831 | 49624 | 32394 | 473 legal steps,94600ms total duration | 377.97 |

Separate terrain construction took632.16ms /410.49ms in those local runs; it is excluded from the route-only columns. These are single Node/Vitest source runs, not browser/server latency promises. Temporary instrumentation and measurement files were removed and the selected original/fixed substitution was restored in `finally`.

The original focal-route test was observed RED against original routing and GREEN against the scene estimate. Additional shortest-duration guards confirm private50ms historical cells choose the300ms route, a non-adjacent historical private portal chooses400ms, and disallowing the portal's private ground selects the legal2400ms local route. Existing wrapped-atlas speed and roads are preserved.

The later `tsc --noEmit` run passes after the parent restored the missing provenance assets; the earlier blocked typecheck above is retained as historical evidence. Focused ESLint for these follow-up files also passes.

Final follow-up adjacent verification:226 tests across14 files pass (`travel`, `atlas`, town topology, discovery authority, world service, all eight Void realms, legacy/new Uncharted, controller, render-terrain, coverage/pacing, movement receipts and the native coverage helper). Command:

```bash
pnpm --filter @aurevane/web exec vitest run \
  src/world/travel.test.ts src/world/atlas.test.ts src/world/town-topology.test.ts \
  src/world/discovery-sites-authority.test.ts src/server/world/world-service.test.ts \
  src/server/world/void-realms.test.ts src/server/world/warped-continent.test.ts \
  src/server/world/uncharted-supercontinent.test.ts src/components/world/world-controller.test.ts \
  src/components/world/map-render-terrain.test.ts src/components/world/world-scene-coverage.test.ts \
  src/components/world/world-scene-pacing.test.ts src/world/movement-receipt.test.ts \
  e2e/world-ground-coverage.test.ts
```

No full repository quality gate or native execution is claimed by this scoped evidence. The parent retains those combined release gates.
