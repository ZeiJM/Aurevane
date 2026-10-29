# Master operational continuation implementation plan

> **For agentic workers:** Use superpowers:executing-plans for inline implementation, followed by one whole-branch review.

**Goal:** Finish the authorized Master Panel batch and release it for Owner testing.
**Architecture:** Retain the checkpoint and validated authoring APIs. New relationship drafts remain independent until their own Commit succeeds; changed associations are checked against current child publications before parent submission. Targeted replacement preserves other recovered edits. SQL remains authoritative.
**Tech Stack:** Next.js, React, TypeScript, Vitest, PGlite, native GitHub browser workflows.
**Spec:** `docs/superpowers/specs/2026-10-27-master-panel-workspace-design.md`, current October 29 handover/checklist and Owner continuation instruction.

## Global constraints

- Master Panel operational defects and requested UI refinements precede unrelated World/P5 work.
- Preserve local edits, selected characters, progression, immutable captures and prior live repairs.
- No weakened relationship validation, duplicate publication or deployment Preview.
- All configured checks must pass on the actual published revision; one final Production build and explicit promotion.

## Review focus

- Closing a new power without Commit leaves the Discipline usable and the draft recoverable.
- Missing, disabled, unpublished and wrong-source recovered references require targeted repair.
- Child success followed by parent failure is retryable without losing newer parent edits.
- Changed relationship checks must not alter historical references or publish children implicitly.
- Pending file uploads remain guarded across tabs, record switches and modal close/reopen.

### Task 1: Relationship lifecycle and recovery

**Files:** workspace, relationship list and relationship creation helper; their interaction/unit tests.
**Interfaces:** creation opens an unattached draft; related Commit attaches only the reviewed slot. Changed-association validation consumes current child records and returns an actionable error, without mutations.

- [ ] Add failing production callback regressions for create/close, child-first attach, missing/draft/disabled/wrong-source selections and preservation of unrelated edits.
- [ ] Run focused tests and confirm expected failures.
- [ ] Implement deferred attachment, current-child preflight and targeted Change recovery.
- [ ] Run relationship/workspace/media adjacent tests and types/lint.

### Task 2: Combined candidate verification and review

**Files:** existing verification receipt, native authoring fixtures/scripts where relevant.
**Interfaces:** consume Task 1 and the saved media/UI/test checkpoint unchanged unless a regression requires repair.

- [ ] Verify checklist coverage, actual content publication/read/game-consumer tests and rendered desktop/mobile workflows through configured native CI.
- [ ] Run full `pnpm check` once stable; inspect all results and full task diff.
- [ ] Obtain one independent whole-branch review; fix important findings with regressions.
- [ ] Refresh main, publish coherent PR #988 head, require all configured checks.

### Task 3: Authorized release

**Files:** existing release receipt/authority documentation.
**Interfaces:** tested exact tree, refreshed Vercel routing/project state and freshly bound Field Remedy publication.

- [ ] Merge with expected-head protection after required greens; compare application tree.
- [ ] Create one Production candidate from merged source, verify READY/source, compatible routing and explicit promotion.
- [ ] Publish Field Remedy through current guarded APIs and verify exact readback/history.
- [ ] Verify canonical source, public/protected routes, audio and bounded runtime errors; report actual remaining acceptance.

Verification map: focused relationship/workspace/media Vitest, all-migrations DB authoring/media tests, web types/lint/format; final repository `pnpm check` and every configured exact-head workflow. No broad suite exclusion at release because this checkpoint spans shared UI, gameplay readers and persistence.
