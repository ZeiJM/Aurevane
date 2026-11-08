# Stationary phone world rendering

This is a source-only improvement for the unified upgrade. It preserves the existing terrain and identity canvas sizes, map projection, draw cadence, actor counts, motion preferences, and server authority.

## Diagnosis and change

The post-biome-cache market still missed the phone target. A six-and-a-half-second Chromium trace at 100 visible fixture peers recorded 5.27 seconds of Canvas 2D resource production inside 6.44 seconds of renderer main-frame work. The JavaScript frame callback's p95 was only 21.1 ms. Suppressing just the projected ground draws in a diagnostic variant (an incomplete image, not the shipped change) improved browser frame interval p95 to 66.7 ms; suppressing only identity or liquid animation left it at 100.0 ms. This isolates repeated ground projection as the largest tested contributor after the JavaScript callback.

On a settled, zoomed-out high-DPI phone map, the renderer now keeps one viewport-sized projection of the longest consecutive run of sectors without a visible animated liquid or coastal pass. It blits that bitmap at its native backing size. Keeping the run consecutive preserves painter order around shore and liquid sectors. The original sector draws still run as the camera moves, the zoom changes, or the viewport cannot benefit. The cache is cleared on terrain reindex, backing size changes and terrain artwork loads. Its cap is one million RGBA pixels; the measured run used 753,430 pixels (about 2.9 MiB) and covered 31 of 32 sectors. The original material cache still used 2,383,268 pixels in both runs.

## Matched browser results

Chromium Headless Shell `151.0.7922.34`, 393 × 851 CSS pixels, DPR 2.75, 4× DevTools CPU slowdown, 35% zoom, Balanced quality and 6.5 seconds sampled per case. The loopback browser ran the production canvas renderer on a canonical Aureth Crown projection with isolated stationary peers. Both runs used the same source and fixture; the control disabled only the new projected ground layer. RAF intervals are measured separately from renderer callbacks and actual renderer draw intervals.

| Visible peers | Browser RAF p50, ms | Browser RAF p95, ms | Renderer draw interval p95, ms | Renderer callback p95, ms |
| ---: | ---: | ---: | ---: | ---: |
| 25 | 66.7 → 33.3 | 100.0 → 50.1 | 97.0 → 53.1 | 22.0 → 20.9 |
| 50 | 66.7 → 33.3 | 100.1 → 50.0 | 105.7 → 52.3 | 23.7 → 20.6 |
| 100 | 83.3 → 33.3 | 100.0 → 50.1 | 103.2 → 53.3 | 25.2 → 20.2 |

The matched market cases retained the 590 × 1,277 terrain backing, 1,081 × 2,340 identity backing, 9 animated water cells, 12 wildlife and every requested visible peer. Across the three captures with motion disabled, at most 0.75% of display pixels differed, with a maximum difference of 2/255 in any RGB channel. A separate instrumented 100-peer trace recorded a mean renderer main-frame task time of 40.7 ms versus 83.6 ms, with the additional trace overhead in both runs.

Mobile smoke at 1× CPU verified 13 coast edges with 25 visible peers on the original coast path, and four travelers including the viewer repeatedly settled legal movement commands in rainy Frostmere. The movement capture recorded 101 distinct rendered viewer coordinates and 9 animated water cells. The focused renderer regression shows a reused stationary bitmap with changing water strokes, an invalidated bitmap after late terrain art, and the original ground draw while the camera moves. The 58 World Vitest files (770 tests) passed.

The renderer still misses the stable 30 FPS phone target in this congested fixture. These are headless loopback observations, without an authenticated multiplayer transport, sustained handset thermals, or a production capacity claim.

## Reusing stationary scenery

The same zoomed-out, settled path reuses the scenery placements and rasterizes consecutive runs of compact sprites into bounded, cropped canvases. Wildlife, bridge underpasses and the ferry mast keep their original depth slots and rendering paths. Moving and zooming use the ordinary renderer. New terrain or art, a resize, or a new camera projection clears the cache. Retained batches use at most 800,000 RGBA pixels.

The control disabled only the scenery placement and batch cache. These runs used the same 393 × 851 CSS viewport, 2.75 DPR, 4× CPU slowdown, 35% zoom and Balanced setting, with 6.5 seconds sampled per case.

| Visible peers | Browser RAF p95, ms | Map draw interval p95, ms | Map callback p95, ms |
| ---: | ---: | ---: | ---: |
| 25 | 50.0 → 16.8 | 44.9 → 37.5 | 17.0 → 7.9 |
| 50 | 50.0 → 16.8 | 51.5 → 36.5 | 21.0 → 10.8 |
| 100 | 50.1 → 16.8 | 50.3 → 36.0 | 18.4 → 10.2 |

The renderer kept all visible peers, nine animated water cells and twelve wildlife in each run. In the fixed-motion captures, at most 0.43% of display pixels changed. Only 17 of 2,529,540 pixels per capture differed by more than 3/255 in any channel, with a maximum difference of 6/255. Median map draw interval reached 33.3 ms. The draw p95 and physical handset validation remain open.
