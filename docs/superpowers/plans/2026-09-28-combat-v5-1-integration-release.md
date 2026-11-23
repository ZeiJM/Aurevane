# Combat v5.1 Integration & Release Verification Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the four Combat v5.1 workstreams into one exact-head verified branch, deliberately reconcile draft PR #755 overlap, and stop at the owner-controlled merge/deploy boundary.

**Architecture:** Execute the UI/performance plan first, then Technique balance/targeting, summons, and Resonance. Each phase must remain green before the next begins. Final verification compares the completed branch with both current `main` and draft #755, with no silent cherry-picks or semantic regressions.

**Tech Stack:** GitHub, pnpm/Turborepo, Vitest, Playwright, Next.js, Vercel release gate (locked unless later authorized).

**Spec:** `docs/superpowers/specs/2026-09-28-combat-v5-1-targeting-summons-resonance-design.md`

**Component Plans:**
- `docs/superpowers/plans/2026-09-28-combat-v5-1-ui-performance.md`
- `docs/superpowers/plans/2026-09-28-combat-v5-1-technique-balance.md`
- `docs/superpowers/plans/2026-09-28-combat-v5-1-summons.md`
- `docs/superpowers/plans/2026-09-28-combat-v5-1-resonance.md`

## Global Constraints

- Work only on `agent/combat-v5-1-rebalance-summons-resonance-20260928`; never implement directly on `main`.
- Historical Combat v5 and earlier definitions remain immutable.
- Existing battle snapshots keep pinned content versions.
- Draft PR #755 is not absorbed, reset, or modified silently.
- Vercel deployment remains locked.
- No merge or Production deployment without explicit owner authorization after final verification.

## Review Focus

- Cross-plan type changes must not create circular imports or incompatible serialized battle/content shapes.
- Current-vs-historical version resolution must remain correct after adding v5.1 definitions.
- Summon runtime additions must survive persistence/reload and validation.
- Resonance v2 compatibility must preserve v1 historical event semantics.
- UI compact summaries must match newly rebalanced/current definitions rather than stale v5 content.

---

### Task 1: Execute plans in dependency order

**Files:**
- Follow the four component plans listed above.

**Interfaces:**
- UI plan provides compact-effect renderer used by Resonance preview.
- Technique plan provides current v5.1 validation tag/balance semantics used by summon parent Skills and current content.
- Summon plan extends combat effect/content/runtime types before current Resonance/result validation is finalized.
- Resonance plan consumes shared compact-effect presentation and current effect validation.

- [ ] **Step 1: Complete UI/performance plan and run its quality gates.**
- [ ] **Step 2: Complete Technique balance/targeting plan and run its quality gates.**
- [ ] **Step 3: Complete summon plan and run its quality gates.**
- [ ] **Step 4: Complete Resonance plan and run its quality gates.**
- [ ] **Step 5: Re-run `pnpm format:check` before integration-only work.**

Expected: no known red focused suites before final reconciliation.

---

### Task 2: Historical/current content boundary audit

**Files:**
- Modify tests only unless an audit failure exposes implementation defects.
- Test: `packages/game-core/src/combat/mature-skills.test.ts`
- Test: `packages/game-core/src/combat/resonance.test.ts`
- Test: `apps/web/src/server/combat/combat-content-resolver.test.ts`
- Test: battle persistence/publication consumption suites.

- [ ] **Step 1: Add/confirm contracts that current character/Nexus resolution chooses newest v5.1 Skill/Essence/Resonance definitions.**
- [ ] **Step 2: Add/confirm contracts that pinned v5 battles resolve exact v5 versions and do not inherit v5.1 targeting/summon/Resonance semantics.**
- [ ] **Step 3: Add/confirm loadout persistence retains learned historical entitlement version facts.**
- [ ] **Step 4: Run the focused resolver/persistence suites.**

Run:
`pnpm --filter @aurevane/game-core test`

Run:
`pnpm --filter @aurevane/web exec vitest run src/server/combat/combat-content-resolver.test.ts src/server/battle/combat-content-publication-consumption.test.ts`

Expected: pass.

---

### Task 3: Explicit #755 semantic overlap review

**Files:**
- No writes to PR #755.
- Current v5.1 branch files likely overlapping #755 include combat effect state/runtime/action economy/status/DOT/damage modifier presentation files.

- [ ] **Step 1: Fetch live #755 head and current main; do not trust the handover SHA.**
- [ ] **Step 2: List current v5.1 vs #755 overlapping files.**
- [ ] **Step 3: For each overlap, classify semantics into: compatible additive, conflict requiring later #755 redesign, or superseded current-v5.1 assumption.**
- [ ] **Step 4: Verify v5.1 does not accidentally import #755's unbounded application/rules-version behavior.**
- [ ] **Step 5: Record the overlap in a concise checklist/doc update before merge consideration.**

Expected: v5.1 remains independently correct; #755 can be reconciled later as its own workstream.

---

### Task 4: Full local/package verification

**Files:**
- No production changes unless failures reveal defects.

- [ ] **Step 1: Format check**

Run:
`pnpm format:check`

Expected: zero formatting failures.

- [ ] **Step 2: Lint**

Run:
`pnpm lint`

Expected: zero errors/warnings.

- [ ] **Step 3: Typecheck**

Run:
`pnpm typecheck`

Expected: zero type errors.

- [ ] **Step 4: Full unit/integration tests**

Run:
`pnpm test`

Expected: all tests pass.

- [ ] **Step 5: Production build**

Run:
`pnpm build`

Expected: exit 0.

---

### Task 5: Browser and representative gameplay verification

**Files:**
- Browser tests from component plans and existing critical suites.

- [ ] **Step 1: Run authenticated Nexus/Discipline/Technique browser proofs** using `character-primary-build.pw.ts`, `character-secondary-build.pw.ts`, `technique-preview-layout.pw.ts`, and `nexus-technique-alignment.pw.ts`.
- [ ] **Step 2: Run representative buildcraft** using `p3-8-representative-buildcraft.pw.ts`.
- [ ] **Step 3: Run `summon-battle-flow.pw.ts`** proving empty-tile spawn → no same-round turn → next-round summon AI turn → at most one authored ability → Inspect metadata → defeat/5-turn expiry cleanup.
- [ ] **Step 4: Run `resonance-v5-1.pw.ts`** proving one sequence Resonance and one immediate Resonance activate with Setup / Trigger / Result presentation.
- [ ] **Step 5: Run responsive/mobile proofs** for Technique modal and Attunement hover/focus with no horizontal overflow.

Expected: all selected browser suites pass without console/runtime errors.

---

### Task 6: PR and exact-head workflow gate

**Files:**
- Create/update one PR from the v5.1 branch to current `main`.
- Update design/checklist docs only as needed to record final state.

- [ ] **Step 1: Re-fetch current `main` immediately before opening/updating the PR.**
- [ ] **Step 2: Compare branch to main and inspect any new concurrent overlap.**
- [ ] **Step 3: Open/update PR with clear v5.1 scope and #755 boundary.**
- [ ] **Step 4: Require exact-head GitHub workflow matrix to complete.**
- [ ] **Step 5: Inspect every failed job by exact job/step/log; fix root cause only, then repeat exact-head verification.**
- [ ] **Step 6: Do not claim completion until the exact PR head is green across required jobs.**

---

### Task 7: Stop at release-control boundary

- [ ] **Step 1: Report exact PR head, main SHA, mergeability, workflow status, and #755 overlap state.**
- [ ] **Step 2: Keep Vercel deployment gate locked.**
- [ ] **Step 3: Wait for explicit owner merge authorization.**
- [ ] **Step 4: If merge is later authorized, revalidate live head/main/checks immediately before merge.**
- [ ] **Step 5: Production deployment remains a separate explicit authorization after merge.**
