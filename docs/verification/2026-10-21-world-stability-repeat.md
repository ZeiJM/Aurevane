# World repeated-test fixture isolation — October 21

Status: test-only successor with I1 scheduling repair ready for scoped re-review and native verification. No movement fix, native repeat pass, merge or deployment is claimed. Baseline main: `4793b77c607b98bc8a8ccf783da56d69f429f0fe`; branch: `agent/world-stability-investigation-20261020`. PR #933 remains unchanged and unmerged.

## Diagnosis and original evidence

PR #933 source `120bb66acc0457e1a47bb8dc1004474d1730b817`, run 39074439897/job 117518568186, passed 21/40 cases: all 20 held-WASD cases and one presence case. Presence failures comprise 15 live-response timeouts, two unchanged-origin arrivals and two strict jumps. Sanitized log SHA256: `83b499007c5e4bc02cd0e0fb5121f593f43749ee7f79bf7d1e1cc3bb0c2c4335`; original compact artifact SHA256: `8a4a81f0369e8a846b08167c18803958696bab44d126980e2febd7c7090bfd0c`. All 20 independent Node private joins passed; this does not establish each browser subscription's health. The original 1.54 GB trace artifact was not retrieved.

Each presence repetition creates unique accounts but reuses x4/x3/x7 in `atlas:59:28`. Its old finalizer only closed the second browser context. Canonical SQL deliberately retains open-ground offline peers for ten minutes (`supabase/migrations/20261013131048_world_live_presence.sql`, player filtering). The renderer's `hitTargets` hit area includes the ground-click coordinate and pointer-up prioritizes that player over ground, including offline players (`apps/web/src/components/world/map-renderer.ts`). `stageWalk` clicks without proving a command. Therefore a failed repeat could intercept the next repetition's ground click.

Observed chronology, October 17 UTC: repeat 1 finishes at 22:21:27.972 after arriving at x3/x7 and failing a jump. Repeat 2's initial x4 delivery succeeds, then arrival fails at 22:22:08.875 with the owner still at its original tile. Repeats 3–14 time out. Repeat 15 again delivers around 22:32, consistent with ten-minute expiry of repeat 2's x4 peer, then fails a jump at 22:32:20.195. Repeat 16 delivers but remains at x4 instead of x7, failing at 22:33:01.329; repeats 17–19 time out. This strongly supports fixture contamination. The missing historical trace means exact clicked identity/POST absence in each old timeout is inferred, not directly observed.

The two actual jump failures remain unresolved: 1.0138500632847354 tiles over 188.3 ms with four long tasks and 0.9694809741440622 over 192.7 ms with two long tasks. Neither may be dismissed by the fixture diagnosis. Main already includes later viewport/cache, split-read and movement-receipt repairs; no historical product file is cherry-picked.

## Bounded change

- Stop both case pages before retiring only the two tracked local World rows: safe=false, cleared route/deadline and last_seen older than canonical open-ground retention. Validate UUIDs and at most two identities; verify affected count. No global cleanup, account deletion, migration or authority change. Closing failure prevents retirement while pages may still run; cleanup errors remain separate from the original failure.
- Match each presence walk's exact POST intent/destination and assert successful movement authority, character, advancing version and exact route endpoint. Never retry a missed click. Observe the controller's existing stale-version 409 recovery within the same five-second response-matching window (the subsequent body read remains subject to the existing 120-second case timeout). Other rejection responses fail explicitly. Preserve the original arrival deadline relative to click completion and measure delivery independently of approval latency.
- Always capture bounded request/response/socket categories and numeric receipt/motion evidence, including early failures. Attach cleanup outcome separately. New diagnostics omit raw URLs, headers, JWTs, raw websocket payloads, player identities and raw backend errors. The private-join probe remains independent.
- Restore PR #933's strict sampler: ordinary-frame delta <0.75, time-adjusted hard delta <0.95, increasing timestamps and backward delta >−0.1. Preserve exact arrivals, monotonic idle motion, privacy/authority and held-key release checks. Historic jump values still fail the unit guard. Restore the original strictly-more-than-eight idle draw count.
- Add one path-filtered PR/optional-dispatch workflow for precisely the existing two desktop cases, 20 repeats, one worker, zero retries and an always-stop local database step. Compact artifacts include early boundary/cleanup data and both moving arrays. Existing regular workflows remain unchanged.

## Verification and limits

The close-only cleanup extraction failed five of six focused guards before retirement was added; request/socket-summary stubs failed four additional guards before implementation. The renderer regression uses the actual renderer: a retained offline fixture consumes its ground click; removing it restores exactly one walk. These guards do not certify a local database/browser run.

Initial focused tests: 138 passed. Initial `corepack pnpm --filter @aurevane/web typecheck` exited 2 with TS2769 (`"framesent" | "framereceived"` incompatible with the final `"socketerror"` overload) and TS7031 (`payload` implicitly any). Explicit typed sent/received handlers repaired both; subsequent `corepack pnpm --filter @aurevane/web exec tsc --noEmit` passed.

The first whole check, `VITEST_MAX_WORKERS=1 TURBO_ENV_MODE=loose corepack pnpm check`, exited 0: format, lint, workspace types, 11,982 Vitest tests plus seven Node tests, worker build and web build passed. Output: `/workspace/scratch/e5db2ba73c1a/world-stability-check.log`. Database tests took 465.99 seconds, web Vitest 610.92 seconds; the test stage took 17m59.382s. This receipt predates the final E2E scheduling correction and three saved-artifact guards. It is not an exact-final-source broad-check claim.

After that correction, final focused commands passed:

```sh
corepack pnpm --filter @aurevane/web exec vitest run e2e/world-presence-diagnostics.test.ts e2e/world-timing-metrics.test.ts src/components/world/map-renderer.test.ts
corepack pnpm --filter @aurevane/web exec tsc --noEmit
corepack pnpm --filter @aurevane/web exec eslint e2e/world-presence-case.ts e2e/world-presence-diagnostics.ts e2e/world-presence-diagnostics.test.ts e2e/world-timing-metrics.ts e2e/world-timing-metrics.test.ts src/components/world/map-renderer.test.ts
corepack pnpm --filter @aurevane/web exec playwright test e2e/atlas-world.pw.ts --project=desktop-chromium --workers=1 --repeat-each=20 --retries=0 --grep 'known neighbouring players follow the visible viewport|holding WASD walks repeatedly' --reporter=list,github --list
```

The focused run passed 141 tests. Saved-artifact guards exercise no-request, rejected-request and presence-failure boundaries, retain cleanup categories, and reject synthetic secrets, raw backend errors, URLs and identities in attached JSON. The initial final-lint invocation from the repository root ignored web files; the corrected web-package command above inspected them and passed. Playwright discovery found 40 cases (two cases × 20); it launched no browser. Existing Vite CommonJS configuration warnings remain unchanged. YAML parsing and exact PR trigger/repeat/always-stop assertions passed; changed-path Prettier and diff whitespace checks passed.

No local Docker/Chromium is available. Exact-final-head native CI and all 40 strict repeat cases remain required. Even a repeat pass establishes only these repeated harness journeys: actual World loading, intermittent click-to-move/direction-change pauses and blocked traversal reported after the LZ4 release remain separate acceptance work, alongside the two historical hard jumps. No whole-map stability or human/multiplayer/load acceptance is claimed.

## I1 scheduling repair — October 21, round 1

Independent review of frozen `ed98077a4af63deb4f30ef2dde008058c32d188f` / tree `a3bd5d37ca7c605d065a25b6e7fc973acc4b711c` requested changes: the initial approval join **and** its finalizer drain postponed idle-draw/arrival polling, and the both-moving approval join still postponed rendered-progress polling. The earlier statement that all original observation deadlines were preserved was too broad. This repair corrects those dependencies only.

The real E2E path now uses `observeWorldMovement` from the existing test-only timing module to start the complete observation callback immediately while requiring every click and approval to succeed. Initial delivery is timestamped on body availability exactly as before; delivery/artifact assertions precede click completion, fallback-route removal, the >8 distinct-draw / 4000ms poll, exact mover arrival / 12000ms poll, exact observer arrival / 5000ms poll and renderer assertions. No approval is awaited or drained inside that sequence. Both-moving polls still follow both clicks; both rendered-progress checks and strict sample assertions now remain in the same concurrent observation callback, before the approval join. All existing positions, bounds, authority/version/actor/route assertions, privacy and held-key release checks are unchanged. First click/approval/observation rejection propagates; later rejected promises remain observed. The outer diagnostic/page/context/fixture cleanup remains unchanged, with primary failure preservation and no new approval drain.

The matching response waiter remains 5000ms. That bounds response matching, not the subsequent `response.json()` body read. A stalled body cannot extend any observation deadline or produce success without approval; it may consume the remaining existing 120000ms case budget before failing. No new body-timeout policy, click retry, assertion relaxation or timeout extension is introduced.

Seven scheduling cases exercise the helper actually used by both E2E paths: a pending approval leaves the full observation sequence running at its original times; an observation failure surfaces at its 4000ms deadline without approval draining; both-moving rendered progress starts after clicks/arrivals despite pending approvals; either approval rejection fails otherwise successful observations; a late observation error cannot replace an earlier approval error; and an immediate click failure is preserved while delivery/approval remain pending. These are controlled promise/timer boundary tests, not native browser/SQL evidence. The existing six metric guards retain both historical hard-jump failures.

Meaningful RED/GREEN: `world-fix1-final-red.log` records four failed scheduling assertions (9 passed, no unhandled errors) with the actual helper deliberately serializing walk completion before observations. Restoring concurrent observation passes all 13 timing tests (`world-fix1-click-green.log`), and the final focused run passes 148 tests across diagnostics, timing and renderer (`world-fix1-focused.log`). Earlier attempts are retained: `world-fix1-red.log` had three intended failures plus a test-owned unhandled rejection; corrected setup produced four failures without that noise in `world-fix1-red-clean.log`. The intermediate click-aware test API transition (`world-fix1-click-red.log`) had five failures/four unhandled rejections against the previous approval-only signature; it is retained as a failed development command, not the meaningful scheduling proof. `world-fix1-red.patch` preserves the first clean-RED implementation. No failed log was replaced.

Final focused checks (all exit 0):

```sh
corepack pnpm --filter @aurevane/web exec vitest run e2e/world-presence-diagnostics.test.ts e2e/world-timing-metrics.test.ts src/components/world/map-renderer.test.ts
corepack pnpm --filter @aurevane/web exec tsc --noEmit
corepack pnpm --filter @aurevane/web exec eslint e2e/world-presence-case.ts e2e/world-timing-metrics.ts e2e/world-timing-metrics.test.ts
corepack pnpm --filter @aurevane/web exec playwright test e2e/atlas-world.pw.ts --project=desktop-chromium --workers=1 --repeat-each=20 --retries=0 --grep 'known neighbouring players follow the visible viewport|holding WASD walks repeatedly' --reporter=list,github --list
```

Discovery remains 40 cases; no browser was launched. The unchanged Vite CommonJS configuration warning remains. Changed-path Prettier, diff whitespace and a fresh main fetch are recorded in the final fix report. Raw outputs are under `/workspace/scratch/e5db2ba73c1a/world-fix1-*`; their SHA256 manifest and exact final commit/tree are recorded in the investigation handoff. The broad check was deliberately not rerun for this E2E-only scheduling delta; its earlier pre-final limitation above remains. Exact-final native CI and the strict 20×2 repeat remain mandatory.

Minor M1 remains explicitly deferred: fixture IDs are recorded only after both initial World reads, so an earlier setup failure can leave a created row untracked. This repair does not claim complete early-setup retirement. The original failed native evidence, broader World loading/pause/traversal reports, both hard jumps and human/multiplayer/load acceptance remain unresolved.
