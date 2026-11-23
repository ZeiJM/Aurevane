# Task13 fix1 scoped re-review — 2026-10-25

**Spec compliance: ❌ Issues found. Task quality: Needs fixes.** I1 **ADDRESSED**. I2 **NOT ADDRESSED completely**: meaningful coverage was added, but the new Players branch has a deterministic locator failure. **New/open fix-scope counts: 0 Critical, 1 Important, 0 Minor.** The inherited M1 remains separately deferred; it was not reopened.

Reviewed `8060c4fddf5037fbf8c9b512717b1a72b7544e10` → `b774fcecd2da641c61429d41678cdcaa6953a38d`, product checkpoint `8a01dc742c25566ed27f76325d97a0ad616c6944`, final tree `9b377582dd5b7ca49af2acd35c9727f88c4ba1a3`. Paths below are relative to `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`. This is the same review seat's single scoped first-round re-review, not a new broad review.

## Finding disposition and strengths

**I1 — ADDRESSED.** `apps/web/src/server/master/supabase-combat-content-authoring-store.ts:313–327,365,523,568` now applies one exact executable-source enrichment to read, write/restore and saved-publication results. It derives the version from supported server source and replaces an injected capability with undefined when the builtin source is absent/unavailable. No additional SQL publication or selected-record reload is introduced.

`apps/web/src/server/master/combat-content-tag-lifecycle.test.ts:328,331,366` now asserts the capability on the actual save, publish and restore response shapes. `supabase-combat-content-authoring-store.test.ts:41–73` supplies injected777 with valid/absent/unavailable source controls. The mounted fixture at `apps/web/e2e/fixtures/basic-original-rpc-service.ts:18–76` uses the production HTTP handler, command/service, selected-character RPC adapter, store and complete migration functions through PGlite; its controlled Owner identity/transport is explicit.

The browser regression at `apps/web/scripts/skill-parameter-palette-browser-regression.mjs:951–1018` consumes those responses in the production editor, saves, publishes and restores without reselecting the record. It verifies the complete restored definition and exact non-list request sequence `save,publish,restore` after each initial selection. The retained mounted RED actually reaches successful Save and the unavailable-original History message; earlier fixture bootstrap errors are correctly distinguished. The final artifact records five Basics at four viewports, and the390px screenshot shows the original action alongside physical currentv2/restored draft. This directly covers the original failure instead of reproducing the prior fixture blind spot.

**I2 — substantial coverage repair, but NOT ADDRESSED completely.** `apps/web/e2e/master-complete-layout.pw.ts:198–199` invokes the new helper on every factor2 route, while retaining the extension's automatic per-tab zoom/readback, CSS-viewport checks, non200 matrix and existing180-second budget. `master-zoom-workflows.ts:13–97` adds control visibility, center hit testing, clipping ancestors, named-control tab traversal/focus-visible styling, Enter activation, container/root overflow, screenshots and read-only zoom2 checks.

The helper now exercises real operational states: long/dirty/error/save/History/original restore in Game Content; Rules disclosure/save; World invalid/save; Music empty/dirty/reset; Staff verified lookup/linked-character reader; Players empty/search/protected reader; Event draft/preview; and Live Ops empty/refresh. These are meaningful assertions, not merely route screenshots. The native configured workflow still runs the authenticated test, and `.github/workflows/browser-smoke.yml:107–111,361–367` additionally executes and preserves the new SQL-backed mounted original regression. The source defect below prevents completion of the new native route sequence.

## Issues

### Critical

None.

### Important — F1: Players reader locator matches both the whole Master shell and the nested details card

**Changed source:** `apps/web/e2e/master-zoom-workflows.ts:228–230`.

The new locator is `page.locator('section').filter({ has: button('Refresh player') })`. Once inspection loads, the real DOM has at least two matching sections: the outer `MasterPanelShell` section (`apps/web/src/components/master/master-panel-shell.tsx:144–148`) and the nested player details section containing Refresh player (`apps/web/src/components/master/players-workspace.tsx:183–190`). `apps/web/src/app/master/players/page.tsx:8–17` mounts PlayersWorkspace inside that shell.

The next string `toContainText` assertion is a single-element assertion and the subsequent `state()` calls single-element visibility/evaluate operations. This ambiguous locator therefore fails strict resolution on the actual authenticated page. The genuine200 run cannot finish the Players workflow or reach the remaining Event routes, even if every product control works correctly. Discovery/typechecking and the separate mounted original guard cannot detect this DOM ambiguity.

Select the actual details card uniquely, for example by anchoring from the unique Refresh player control to its nearest section, and assert that the resolved reader count is1. Add a narrowly scoped regression using the real Master shell plus Players details nesting (or the actual native page), so the correction cannot accidentally validate the shell instead of the protected-facts card. Preserve the new state/geometry assertions; do not bypass them with a broad first-match locator.

### Minor

No new Minor findings in this fix diff. **Inherited M1 remains deferred for final whole-branch triage** as instructed: ordinary stored-history restoration of a System-derived publication can display Unknown authorship. No unchanged SQL/history attribution review or new repair request was made for it.

## Evidence, scope and pending gates

- Read the fix handoff, exact brief, appended report and complete changed source/test/CI/tool hunks once in bounded chunks. The source package is148109 bytes, SHA256 `64108dbc8bc46ec2e83aee696056ec93af30e3c23056730508eddc6936af6465`.
- Parsed all24 new receipt rows; verified each gzip and decompressed raw SHA. Read actual mounted RED, unavailable-source RED, final mounted,37-test,28-test and final-integrity logs. Verified all79 browser manifest artifact sizes/hashes and inspected the final390px original-response JSON and Basic Attack screenshot. The actual request sequences contain one initial read per Basic, followed by save/list/publish/list/restore/list, with no intervening selected-record read.
- The report's65 focused tests and local Chromium153 mounted5×4 proof are supported by those artifacts. Failed bootstrap attempts remain failed. Existing-service rerun, types/lint/format and discovery receipts remain distinguished from native execution. No passing suite or browser acceptance test was rerun by this reviewer.
- Outside-diff reads were narrowly limited to the new helper's mounted contracts: labels/roles and nesting for Rules, Music, Staff, Players and Events; the Master shell/Players page composition for F1; and existing browser/server loader context cut off by the script diff. These reads assessed new selectors/fixture behavior, not untouched accepted features. No source/index/HEAD/ref mutation, helper agent, remote or hosted action was performed.
- The report now describes the exact Owner's separate eight-Skill Primary/Secondary rows followed by Support. No Nexus product layout changed. The Root ledger correction honestly retracts an authenticated-hosted readiness claim; it does not affect product source acceptance.
- Physical PostgreSQL/concurrency, pinned Chromium/full authenticated operations, extension runtime and all actual true200 states, natural World cadence, repeated decoded media, current-main/hosted/player/advisor reconciliation, whole-branch review and deployment/runtime gates remain pending Root. This review does not turn source coverage or local PGlite/Chromium153 evidence into those passes.

**Assessment:** The production I1 repair is bounded and directly tested through the previously missing response boundary. The I2 helper substantially meets the intended coverage design, but F1 is a concrete new test-source failure that must be repaired before the scoped source gate can be approved.
