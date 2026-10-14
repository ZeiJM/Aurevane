# World zone clarity and browser-tab return

Status: implementation under verification. Production still serves the previously released World responsiveness batch. Human gameplay acceptance remains pending.

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
