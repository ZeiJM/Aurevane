# Isola click continuity, Places portraits and surrender caption

Status: LIVE for testing through PR #903 and Production `dpl_9fbA6hAy41P9s46MdxQ6Zw6t62aK`. Overall movement acceptance failed; investigation is ongoing.

## Reproduced movement cause and change

The Owner reports ordinary distant click movement stopping after a few steps and then continuing. Arrival/reload checks from the earlier release did not establish uninterrupted movement. The new regression exercises the real repository command, movement merge, motion clock and route: SQL approves at 250ms while a separate read remains slow. On the original code the acknowledgement still waits for that read (`expected 'follow-up read' to be 'approval'`), exhausting the unchanged 600ms unconfirmed preview. The corrected flow returns the canonical committed route immediately and the motion regression remains moving at 600, 650, 800 and 949ms.

The existing service-only commit RPC already returns its normalized committed state under ownership, blocking and version locks. Normal walk/autopath/tick receipts now use that exact next-version state. Validation checks its position, route bounds, minimum durations, deadline and discovery/objective shape. Stop, partial acknowledgements, unexpectedly advanced versions, pre-existing blocks and legacy full-view requests retain the fresh-read fallback. Idempotent replay remains on its existing path. No SQL, migration, authorization, encounter reach or database clock used for persistence is changed.

Display time advances from the trusted database read clock by monotonic server elapsed time measured after the read finishes; an unrelated absolute application clock is not used. The canonical returned deadline remains intact. A shared `projectWorldSector` extracts the existing cell, landmark and exit privacy filter so a lean movement receipt projects only its origin instead of constructing the full scene/atlas/objective view. Full World views use the same helper; rows and roads remain private and unknown cells/landmarks/exits remain filtered.

The acknowledgement is a snapshot at the canonical commit instant. It intentionally does not wait for a later read to discover a subsequent concurrent block. Existing independent workspace hydration and following commands observe subsequent changes. Integrated controller regressions cover training and spectating blocks at the same version, plus a newer-version battle: hydration reconciles the block and motion stops. The 200ms minimum tile duration and 600ms unconfirmed prediction bound are unchanged. This does not promise uninterrupted motion under arbitrarily slow approval/network conditions.

## Surrender and Places

The surrender dialog caption uses the existing canonical encounter origin. World says `World Encounter · PvP`, Battle Hall keeps `Battle Hall · PvP`, and historical/unknown origin says `PvP`. The allowlisted `returnTo` navigation preference does not establish provenance. The current metadata reader does not supply optional origin for historical encounters, so the generic caption avoids falsely calling them Hall battles. No metadata reader or encounter mechanics change is made.

Places replaces diamond bullets with representative cells from the existing original runtime artwork. The 36px circular frame, 2px gold border and surface/shadow share Nearby's character portrait rule. Names, accessible text, subtitles, compact rows and travel actions remain. Props cover settlements, markets, shrines, ruins, camps, springs, waystones and bridges; buildings cover hamlets, towers and frontier; beauties cover anchors/groves and valid authored scenery indices. No image generation, asset download or duplicate portrait source is introduced.

## Verification before publication

- Movement repository/service/motion/controller/receipt focused run: 197 tests across five files pass after observed failures on the original implementation.
- Surrender focused run: 82 tests across seven files pass; real open-dialog rendering covers World, Hall and unknown origin alongside existing navigation and surrender authority tests.
- Places/workspace/Nearby focused run: 42 tests across three files pass; original bullets fail 13 representative-art assertions. The suite covers every kind, scenery bounds, actual Places rendering and existing travel/hidden-frontier behavior.
- Independent read-only review finds no Critical or Important issue and independently passes 131 focused tests plus patch checks.
- Native mobile Places cases now require decoded original artwork, 36px bounds, circular radius and 2px borders; existing captures remain. The disposable two-account World encounter case rejects a Battle Hall caption in the surrender dialog. No tests, scenarios or workflows are dropped.

The first full local check caught a typing error in the surrender test's mocked overloaded `useState`; the callback now accepts an optional unknown initializer and returns an explicit tuple. Full local quality, all triggered exact-head native gates, rendered evidence and release identifiers will be recorded below when completed. Source base is `0bac86a89d645703e18f690ec0f2b997c3bb5d93`. Current Production remains the previous World release `dpl_4Xi97T7DoJRP4T6Eq1nDZnCKRH5G` until a verified release is recorded. The current Ability foundation and ledger history are preserved. Git automatic deployments remain disabled.

No real player is attacked, surrendered or messaged during verification. Deterministic continuity tests and native disposable-account flows are distinct from human acceptance, live multiplayer/load performance and a zero-latency claim.

## Final local quality

Full `pnpm check` passes 5,629 Vitest tests plus seven Node checks, formatting, lint, all eight package type checks and production build. An earlier full attempt hit the unchanged supernatural story migration suite's 10-second setup timeout while package tests ran concurrently. That suite passes alone in 3.67 seconds with all six assertions, and the restarted complete gate passes all 92 database tests without any timeout or concurrency configuration change. No test assertion or limit is relaxed. Independent incremental review covers the native Places/surrender assertions and corrected mock typing, with three surrender tests and patch checks passing.

Fresh main still matches `0bac86a89d645703e18f690ec0f2b997c3bb5d93` before publication. Browser access is currently available and the signed-in old-runtime baseline remains Archer at Sector S69-29, E894/N320, HP153/153, MP102/102 and XP96/100. This is preparation for release verification, not evidence of the unpublished changes.

## Exact-head native gates and merge

The shell push lacks a configured GitHub username, so the reviewed committed files were uploaded through GitHub's Git object APIs. Local commit `5702de602e1e8812ef49ed44a8a5b9f2e0ee8c9e` and remote candidate `74dd940b74fc6e4f6051bafb21594d3096214459` share the identical tree `beddaaf1701187bf887c00fd6b588b0d07853966`. No source change is made by this transport difference.

All four triggered workflows pass on that exact remote candidate:

- CI [38556862186](https://github.com/ZeiJM/Aurevane/actions/runs/38556862186): 5,629 Vitest plus seven Node checks, formatting/lint/types/build, and 31 pgTAP assertions.
- Living Atlas [38556862443](https://github.com/ZeiJM/Aurevane/actions/runs/38556862443): 47 passed, 79 skipped; existing authenticated two-account and mobile cases include the new surrender-caption and decoded portrait/geometry assertions.
- Representative Buildcraft [38556862438](https://github.com/ZeiJM/Aurevane/actions/runs/38556862438): 24 browser cases passed, six skipped, with its supporting 735/230 test groups passing.
- Complete responsive Browser [38556862214](https://github.com/ZeiJM/Aurevane/actions/runs/38556862214): 345 Chromium passed, 264 skipped; ten Edge passed, two skipped. All focused steps pass. No workflow or scenario is cancelled, narrowed or relaxed.

The fresh Actions collection reports exactly these four workflows, all successful. Main remains `0bac86a89d645703e18f690ec0f2b997c3bb5d93` immediately before merge. PR [#903](https://github.com/ZeiJM/Aurevane/pull/903) merges as `4c0ba69c1b8ea65d060d824030d57f568e8dd34d`, with the base and verified candidate as parents. Its tree exactly matches the tested tree.

Atlas compact artifact `11891930874` is downloaded and independently hashed as SHA256 `475aee41aec09f6ddee3377f0d96ab015fb65b7e4406b2ccab253df0b8f71955`; full artifact `11891216166` matches SHA256 `f28d19483517902aab0f07d11da22c63bcd68280fe3b8dade18ab90c05376de4`. Both match GitHub's reported digest. Portrait and landscape Places captures are visually inspected: recognizable square/fountain, marketplace, bridge, tower and camp art fits the gold circular frames and compact rows. Native peer delivery is 412ms with fallback reads blocked; the synthetic 101-player mobile render p95 is 14ms. These are CI measurements, not hosted multiplayer/load acceptance.

The canonical pre-release Production refresh remains READY on `dpl_4Xi97T7DoJRP4T6Eq1nDZnCKRH5G`, source `5d4d2ef7ab0fa9a9db430345aed7d25e068eeddd`; this is the rollback target. The manual Production deployment is created from the exact verified merge SHA, with no migration, environment or deployment configuration change. Its final status and live verification are recorded below when complete.

## Production receipt and signed-in verification

Production `dpl_9fbA6hAy41P9s46MdxQ6Zw6t62aK` is READY at `2026-10-14T12:29:54.337Z` (October 14, 08:29:54 Trinidad). The canonical hostname resolves to that deployment and exact merge `4c0ba69c1b8ea65d060d824030d57f568e8dd34d`. https://aurevane.vercel.app/game/world is live for testing. Public entry returns HTTP200; unauthenticated World follows to the account gateway with HTTP200, distinct from the signed-in checks below. The initial exact-deployment warning/error/fatal window through `2026-10-14T12:31:17.688Z` is empty. No migration, environment or deployment configuration is changed; existing foundation migrations are neither applied nor reapplied. Git automatic deployments remain disabled.

Signed-in Archer reloads the new release at Sector S69-29, E894/N320, HP153/153, MP102/102 and XP96/100. The eight visible Places portraits measure36×36px,50% radius and2px borders, with original props/buildings runtime sheets. The live desktop image is visually inspected: representative art is visible in the gold circles and rows fit the right panel.

The isometric six-tile click reaches Sector S70-29, E900/N320 and Safe Zone, with camera x900.5/y256.5. Its return reaches E894/N320 and PvP Zone. Reload retains the exact original sector/coordinates and resources. Settings still show100% zoom, lockOff and ambient animation checked; the outside close control dismisses the popup without walking. No preference is changed. Nearby is restored as the selected panel. No real player is approached, attacked, surrendered or messaged.

The live screenshot `isola-places-live-1791981275313.jpg` is captured, inspected and saved as the same JPEG bytes. Its matching synchronized main-container file is nonempty (279,801bytes), so it is available for the final inline proof. This is actual Production Places artwork, not a concept or old-release screenshot. Browser warning/error observations in the captured window contain automation chrome-extension metadata-delivery errors only; no application-source warning/error is observed.

These sparse live observations establish arrival, exact return/reload, retained preferences/resources and visible artwork. They do not establish uninterrupted frame timing, actual minimized-tab behavior, zero network latency or hosted peer/load acceptance. The repository-to-motion regression specifically catches the reproduced three-step approval pause; human long-click gameplay acceptance remains pending. This release does not close a phase or the broader overhaul.

The post-movement exact-deployment warning/error/fatal scan is also empty for `2026-10-14T12:06:41.453Z` through `2026-10-14T12:36:41.453Z`.

## Owner follow-up — 08:36 Trinidad

The Owner still reports click lag and held-key character jitter and supplies `1000931287.mp4`, a4.195-second phone recording of forest movement. This is an explicit failure of overall movement acceptance after the release; the focused approval regression and sparse arrival observations above must not be presented as complete smoothness acceptance. The original uploaded video is read from its supplied scratch copy without modification. Shared client motion/receipt/scene timing, held-input pacing, server route replacement and renderer cadence are under fresh investigation. Places and surrender changes remain live; the wider movement problem remains open.
