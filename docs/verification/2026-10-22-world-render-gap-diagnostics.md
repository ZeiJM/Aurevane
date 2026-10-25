# World rendering gaps — diagnostic candidate, October 22

This candidate does **not** claim to fix movement or pass the native repeat. It adds opt-in numeric evidence for the remaining strict jumps. Native CI/repeat and independent combined review remain required. No authority, movement clock, timer, route policy, threshold, retry, cleanup, dependency, migration or deployment change is included.

Base: `9760567127b26d21a423f557c681a36a681e0fc1`, tree `ddb0e10417caa60212a0697963662a643018358c`; origin/main remained `a31029c04c0ef7be9fd08092c6a70f6f086b48b6` at preflight. This base includes reviewed World observation-clock work and the separate reviewed Master/Next release work.

## Evidence and unresolved mechanism

PR960's strict20×2 native run39531298207 had36passes/4failures. WASD passed20/20; presence16/20. All20boundary captures are complete and all20cleanup records show exactly2retired fixtures and no errors. Artifact12315508752 is228890bytes, SHA256 `d3f910ee05a89c2be6a3ac2a245c02092a1e6021176e48e122c83480ee08c8ba`.

There are five hard jumps across the four failed cases; repeat12's second observer appears in the boundary artifact even though its standalone assertion was never reached.

| Repeat / observer | Delta (tiles) | Actual draw gap (ms) | RAF-clock gap (ms) | Previous paint-to-label cost (ms) |
| --- | ---: | ---: | ---: | ---: |
| 6 / peer | 1.495630 | 231.9 | 300.0 | 89.9 |
| 9 / owner | 0.961479 | 82.1 | 233.3 | 75.0 |
| 12 / owner | 1.175475 | 83.5 | 233.3 | 96.5 |
| 12 / peer | 1.172789 | 185.7 | 266.7 | 71.9 |
| 18 / peer | 1.082817 | 160.4 | 233.3 | 47.4 |

Source tracing finds that `loop(now)` and `draw(now)` sample owner/peer interpolation using the RAF timestamp, then execute terrain/scenery/atmosphere work before painting identities. Approved peer updates use `performance.now()`. Four bad transitions follow almost stationary samples; one is mid-route. A delayed RAF timestamp can precede a newly installed track, while expensive painting can make an already sampled position old before it reaches the display. Existing aggregate diagnostics cannot separate that from terrain rebuilding, indexing on receipts, other main-thread work, or browser rendering contention.

Replacing timestamps or adding a frame-distance cap is not justified by this evidence. In particular, repeat6 has an actual231.9ms gap, already longer than a200ms authored step. A changed timestamp alone cannot establish strict continuity. No smoothing policy or product fix has been guessed.

## Narrow diagnostic behavior

Only explicit `canvas.dataset.renderDiagnostics = 'timing'` enables collection. Normal rendering retains just its existing start/end frame-duration clock reads and emits no new profile. Enabled frames publish one numeric record after complete identity painting. Enabled updates accumulate bounded numeric counters until the next drawn frame; there is no producer history array.

The native E2E installs the flag immediately before the existing both-moving sampler setup, before either checked walk. A wrapper forwards `fillText` unchanged and queues at most one microtask per drawn identity frame. After the RAF callback finishes, it copies only finite allowlisted numbers into a separate buffer capped at1500frames. It never stores names, IDs, URLs, route coordinates, tokens or raw bodies. The original1500draw samples, timestamps, camera compensation and assertions remain intact. Both buffers join on `frameAt`. Complete profiles include identity work that cannot be known at the original in-call sample instant.

Both standalone per-observer artifacts and final failure-boundary captures retain `renderTimings`. The existing long-task read now obtains both fields in the same browser call; no extra awaited diagnostic read is inserted before the next observer's progress poll. Observation callbacks and all original clocks/limits remain unchanged.

| Fields | Interpretation |
| --- | --- |
| `frameAt`, `startedAt`, `callbackDelayMs`, `completedAt` | RAF timestamp, actual draw start, callback-entry lateness, actual completion |
| `updates`, `updateMs`, `peerUpdateMs`, `lastPeerUpdateAt` | Updates since the previous draw, total update work, peer interpolation update work, most recent peer-update clock |
| `terrainIndexes`, `terrainIndexMs` | Actual terrain-index rebuild count/cost within those updates |
| `groundBuilds`, `groundBuildMs` | Cache misses and their measured build cost; subset of terrain phase |
| `groundResamples`, `groundResampleMs` | Actual cached-canvas resample count/cost; subset of preparation phase |
| `prepareMs`, `terrainMs`, `sceneryMs`, `atmosphereMs`, `identityMs` | Contiguous draw phases; identity includes actual portrait/name painting and existing sampler work |

The next native run should compare the failing frame and its predecessor: large build/index cost supports a cache/index investigation; large scenery/atmosphere cost supports that rendering path; callback lateness with low in-draw costs requires investigating work outside the renderer. `lastPeerUpdateAt > frameAt` can identify a receipt installed after the stale RAF clock. These are measurements to guide a later genuine gameplay regression and minimal fix, not exemptions from acceptance.

## Validation and limits

Focused guards exercise the real renderer and real native capture helper: cold-versus-warm cache timing, a19ms injected actual biome-index operation, an11ms actual identity-text operation, unchanged RAF timestamp, no extra normal-path stage-clock reads, paused/no-draw and resumed boundaries, disabled cleanup, original text forwarding, post-frame capture, finite numeric redaction, malformed records and the1500frame cap. The renderer telemetry guard failed the original production path before implementation. Capture guards failed the empty installer before implementation. These are diagnostic RED/GREEN receipts, **not** a claimed gameplay-defect reproduction.

The worker's final report records exact commands, source/tree and raw hashes. Appropriate adjacent renderer/motion/controller/presence tests, static checks and40-case discovery are required for this candidate; no repeated broad12k suite or native execution is claimed locally. Existing strict normal<0.75/hard<0.95, backwards>−0.1, >8positive changes, exact arrivals, approvals and WASD release remain unchanged. SourceClockI1 remains repaired; early setup fixture M1 stays explicitly deferred. Human loading/click/direction-change pauses, blocked traversal, whole-map stability and physical-device/multiplayer/load acceptance remain open.
