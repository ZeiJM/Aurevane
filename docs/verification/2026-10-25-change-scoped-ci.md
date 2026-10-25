# Change-scoped CI implementation

Status: implementation prepared for [PR #976](https://github.com/ZeiJM/Aurevane/pull/976), reconciled with main `0af25cf982172aa870edef5ec08ed5b5e4ad4ba6`; rollout requires hosted CI and merge. PR #979's source/checks are untouched. This changes CI policy, not the application release, hosted configuration, data or deployment lock.

## Coverage and duplication audit

The planner retains entry/session persistence, navigation, a real legal server-committed Move and image decoding as core. It selects known feature coverage and defaults to full on shared/sensitive/unmapped paths, new executable paths, deletions or uncertain comparisons. Three original Chromium projects remain. Existing independent repeat-two authority and Edge cases are retained; specialized workflows and their distinct database/entitlement contexts remain.

`node .github/scripts/audit-browser-verification.mjs 0af25cf982172aa870edef5ec08ed5b5e4ad4ba6 /tmp/av-ci-coverage-audit.json` performs real Playwright collection without starting servers or a database. It confirms 645 full entries (642 original plus three image cases), all 98 former focused battle entries and nine former password/training entries contained in that same full file/title/location/project set. These 107 redundant invocations are removed from full mode, preserving their assertions and projects. The selected native examples are artwork 21, Audio 24 and battle/character 351; docs 0, shared/unknown 645. No hosted timing improvement is claimed yet.

## Required results and merge reuse

The final result jobs retain Responsive browser smoke, Quality gates and Database foundation. They always run and fail on unsuccessful planning or required execution. Valid docs-only plans and explicit equal-tree reuse are the only no-execution outcomes. Immutable checkouts, source-bound gate proofs, read-only job-scoped GitHub API access, bounded requests and argv-based subprocesses avoid introducing a write-token or shell interpolation path.

Reuse requires a real merged PR, exact merge/head commits, identical trees, the same workflow's latest updated successful attempt on that head, a 24h freshness bound, and an uploaded receipt proving that exact attempt's actual checkout tree, repository and PR identity. Workflow-run head metadata alone cannot authorize reuse. A failed rerun of an older run ID overrides older positive evidence. Changed/missing/malformed/stale/in-progress/API-failure evidence falls back to full execution. The full manual workflow remains available, and unknown CI changes force full self-validation.

## Local evidence

- Planner, command selection, real Git rename/deletion handling, API fallbacks, rerun ordering, source proof binding, final-gate truth table and preserved screenshots have Node regressions. Initial safe full/no-reuse placeholders failed the positive scoped/reuse tests; incremental rerun-order, proof-binding, unknown-path and shared-consumer cases were separately reproduced red before repair. Final suite: 54 passed, 0 failed/skipped; `/tmp/av-ci-selector-final.log`. Actual CLI receipt creation/source refusal and real ZIP decoding are covered; the standard Ubuntu `zip`/`unzip` tools are used with bounded argv-based execution.
- Real YAML-to-CLI probes verify 18 success/skip/failure outcomes for all three required result names, including failed planning. Python YAML parsing checks planner/execution/final-gate dependencies, immutable checkout bindings and receipt artifact wiring; final evidence `/tmp/av-ci-workflow-contract-final.json`. This is local contract validation, not a claim of hosted workflow execution.
- The actual new Playwright image case passes all three Chromium projects against a local static public-image fixture; an absent-image negative probe fails as intended. `/tmp/av-ci-asset-runtime.json`. This does not establish authenticated-stack execution.
- The changed web test passes lint and complete web TypeScript. New Node CI scripts pass their own ESLint/format checks; central CI now checks these files because the original repository formatting command excludes `.github`.

Docker is unavailable locally, so the authenticated CI stack and changed full-run ordering still require real CI. The implementation's own full-fallback run must pass before rollout. No retries, timeouts, gameplay assertions or World timing thresholds were loosened, and no schedule or deployment was created.

## Independent final review

A fresh read-only whole-branch reviewer requested four material fixes: prove the actual synthetic PR checkout rather than infer it from head metadata; broaden shared skill-detail consumers; reject modified public configuration/server routes; and validate API completeness counts. Each issue was reproduced red, then repaired in one pass. All 54 Node regressions pass afterward; malformed/missing/expired/wrong-PR/wrong-attempt receipts and changed tested trees fall back to full execution. No material finding remains deferred. Hosted authenticated execution, actual branch-protection settings and wall-time improvement were not certified by the review.

## Platform references

- [GitHub job conditions and skipped-check reporting](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-jobs-with-conditions): the explicit final gates avoid treating a skipped needed execution as success.
- [GitHub workflow-run API](https://docs.github.com/en/rest/actions/workflow-runs): read-only run evidence for exact-head reuse; uncertainty triggers execution.

- [GitHub artifact API](https://docs.github.com/en/rest/actions/artifacts): read the exact successful attempt receipt; missing evidence cannot authorize reuse.
