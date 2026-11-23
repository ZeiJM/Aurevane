# Task13 fix2 scoped re-review — 2026-10-25

**Spec compliance: ✅ Compliant within the scoped F1/I2 repair and current-main reconciliation. Task quality: Approved. F1/I2: ADDRESSED at the source gate. Counts: 0 Critical, 0 Important, 0 new Minor.** I1 remains addressed. The inherited M1 remains deferred for final whole-branch triage and is not closed by this verdict.

Reviewed base `a5a6dd8ca43e898714e4f126d7755bcd8f551cb8`, tree `9b377582dd5b7ca49af2acd35c9727f88c4ba1a3`, equivalent to the last reviewed b774 tree; frozen head `dda552b93dd02b01417033574e97d6d6e81511ad`, tree `05f23a197d8b1cf9e0b64472767ef445ea66e575`. Root reports zero-diff fetched backup `0fe5088d4c20a92b95912b64a8bbf0858b65956f` and actual-main `ff4467ed7284b7c2497caf4df6dff6669043ca39` ancestry. The lost unbacked7b patch and its missing artifacts were not treated as evidence. This is the same seat's first and only round2 review.

Repository paths below are relative to `/workspace/scratch/e5db2ba73c1a/aurevane-master-complete-20261025`.

## F1/I2 disposition

`apps/web/e2e/master-zoom-workflows.ts:4–9` now resolves the exact Refresh player button's nearest ancestor section. The Players branch at `:235–238` explicitly requires one matching card before its protected-facts assertion and the existing real200 state/geometry checks. It does not select an arbitrary first match, weaken the assertion or alter the extension zoom mechanism.

The regression uses the same exported locator in `apps/web/scripts/master-operations-browser-regression.mjs:116–119,170–229`. It mounts production `MasterPanelShell` and `PlayersWorkspace` together through the expanded operational harness, while explicitly controlling only the HTTP/identity/frame boundaries (`apps/web/e2e/fixtures/master-operations-harness.jsx:3,18–48,73–89,140–170`). It proves that the old descendant filter matches two sections, the new locator matches one, the result has the real shell ancestor but excludes shell navigation and the Find a player section, and the target heading/protected facts remain inside it. Keyboard Refresh produces a second read and retains uniqueness.

Fresh RED reproduces `2 !== 1` at the intended card-count assertion. Fresh GREEN passes at1366×768 and390×844 on newly acquired Chromium153. The measured card client/scroll widths are1321/1321 and345/345. The inspected390px screenshot agrees with the real nested DOM. This closes the concrete source failure identified in fix1 and supplies the requested narrow regression. The existing operational CI command runs the new Players case by default; the focused development flag did not replace that default execution.

The previously reviewed real200 workflow coverage remains intact. I2's remaining source blocker was F1, now repaired. Actual pinned/authenticated/true200 execution is still a separate pending Root gate, not inferred from this local ordinary-browser proof.

## Current-main integration findings

No new blocking or Minor issue was found in the five integration joins against released main.

- **Full-mode native execution is retained.** `.github/scripts/run-browser-verification.mjs:7–14,49–69` includes the complete Master layout and natural World cadence specifications in the six-spec authority group, runs that group on desktop Chromium with `--repeat-each=2`, runs the unfiltered full Chromium suite with the existing configured projects, then runs the existing Edge cases. The removed preliminary focused/password/training phases are not reintroduced. This follows the approved `docs/CHANGE_SCOPED_VERIFICATION.md` full-mode contract rather than the superseded invocation sequence.
- **The broad candidate selects the required component checks.** The accepted planner's full result sets `battle:true` and `edge:true` (`.github/scripts/verification-plan.mjs:94–102`), and manual dispatch forces full (`:448–450`). The merged workflow uses that output for Master operational/eligibility/Event/Nexus checks and the SQL-backed Original regression (`.github/workflows/browser-smoke.yml:80–91,117–123`). It invokes the selected native runner after the local build/catalogue setup (`:195–203`). The required-result job still consumes the plan/execution outcome and produces the exact tested-source receipt (`:407–434`); the reconciliation does not bypass it.
- **Master evidence survives phase changes.** `.github/scripts/run-browser-verification.mjs:76–102,139–149` copies complete Master-layout/World-cadence result directories, including attachments/traces/JSON, into separate phase directories after each invocation and before the next can clear its output. Edge reads its own output directory. The new regression at `run-browser-verification.test.mjs:109–141` verifies distinct authority/full payloads after deleting the original results between phases. The workflow uploads the retained hierarchy (`browser-smoke.yml:368–382`).
- **Physical authority remains executable.** `.github/workflows/ci.yml:188–189` retains Event emergency settlement lock-order/rollback verification alongside main's central-CI structure. The combat catalogue PostgreSQL concurrency gate remains configured at `:373–374`; central quality still runs `pnpm check` at `:89`. This review does not claim those gates have executed on the frozen candidate.
- **The World test join is additive.** `apps/web/src/components/world/map-renderer.test.ts:1278–1296` retains the configured-cycle/night-tint test alongside released main's receipt-clock renderer tests. The affected206-test receipt passes. A focused compatibility read of the incoming renderer clock hunk shows that it changes monotonic animation-frame sampling, not the authoritative environment value consumed by the Task13 panel/cadence assertions; no incompatible environment interpolation was introduced by this join.

The wiring receipt reports all28 non-overlap paths among main's33 changed paths preserved byte-for-byte, full/components selected, three native phases,16 authority case/project entries and repeatEach2 configured. The actual discovery audit retains all107 retired preliminary entries inside the660-entry full set. These are source/discovery facts, not32 executed authority repeats or660 executed browser cases. Accepted incoming CI policy, mobile Chronicle/rail styling and World implementation were not independently re-audited as new features in this scoped review.

## Issues and carried item

- Critical: none.
- Important: none.
- New Minor: none.
- **Inherited M1, still open/deferred:** ordinary stored-history restoration of a System-derived publication can display Unknown authorship while retaining the physical source/mechanics. Its unchanged SQL/history chain was outside this repair scope. Carry the original finding into the final whole-branch triage.

## Checks performed and evidence boundaries

- Read the handoff, fix2 brief/recovery requirements, appended report and approved change-scoped policy. Read the focused task/join diff in bounded chunks; the complete source-range package was available for the named incoming World-clock compatibility check. The focused package is68224 bytes, SHA256 `423083dbf7a111877339128c52816e6aaa8d754585736f4e96829f38f2ad8b9f`; complete source package is325369 bytes, SHA256 `e73972101c84a8c2012ff2417f6a84614c1157893f3e54c872c39abb7b3a896b`.
- Verified every raw/gzip hash for the17 fresh recovery receipts. Inspected the actual F1 RED/GREEN, runner/planner, final runner, affected World, wiring, environment and integrity output. The evidence supports55 passing Node planner/runner cases,7 final runner cases and206 affected World tests, with no skipped cases in the Node summaries. Failed browser installation/audit/lint attempts remain failed; later covering results are distinct.
- Verified all9 fresh browser artifact sizes/hashes totaling1576930 bytes and inspected the390px nesting screenshot plus both final card metrics. Verified the preserved545321-byte ledger prefix SHA256 `0ccd1448a9fab7ce92335e4662485038f6e1a5ce9e52a9a71c1488eb98c76f1b`, and final560710-byte ledger SHA256 `d13e384cc71b2f582536df653f9cba08be6f4ad9246ea6de1d55b0bbfdb2ee6d`.
- Context reads outside focused hunks were limited to named integration risks: full-mode planner/component flag and runner/required-result wiring; the incoming renderer receipt-clock change versus the existing environment reader. No broad review of accepted main, no unchanged passing suite rerun, no helper agent, and no source/index/HEAD/ref/remote/hosted mutation was performed.

## Remaining Root gates

This approves the scoped source repair/reconciliation only. Final candidate repository quality, configured native required checks, physical PostgreSQL blocking/rollback and media/Tag/original lifecycle, full authenticated pinned-browser workflows, genuine200 measurements/interactions, natural World cadence/expiry, decoded media/repetition, and exact current-hosted/main/player/advisor reconciliation remain mandatory. The failed pinned151 download and unavailable Docker/psql remain environment limits; local Chromium153 and PGlite/source/discovery evidence do not substitute for them. The separate whole-branch review—including M1 triage—must precede the authorized migration/release/runtime confirmation. No Master hosted application or deployment is claimed here.
