# Aurevane continuation checkpoint

Read this first; open detailed sources only for the task being worked on. This is an index, not a replacement for the requirements.

## Active candidate

- Repository `ZeiJM/Aurevane`, branch `agent/world-map-correction-20261112`.
- Fresh main: `2c3c73d13f4c0cf1eb4ac5824deb8ae7b8b4760b` (PR1038, earlier release recorded live). Do not replay it.
- Current map corrections are **not live**. Nick already authorized this corrective production release for testing after quality, review, actual desktop/phone acceptance and controlled migration/postflight.
- Preserve stable IDs/positions/progress, private discovery, drafts/publications/history and the disabled automatic Git deployments.
- Exact 12-outcome authority: `docs/superpowers/specs/2026-11-12-world-map-correction-design.md`.
- Plan: `docs/superpowers/plans/2026-11-12-world-map-correction.md`.
- Detailed evidence/open gates: `docs/verification/2026-11-12-world-map-correction-progress.md`.

## Current remote and quality checkpoint — November 12, 17:55 Trinidad

- The recovered candidate is preserved on the non-deploying remote branch `agent/world-map-correction-20261112`; draft PR #1039 points at `b1d2514c42bec3c1f495048bd5a9056f934b5683`. Main was still `2c3c73d1` at the last refresh. The recovery archive's immutable map baseline is tracked; the remote source is not live.
- The first local combined gate passed format/lint, then exposed the omitted baseline import. After restoring it, typecheck and production build passed. The full test run passed 9,514/9,515 web tests; one old Void row-major label assertion expected sector 34 instead of 66. Focused teleport tests passed 11/11 after repair.
- The second combined gate passed format/lint/typecheck and 9,514/9,515 web tests; its sole failure was the exhaustive eight-realm geometry test exceeding the default five-second timeout under full-suite load. The same 14-test realm file passed alone in 42 seconds overall; the geography case previously passed in 4.56 seconds. Its threshold is unchanged and its per-case budget is now 30 seconds. The combined focused realm/teleport recheck passed 25/25; a final combined gate remains pending.
- PR CI at the earlier head found one obsolete browser expectation of 768 instead of the actual 64×48 = 3,072 Void sectors; the browser assertion has been repaired. Local Chromium cannot launch because sandbox socket creation returns EPERM. The Living Atlas authenticated browser workflow is still running; exact-head CI must rerun after the repairs are pushed.
- Next action: commit/push these three test-only repairs, verify the new remote SHA, then complete exact-head local/CI and native image/performance review before migration or release. Hourly checks remain paused.

## Follow-up source review — November 12, 18:02 Trinidad

- Test-only repairs were pushed as `5edad1a53c6fe1e3bdcc29fa0ed30859dc34b179`, with remote SHA verified. The earlier PR runs are superseded; fresh CI at this head started.
- Whole-branch review found one Important scene selection defect: when all 13 legacy Uncharted districts and a local 5×5 supercontinent neighborhood were discovered, distant districts consumed the 25-sector scene budget and withdrew nearby surveyed ground. A new saturation regression failed on the original source, then the private scene filter/distance were corrected using `sceneColumn`/`sceneRow`. Focused World/continent/renderer tests pass 275/275. A targeted review found no further Important side effect; current/route priority and private cell masking remain intact.
- Final combined local quality and exact-head CI are pending on this source correction. Next action: finish the combined gate, commit/push this reviewed fix, verify the new remote SHA and review native desktop/phone Atlas captures and timings. No migration or deployment has occurred. Hourly checks remain paused.

## Formatted source quality — November 12, 18:10 Trinidad

- The ground correction was formatted without changing its behavior. The complete local `pnpm check` passed on the formatted tree: format, lint, typecheck, 17,629 Vitest tests across seven packages, seven Node tests and the production build. The saturated Uncharted case and all 52 World service tests passed; adjacent World/continent/renderer focused suites passed 275/275.
- Next action: push the formatted source as the new exact PR head, verify remote SHA/tree, then use only that head's CI and native Atlas screenshots/timings for release decisions. Earlier PR runs are superseded. Production remains on the PR1038 release; no corrective migration or deployment has occurred.

## Preserve the requested result

Retain the receipt/ground-loading fix; remove rock shadows/floating art; measure map performance; provide organic rivers/lakes/sea/lava with depth/weather motion, authoritative town-water walking and shallow footsteps, eight distinct towns/Crown walls/moat, coherent relief, grand remote ruins/bridges/towns, larger-than-town waterfall valley/open colosseum, occasional large HQ ocean discoveries, crisp globe and real private64×48 Uncharted supercontinents. Verify artwork at actual gameplay zoom.

The exact valley selection is `sources/elemental-waterfall-valley-owner-selected-v01.png`, from `image(20261112-175551)`. Rejected muscular/robed variants are not selections. Keep falls/spray/basin animation and the registered rectangular detail frames; do not restore rejected silhouette overlays or regenerate completed artwork.

## Latest recovery — November12, implementation first

Read linked Old8 (`6af61ac5-60d8-83e9-80c2-63e19444e1ca`) directly. The worktree and selected artwork are intact. Nick now requests implementation first, a combined quality pass afterward, and paused hourly checks. Disabled the sole enabled Aurevane automation (`Automation_a05a9603607c8191bbeed63e8531a28d`); the other24were already paused. Do not restart them without a new request.

Old8 repaired obsolete town fixtures in five test files and restored a tracked audio file omitted by the partial checkout. Its six focused suites passed30/30. The resumed broad check stopped after lint/start of typecheck with no final result; it is not running now and must not be described as passing. No newer implementation gap has been established. Preserve the integrated candidate before the next combined validation; do not regenerate art, replay completed repairs or repeatedly rerun the broad suite during development.

### Earlier review repairs, retained

Read Old5 directly in the signed-in browser; recovered Old4's corrective mandate and final refinements; checked Old6's intervening lava repair checkpoint. Source and artwork are intact. No repeat reconstruction is necessary.

Independent whole-branch review found two Important issues, now repaired:

- Ambiguous globe browser text selector: target the unique orientation button. Existing globe/scene checks: **7/7 pass**.
- Giant land/ocean discoveries vanished after wrapped-longitude journeys. Use the camera's nearest longitude copy. Four actual renderer cases failed before repair; all six canonical/west/east cases passed after repair. Full renderer and land/ocean placement check: **229/229 pass**.

Reviewer separately passed **36/36** terrain/privacy/placement/matrix checks and found no other verified Critical/Important issue. Native visual/performance acceptance remains required.

The earlier `.local-validation/continuation-quality.log` contains failures subsequently repaired in Old8. Its successor `.local-validation/continuation-quality-resumed.log` has no terminal result. Use both as historical diagnostics, not current passing evidence.

## Next actions

1. Preserve/publish the complete implementation candidate on its own branch; verify the exact remote tree and refresh main. A source checkpoint is not release acceptance.
2. Once implementation is settled, run the combined quality gate, fix genuine failures without weakening tests, and prepare the draft PR.
3. Run configured exact-candidate workflows, including the Atlas matrix:8towns,6landscapes,4discoveries,2globe backends on desktop/phone. Earlier local Docker/native browser evidence was unavailable; source tests/older release captures are not substitutes.
4. Review actual images/art loading/movement/zoom/resize/performance. After all gates, perform controlled geometry-v2 migration/release/postflight, preserving v1 and user state. Record the release receipt and open human/device acceptance.

## Separate next update — never silently close

Authority: `docs/verification/2026-11-12-recovery-and-release-split.md`. Revalidate `docs/verification/unified-upgrade/requirements.csv`:82rows retaining all70original IDs. Historical statuses are not a current completion percentage.

Next update: ferry integration/access to the selected Void world and deferred Void gameplay tests; genuine unmet appearance/creator/animation, NPC, Events, accessibility and broader performance criteria. Preserve hourly free five-minute ferry/shared-deck/public-ship contracts. Do not restore rejected names/chicken fixtures. Map release completion does not close this backlog.

## Context discipline

Keep detailed logs/evidence outside chat; report changed status, verified results, blockers and next action. Update this checkpoint and detailed progress after milestones. Retrieve old conversations only for missing/conflicting requirements. Never promise unlimited conversation capacity or imply unverified completion.

Recovery checkpoint verification:305/305 tests pass across seven affected integration suites (water/coast/renderer/settlement/compatibility/privileged NPC route/audio). Full combined quality, browser/native performance and release gates remain pending. Log: `.local-validation/recovery-implementation-checkpoint.log`.
