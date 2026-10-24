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

| Change | Development checks | Final verification |
| --- | --- | --- |
| Documentation only | Diff, content accuracy, referenced paths/links and applicable Markdown checks | Documentation checks; no gameplay/browser suite solely for prose |
| Isolated copy, image or local spacing | Applicable format/lint/types; affected asset loading, readability, containment and responsive states | Core smoke plus affected desktop/mobile checks |
| Shared shell, global styles or reusable UI | Above plus representative consumers, navigation, focus and accessibility | Expand across affected screens, breakpoints and modes |
| Battle controls or shared combat presentation | Relevant unit/integration and rendered interaction regressions | PvE/PvP/spectator coverage where shared, single-submit/input guards, AP/authority and historical readers as affected |
| Movement, combat rules, auth, persistence, dependencies or build configuration | Focused reproduction plus relevant negative, concurrent, retry and authority cases | Broader integration/regression coverage; full suite when impact is broad or uncertain |
| Large batch spanning systems | Focused checks per repair; combine stable repairs before final validation | Full applicable release suite on the final candidate |

Examples: isolated Audio spacing can omit detailed World travel and combat simulations from its development loop. A global CSS change cannot assume those screens are unaffected. A text change that changes targeting semantics or overflows a shared control needs more than a spelling check.

## 3. Small core smoke suite

For application changes, retain a short essential suite proving that the app opens, sign-in/session entry works, core navigation works, and a basic battle can load and accept one legal command. Add affected-feature checks separately. Keep server rejection/authority checks where the changed path can mutate state.

This is the target CI structure, not a claim that the current Browser Smoke workflow is already small. Inspect existing test commands and select actual cases before claiming this tier passes.

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

## 6. CI improvement implementation plan

- [ ] Inventory current workflows, selected tests, overlap, duration and shared mutable fixtures; distinguish configured project skips from failures.
- [ ] Define the actual core smoke selection and affected-feature groups from existing tests. Keep a conservative full-suite fallback for shared/unmapped changes.
- [ ] Remove duplicate executions only after proving equivalent assertions, browser/project/state coverage and setup assumptions remain covered elsewhere.
- [ ] Separate independent test groups into jobs where fixtures and database state permit isolation. Measure runner contention before increasing parallelism.
- [ ] Validate selection against representative local-only, shared-style, battle-control, movement/auth and docs-only diffs. Verify required-check reporting for skipped paths so merges do not hang or pass without intended coverage.
- [ ] Preserve full regression runs for broad release candidates and run periodic full-suite validation under a separately configured schedule. Creating or changing that schedule requires its own explicit task.
- [ ] Compare observed durations and failures before/after. Report measured results; do not promise an unverified turnaround time.

## 7. Current release boundary

PR #975 keeps its existing all-13 exact-head workflow requirement, tested-tree merge verification and one final production/no-preview requirement. Do not push this policy onto that active release branch just to record it, restart its retry, or weaken its gates. PR #933 stays separate and unmerged; a passing retry does not resolve its timing acceptance.

The policy and CI implementation checklist are separate: saving this document does not claim the workflow changes above are implemented.
