# World zone clarity and browser-tab return

Status: LIVE for testing through PR #897 and the Production deployment recorded below. Human gameplay acceptance remains pending.

## Owner requests and scope

The Owner confirmed that the reported Approach/Attack failure was the correct protected-area restriction. The pictured Zei/Storm positions are cardinal neighbours in the same sector; the existing one-tile reach already permits that distance on legal open ground. No attack range, activity window, protected-area rule, encounter authority or database schema is changed.

The requested follow-up adds a persistent Safe Zone/PvP Zone label beside the sector and coordinates in the panel foot, and red enabled Attack buttons. Disabled Attack remains grey. A subsequent report concerns leaving the map in a different browser tab and returning to an apparent old position followed by a jump.

## Changes

- The footer reads the current approved tile's existing server-projected `safe` flag. It follows the approved position rather than a route destination, nearby character, selected globe destination or neighbouring sector. Missing current terrain says Zone unavailable. Text, colour and a small dot distinguish safe and PvP status without relying on colour alone. The existing gear, coordinates and responsive panel structure remain.
- Only enabled World Attack buttons receive the red normal/hover treatment. Approach, Talk/Interact, action dimensions, disabled styling, themed cursors and all encounter restrictions remain unchanged.
- Hidden tabs already stop the renderer and ordinary movement synchronization. Their visual route formerly continued consuming wall-clock time, so returning could expose an advanced preview before the saved route caught up. The renderer now suspends its visual timeline on hide and shifts that timeline on resume. Database approval clocks remain separate; authoritative commands and receipts still decide landed tiles, blocking and encounters.
- The foreground return path settles an existing route through the normal serialized tick command before hydrating presentation. It does not first reconcile an older saved position from an idle read. A pre-return idle read is aborted without aborting writes; its late completion cannot replace the new command receipt. Blocked/idle returns use the ordinary refresh path. Held keys still release on hide.

## Verification

The new footer regressions initially failed because the zone label was absent. Two independently observed return regressions failed on the original implementation: after a ten-second hidden interval the visual point advanced from x890 to x894.5, and a return refresh retained an unsettled saved tile instead of committing its due step. The final focused run passes 222 tests across the renderer, motion, controller, workspace and Nearby suites.

Additional regressions cover a canonical receipt arriving while hidden, new training/battle blocking during suspension, a late pre-return idle read, and a blocked return that must not advance its route. Existing overdue bootstrap bounds, 200ms minimum tiles, 600ms unconfirmed previews, private geometry, command priority, encounter guards and held-input tests remain intact.

The native disposable two-account arrival case now also asserts Safe Zone with grey protected Attack, then PvP Zone with red enabled Attack before its existing canonical encounter creation. The suite, checks and authority assertions are not narrowed.

Independent review reruns all 222 focused tests, verifies a clean patch, and finds no Critical or Important issue. Its fresh main fetch matches base `a5069763ceff842150bd96a929615ac54c5bf9e1`. Full local `pnpm check` passes 5,327 Vitest plus seven Node checks, formatting/lint/types and production build. Exact-head workflows, rendered evidence and any release receipt are still pending and must be recorded before completion. No migration, environment or deployment configuration change is needed.

The deterministic lifecycle regressions establish the reproduced cause and its guarded behavior; they are not a claim of human acceptance, zero latency, hosted load performance or a live multiplayer attack. No attack or message is sent to a real player during verification.

## First candidate and correction

PR #897 first candidate `85dfabcc928c0e7a5c1ab34bcfc82da39e7e1025` passed CI (run38505717310, including31pgTAP) and Living Atlas (run38505717282,47enabled cases). Full Browser run38505717283 completed with344passes and one failure: the held-WASD case counted five walk requests against its assumed four-request limit after a nominal700ms driver delay. No workflow was cancelled or narrowed. The failure does not establish a changed production input cadence: keyboard round trips are outside the nominal delay, and a409 retry is another request without being another input. The harness now records actual DOM keydown/up timestamps, enforces the authored200ms cadence against that measured interval, counts409 retries separately, and retains arrival and no-input-after-release assertions. A production renderer regression verifies that an actual850ms hold emits at0/200/400/600/800ms and releases cleanly. The old diagnostics artifact exceeds the connector's512MiB download limit, so its actual historical key interval is unavailable; the next full native run will print the measurements.

A further hidden-receipt regression inserts scene hydration before resume. It failed on the first candidate: expected the next frame to move0.08tiles, received0. The confirmed origin had advanced ahead of the paused visual point; clipping its projection to the first confirmed segment skipped a tile, and scene validation stopped that invalid visual edge. Points behind that origin now use the existing known/walkable correction path. Authority, minimum tile durations and private terrain bounds are unchanged. This correction requires a new candidate and fresh full native gates; the first candidate's green workflows cannot authorize its release.

First-candidate Atlas compact artifact11868261202 was retrieved with verifiedSHA256`f2a908b661a3f64f97b67e84d6f1bcefac7d28136e07e2749ab33a5ecee9a02b`. Desktop evidence visibly fits PvP Zone beside sector/coordinates; mobile map evidence fits with its panel closed. Protected-grey and legal-red Attack assertions pass in the disposable arrival case. Human gameplay acceptance remains pending.

The corrected local quality gate passes5,328Vitest plus seven Node checks, formatting/lint/types and production build. The final focused suite passes223tests across five files. The reviewer independently reruns181motion/renderer tests and reports no Critical/Important concern; capture-phase DOM timing includes the production handler window. Current main remains `a5069763ceff842150bd96a929615ac54c5bf9e1`. Fresh exact-head native gates and release remain pending.

## Completed World candidate and current-main reconciliation

Candidate `e9581a9ac81ad629f69746c11a8e383c25fdb914`, tree `647607b7062ce65a2b4fe41740ed8fbc51785fb1`, passed all three exact-head workflows: CI38513047347 (5,328Vitest, seven Node checks,31pgTAP), Atlas38513047357 (47passed,79skipped), and full Browser38513047348 (345Chromium passed,264skipped;10Edge passed,two skipped). The full Browser hold measured834.4ms with four requests, zero409s, and a measured-window maximum of five; Atlas measured771.8ms with four requests and zero409s. All arrival/release assertions remain. No workflow was cancelled or narrowed.

Corrected Atlas compact artifact11870789305 has verifiedSHA256`876da50386f06974e45e2e6dd7b3ac435ec30c420768b4bb07ffd96fb9076630`; full artifact11871038672 has verifiedSHA256`7cd0aa8f1f9ce6d5f1dd8429da6c43d93824f3c7b9002192add9a691d8efca70`. Rendered desktop evidence visibly shows Safe Zone with grey adjacent Attack and PvP Zone beside coordinates. Mobile map evidence fits with its panel closed. CI peer delivery is449ms with fallback reads blocked; synthetic101-player mobile render p95 is10ms after240frames. These are CI measurements, not hosted load or human acceptance.

The cloud browser keeps World visible when another tab opens, and does not expose the visibility control, so no real hidden-tab live acceptance is claimed. Lifecycle regressions cover the hidden/resumed event sequence.

During the full run, current main advanced to `69347f11e4625808df91b033d4139da913116786` through the already released Ability foundation (#896, Production `dpl_3pgy6TV6Z9zUfbCgnMfjwykQX7xv`, source `128f7add15aefed3384310a5f138466b1ff5b625`) and its receipt (#898). The World battle integration and shared execution changed. Deploying the older candidate would regress that release. The patch is therefore integrated onto current main. Complete Git tree comparison verifies that none of the World source/test paths overlap incoming edits; only TASKS.md needs its new release header retained. All current-main code, schema and configuration are preserved; the World diff still introduces no migration. Fresh exact-head CI, Atlas and complete Browser checks are required for the combined tree.

The local executor reports `environment_offline: Environment is not connected`. GitHub/Vercel access remains available. There is no claimed local combined check; the fresh native CI quality gate must validate that combined source before release.


## Final combined gates and Production receipt

Combined candidate `bf0e706dea9e180ae78e63133da5bca5713d814e`, tree `b7d2fa3c01231858347f9454e401aaa54751338e`, passes all three exact-head workflows:

- CI [38521255870](https://github.com/ZeiJM/Aurevane/actions/runs/38521255870): 5,592 Vitest tests plus seven Node checks, formatting, lint, types, production build, worker boot and 31 pgTAP assertions. This is the full native combined quality gate; no local combined run is claimed.
- Living Atlas [38521255841](https://github.com/ZeiJM/Aurevane/actions/runs/38521255841): 47 passed, 79 skipped. The measured held-key interval is 754.8ms, with four movement requests, zero 409 retries and a maximum of four at the authored cadence.
- Complete responsive Browser [38521255847](https://github.com/ZeiJM/Aurevane/actions/runs/38521255847): 345 Chromium passed, 264 skipped; 10 Edge passed, two skipped. Every focused browser step also succeeds. The measured hold is 773.6ms, four requests, zero retries and a maximum of four; arrival and release assertions remain. No workflow was cancelled or narrowed.

The repository Actions collection reports exactly these three runs for the combined head, all successful. Independent reconciliation review confirms the complete tree comparisons, the same 11 World code/test blobs, exactly 13 expected diff paths and preservation of current-main code/schema/configuration and ledger history; no Critical or Important blocker is found.

GitHub reports PR #897 merged as `5d4d2ef7ab0fa9a9db430345aed7d25e068eeddd`, with parents `69347f11e4625808df91b033d4139da913116786` and the verified combined candidate. Its tree exactly matches the tested tree. The final main and canonical Production refresh still show the current Ability foundation before deployment; rollback target is `dpl_3pgy6TV6Z9zUfbCgnMfjwykQX7xv`.

Production `dpl_4Xi97T7DoJRP4T6Eq1nDZnCKRH5G` is READY at `2026-10-14T07:31:29.226Z` (October 14, 03:31:29 Trinidad). The canonical hostname resolves to that deployment and exact merged Git SHA. https://aurevane.vercel.app/game/world is live for testing. Public entry fetch returns HTTP 200; unauthenticated World fetch follows to the HTTP-200 account gateway, not a signed-in map verification. The exact-deployment warning/error/fatal scan is empty for `2026-10-14T07:03:41.365Z` through `2026-10-14T07:33:41.365Z` (the deployment became READY within that window). No migration, environment or deployment configuration is changed; existing foundation migrations are neither applied nor reapplied. Git auto deployments remain locked.

The local executor remains offline. The cloud-browser documentation call timed out; that browser also lacks actual background-tab visibility control. Therefore signed-in production movement/return, a new live screenshot and real minimised-tab acceptance could not be verified in this release. No player was attacked or messaged, and no player movement or preference mutation was made during the disconnected release checks. Native authenticated scenarios and deterministic lifecycle regressions pass, but they are not human acceptance or a zero-latency/hosted-load claim. The Owner should test walking, switching to another browser tab or minimising, then returning; also confirm the footer zone label and protected/available Attack states.

Combined Atlas artifact metadata reports compact evidence `11874561145` with digest `sha256:d45dc6e73a3dc1f949684f2f948f90c8d891a1fd599e449a0971c8f7df98056e` and full evidence `11873954846` with digest `sha256:c5de737ab49fb2d99d69520b98f0612ed07ec0df728d6016c1f47eef22a53e5f`. These are GitHub-reported digests; the disconnected executor prevents downloading and re-hashing the combined artifacts. Earlier corrected World images were inspected before disconnection and their World code/test blobs are unchanged, as documented above.
