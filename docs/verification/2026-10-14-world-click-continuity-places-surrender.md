# Isola click continuity, Places portraits and surrender caption

Status: implemented locally; exact-head native workflows and release are pending. Human gameplay acceptance remains pending.

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
