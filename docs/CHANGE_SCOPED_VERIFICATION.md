# AUREVANE — Change-scoped verification strategy

**Owner-approved direction:** 2026-10-24.
**Purpose:** Shorten update cycles by selecting relevant coverage before implementation and removing redundant work while preserving regression protection.
**Authority:** Engineering policy supplement to `ENGINEERING_EXECUTION_STANDARD.md` and `CONCURRENT_AGENT_WORKFLOW.md`. It changes future verification planning; it does not silently change configured CI requirements.

## 1. Plan verification before editing

Each task's plan or PR must record a short verification map:

- Changed behavior and files, including shared components, CSS, fixtures, services and transitive consumers.
- The core smoke checks and focused/adjacent tests selected, with actual commands or workflow names.
- Suites excluded from this task's development loop and the evidence that their behavior is unaffected.
- What broadens coverage, what must pass before merge/release, and any unavailable verification.

Select coverage from dependencies and risk, not just filenames or the size of the diff. Uncertain impact means broaden coverage. Avoid a new administrative document per tiny edit; a few lines in the existing task plan are enough.

## 2. Verification tiers

| Change                                                                         | Development checks                                                                                   | Final verification                                                                                                   |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Documentation only                                                             | Diff, content accuracy, referenced paths/links and applicable Markdown checks                        | Documentation checks; no gameplay/browser suite solely for prose                                                     |
| Isolated copy, image or local spacing                                          | Applicable format/lint/types; affected asset loading, readability, containment and responsive states | Core smoke plus affected desktop/mobile checks                                                                       |
| Shared shell, global styles or reusable UI                                     | Above plus representative consumers, navigation, focus and accessibility                             | Expand across affected screens, breakpoints and modes                                                                |
| Battle controls or shared combat presentation                                  | Relevant unit/integration and rendered interaction regressions                                       | PvE/PvP/spectator coverage where shared, single-submit/input guards, AP/authority and historical readers as affected |
| Movement, combat rules, auth, persistence, dependencies or build configuration | Focused reproduction plus relevant negative, concurrent, retry and authority cases                   | Broader integration/regression coverage; full suite when impact is broad or uncertain                                |
| Large batch spanning systems                                                   | Focused checks per repair; combine stable repairs before final validation                            | Full applicable release suite on the final candidate                                                                 |

Examples: isolated Audio spacing can omit detailed World travel and combat simulations from its development loop. A global CSS change cannot assume those screens are unaffected. A text change that changes targeting semantics or overflows a shared control needs more than a spelling check.

## 3. Small core smoke suite

For application changes, retain a short essential suite proving that the app opens, sign-in/session entry works, core navigation works, and a basic battle can load and accept one legal command. Add affected-feature checks separately. Keep server rejection/authority checks where the changed path can mutate state.

The implementation in PR #976 selects the existing `account-entry`, `loadout-navigation`, and `battle-move-preview-polish` specifications, plus the new public-image decoder. These retain entry/session persistence, real navigation, server-committed movement, AP/position persistence and image loading. It uses the unchanged desktop/laptop/mobile projects. The selection becomes active after the CI implementation merges; it does not retroactively alter already-running release jobs.

## 4. Development loop and release gate

1. During editing, run the failing regression and relevant adjacent tests first. Do not rerun every expensive suite after every spacing adjustment.
2. Once the patch stabilizes, run the planned final checks together. Run the full applicable suite for broad releases, shared-system changes or uncertain dependency impact.
3. Avoid repeating an identical check on unchanged source/environment when its evidence is still applicable. Source changes invalidate affected results; inspect their impact. An existing release requiring all checks on one exact head still requires fresh configured results.
4. Before merge, refresh main and reconcile overlaps. Before production, verify the intended source and tested result, and run the relevant deployment health checks.
5. Configured required checks remain mandatory until the workflow/rules are deliberately updated and reviewed. This policy does not authorize bypassing a red check or marking unrun coverage as passed.

`pnpm check` remains the repository-wide quality command. Use it for full-gate work; scoped development checks and documentation-only validation do not require repeating it after every edit.

## 5. Diagnose failures instead of deleting coverage

- Product regression: reproduce, make the smallest justified repair, and preserve a meaningful regression guard.
- Obsolete expectation after an intended behavior change: update the assertion to the approved behavior while retaining accessibility, legality and authority coverage.
- Environment or timing defect: retain logs/artifacts, correlate actual clocks and reproduce before changing the test. Preserve anti-teleport, route legality and server-authority requirements.
- One unchanged-source retry may be justified by specific transient evidence. Do not repeatedly rerun until green; recurrence requires diagnosis before another retry.
- Never loosen thresholds, add sleeps, skip a case or delete an assertion solely to unblock release. Any quarantine requires an explicit tracked defect, bounded scope, replacement protection and a resolution condition; it is not automatic permission to merge.
- A retry passing does not prove an unresolved intermittent defect is fixed.

## 6. Implemented CI selection

Browser Smoke plans before installing dependencies or starting a disposable database. Known local Audio/public-information changes select core plus their feature cases. Existing battle presentation and explicitly mapped character panels select combined battle/character coverage, production-component guards and the existing Edge input cases. Skill raster artwork selects core plus actual image decoding. Unknown file types, new executable paths, runtime deletions, global/shell/auth/presence/World/server/gameplay/persistence/dependency/build/CI changes and unrelated multi-system batches require the full suite. Shared identity/portrait/session and skill-detail readers used by Master, Manual or server code are outside the local panel allowlist. Public presentation accepts TSX/module CSS; unknown configuration and server routes use full coverage. Missing diff data broadens coverage; invalid paths or missing core specifications fail planning.

Full mode retains every native specification, all three Chromium projects, the independent repeat-two authoring/authority gate and the existing Edge cases. The former focused battle and password/training phases are already contained in that same full suite under the same local build/catalogue/configuration. A real Playwright discovery audit proves all 107 removed preliminary case/project invocations remain in the full set. No gameplay assertion, configured project skip, timeout, retry count or World timing threshold changed.

Measured discovery counts on the implementation:

| Example                       | Selected native entries | Additional checks                                     |
| ----------------------------- | ----------------------: | ----------------------------------------------------- |
| Documentation                 |                       0 | Planner/self-tests and explicit required results      |
| Skill raster artwork          |                      21 | Real changed-image decoding within core               |
| Isolated Audio workspace      |                      24 | Core plus Audio                                       |
| Battle/character presentation |                     351 | Existing component guards and Edge                    |
| Shared/unknown changes        |                     645 | Existing component guards, authority repeats and Edge |

The full set is the previous 642 entries plus three project entries for the new image decoder. These are discovery counts, not claimed execution times or a claim that intentionally skipped project cases ran. Existing specialized workflows keep their paths, environments and authority checks. Browser runs remain serial because they share the local database; no unmeasured concurrency increase or new periodic schedule is introduced. `workflow_dispatch` on Browser Smoke runs the full suite for a final/broad candidate. A `ci:full` label can only broaden the next PR-triggered plan; adding the label alone does not start a run.

Central CI still owns full application quality and database authority for application changes. Desktop page fit omits its identical PR format/lint/types/unit invocations, since central CI runs those same commands against the same immutable event SHA; its manual dispatch retains all standalone quality steps. Other specialist overlap is retained where fixtures, policy/entitlement flags or authority coverage differ.

## 7. Reuse and required-check reporting

Browser Smoke and central CI always report their existing required result names, including documentation-only changes. The final result requires successful planning and successful selected execution. Unexpected skipped, failed, cancelled or missing execution fails the result. An intentionally omitted execution must be an explicit documentation-only plan or a verified reuse proof; unrun full coverage is never labelled as executed.

On a main push, reuse requires an actual merged PR association, exact merge/head commit and equal trees, the same workflow's most recently updated attempt on that exact head, successful completion and evidence within 24 hours. A rerun of an older run ID can invalidate a newer-created success. The successful PR final gate uploads a small receipt bound to its actual checked-out SHA/tree, repository, PR number, workflow, run and attempt. Main reads the matching receipt and requires its tested tree to equal the merge tree; workflow `head_sha` alone is insufficient. Missing/expired/wrong-attempt receipts and incomplete API counts force full execution. Download/extraction sizes and time are bounded, and ZIP entries are streamed without filesystem extraction. The proof is also bound to the final main gate's actual checked-out SHA/tree. Different source, direct pushes, stale/failed/in-progress evidence, truncated or malformed API data and read failures run the full checks instead. GitHub access is read-only and limited to the planner job, with bounded requests. No production credentials are involved.

Commands and evidence: `node --test .github/scripts/*verification*.test.mjs`; `node .github/scripts/audit-browser-verification.mjs <pre-change-SHA> <output.json>`. Implementation/review/validation receipt: [2026-10-25 change-scoped CI](verification/2026-10-25-change-scoped-ci.md). Observed hosted durations must be measured after rollout before promising a turnaround time.

## 8. Current release boundary

PR #975's historical all-13 gate is not changed retroactively. PR #979 is merged and live as main `14df01a2`; its tested source is retained. PR #976's final candidate includes the Owner's subsequent mobile Chronicle/rail spacing refinements, verified through the shared battle authorities. The CI implementation itself receives full fallback because it changes workflows and selection logic; no app deployment is needed. PR #933 stays separate and unmerged; passing an ordinary run does not resolve its timing acceptance. Tested-tree/source verification and the one-final-production/no-preview rule remain.

Until PR #976 merges, existing main workflows remain active. A reviewed implementation on a PR is not a claim of completed rollout or a passing hosted run.
