# Change-scoped CI Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline with one fresh final review.

**Goal:** Replace unconditional broad browser runs with core plus affected coverage, and reuse identical successful PR validation after merge.

**Architecture:** A dependency-free Node planner classifies the complete Git diff with conservative fallbacks and verifies merge reuse through the read-only GitHub API. Browser command construction consumes a validated plan; workflow final gates keep existing required names and reject failed planning/execution. Central CI keeps its full quality/database coverage for application changes.

**Tech Stack:** GitHub Actions YAML, Node24, node:test, Playwright discovery, existing local Supabase browser setup.

**Spec:** `docs/superpowers/specs/2026-10-25-change-scoped-ci-design.md`

## Global constraints

- Preserve PR #979's verified live source as baseline; PR #933 remains separate/unmerged.
- No test assertion/timeout/retry reductions, new schedules, production/data/env changes or Vercel previews. CI-only changes do not deploy; the appended Owner-requested mobile UI refinements require one final production release after configured gates and exact tested-tree merge verification.
- All unknown/shared/backend/dependency/CI changes use full coverage; API uncertainty cannot authorize reuse.
- Keep required result names and fail closed when a planner or selected execution fails.

## Review focus

- Deleted/renamed/mixed files, non-code-looking configuration and unmapped paths cannot evade broad coverage.
- A later failure/queued attempt invalidates an older success; source/tree/workflow/event/freshness must all match before reuse.
- Docs-only required checks resolve explicitly; failed/missing plans and skipped needed jobs cannot report success.
- Every selected native spec retains its original project matrix; full mode includes all existing specs and required independent repeats/Edge cases.
- No untrusted filename/event/JSON value is interpolated into shell code or authenticated external URLs.

### Task 1: Planner, reuse proof and required gate

Files: `.github/scripts/verification-plan.mjs`, `.github/scripts/verification-plan.test.mjs`, `.github/actions/verification-plan/action.yml`.

- [x] Write failing tests for docs, isolated feature/artwork, related battle+character, global/unknown/backend/World/CI/multi-system changes; additions/deletions/renames and malformed comparison data.
- [x] Implement classification from all changed paths, immutable source/tree metadata and a versioned JSON plan.
- [x] Test reuse with actual merged association, identical trees, exact/latest successful workflow,24h freshness, error/failed/queued/stale/missing-data fallback. Implement read-only API adapter and Git CLI using argv.
- [x] Test final-gate truth table: execution required succeeds only with successful execution; no-work requires a valid docs/reuse proof. Integrate the composite planner outputs.

### Task 2: Browser selection and duplicate removal

Files: `.github/scripts/run-browser-verification.mjs`/test, `apps/web/e2e/ci-changed-assets.pw.ts`, `.github/workflows/browser-smoke.yml`.

- [x] Test command lists: core always present for application changes; affected groups unioned/deduplicated; full mode preserves all specs, independent authority repeats and Edge; shell:false argv and invalid plans rejected.
- [x] Implement selected native/component commands under the existing build/catalogue/Supabase setup. Add changed Skill raster decoding without changing existing gameplay cases.
- [x] Compare real Playwright discovery against old full/focused test identities and report counts, proving removed preliminary executions are duplicates with the same projects.
- [x] Wire immutable plan/execution/always-running final-gate jobs, unchanged required name and explicit summaries/artifacts; manual dispatch forces full.

### Task 3: Central quality reuse, policy and publication

Files: `.github/workflows/ci.yml`, `.github/workflows/desktop-page-fit.yml`, `docs/CHANGE_SCOPED_VERIFICATION.md`, linked engineering policy docs and a verification receipt.

- [x] Keep central quality/database assertions; reuse only verified identical successful PR results on main, retaining always-running required result names.
- [x] Remove duplicate PR-only Desktop page fit format/lint/type/unit steps by relying on the identical central CI commands; preserve them for standalone manual dispatch.
- [x] Validate workflow/YAML gate and trigger contracts, run Node tests and actual browser discovery, review the final diff independently and fix any material finding with regression coverage.
- [x] Update policy/checklist with actual implementation, conservative limits and measured selection counts.
- [x] Prepare the protected PR #976 update against refreshed main, with final local verification and independent-review fixes.
- [ ] Rollout gate: hosted full-fallback CI must pass and PR #976 must merge. Verify CI starts after publication, then pause continuous monitoring. The combined mobile UI follow-up requires one final production release after these gates.

Current candidate extension: the Owner subsequently requested mobile log/preview takeover, preview-funded effect-rail spacing with battlefield preservation, matching gold toggles and matching reduced action-breakdown type. Scope and focused/final evidence: `docs/verification/2026-10-25-mobile-log-rail-spacing.md`. These are composed on the live PR #979 baseline with the unchanged reviewed CI implementation so the final bootstrap candidate is validated once.
