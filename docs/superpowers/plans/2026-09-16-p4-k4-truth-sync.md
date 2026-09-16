# P4.K4 Truth Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile the Phase 4 task ledger and combat bible with the already-integrated K4 runtime/forecast truth without changing gameplay or publishing staged clone content.

**Architecture:** This is a documentation-only synchronization. `TASKS.md` will separate completed K4 engine/forecast slices from genuinely pending systems, while `docs/COMBAT.md` will record the player-facing Amplify/Curse forecast boundary and explicitly distinguish status cloning from the separate temporary-Skill `Copy` mechanic. No runtime, schema, catalog, balance, UI behavior, or deployment configuration changes are permitted.

**Tech Stack:** Markdown, GitHub pull-request workflow, existing repository CI.

**Spec:** `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md` and `docs/superpowers/specs/2026-09-12-combat-authoring-dots-copy-revision-design.md`

## Global Constraints

- Target only the shared integration branch `agent/combat-effect-taxonomy-rework`; never modify `main` in this ticket.
- Keep the mature-Skill publication guard `effects.status-copy-staged` intact.
- Do not define consecutive-use falloff for Amplify/Curse clone transfer; that Owner rule remains unresolved.
- Do not publish an Amplify/Curse Skill or the separate temporary-Skill `Copy` mechanic.
- Do not invent a Master Panel implementation where no current protected combat-content editor exists.
- Do not alter runtime code, tests, schemas, dependencies, balance values, catalogs, or deployment configuration.

---

### Task 1: Reconcile the Phase 4 task ledger

**Files:**
- Modify: `TASKS.md`

**Interfaces:**
- Consumes: current K4 implementation truth documented in `docs/COMBAT.md` and the approved K4 specifications.
- Produces: a task ledger that no longer conflates completed DoT/reaction/accuracy/Amplify-Curse slices with pending temporary-Skill Copy, Covert/Sensory/Revealed, Master Panel authoring, publication, and acceptance work.

- [ ] **Step 1: Replace the stale K4 mega-checkbox**

Replace only the existing unchecked line that groups “New DoTs, Copy, reactions, generalized accuracy, Amplify/Curse, Covert/Sensory/Revealed and Master Panel authoring” with explicit completed, pending, and blocked entries.

The completed entries must credit only landed runtime/kernel/forecast work and must not imply that staged content is published. Pending entries must keep temporary-Skill `Copy`, Covert/Sensory/Revealed, and the real protected Master Panel combat editor open. The blocked entry must retain `effects.status-copy-staged` until the Owner resolves consecutive-use clone falloff.

- [ ] **Step 2: Verify the ledger wording against current code/spec truth**

Confirm that the updated block distinguishes Amplify/Curse status cloning from temporary-Skill `Copy`, contains no deployment claim, and leaves the existing “Publish rebalanced immutable Discipline Skill versions” and end-to-end acceptance tasks open.

- [ ] **Step 3: Commit the ledger change**

Commit with a docs-only message such as `docs: reconcile K4 task ledger`.

### Task 2: Record the player-facing clone forecast boundary

**Files:**
- Modify: `docs/COMBAT.md`

**Interfaces:**
- Consumes: authoritative `copy-statuses` preview projections and the integrated battle-preview presentation behavior.
- Produces: canonical combat documentation that matches the merged player-facing K4 forecast slice without changing any mechanic.

- [ ] **Step 1: Add a dated K4 forecast section near the top of the combat bible**

Document that the shared battle preview humanizes authoritative `copy-statuses` projections for ordinary statuses, Poison, Burn, and ordered Bleed projections; keeps later damage/healing/resource projections visible; emits no clone forecast for an explicitly allowed empty clone block; and fails closed on malformed machine projection strings.

State that hit-chance/blocked behavior and server authority are unchanged, preview does not mutate state, and no hidden RNG is consumed.

- [ ] **Step 2: Preserve staged publication and terminology boundaries**

Explicitly state that Amplify/Curse status cloning is distinct from the separate `Copy` mechanic that grants a random temporary regular Skill at half AP cost. Keep `effects.status-copy-staged`, the unresolved consecutive-use clone-falloff rule, and unpublished clone Skills as later gates.

- [ ] **Step 3: Commit the combat-bible change**

Commit with a docs-only message such as `docs: record K4 clone forecast boundary`.

### Task 3: Verify and integrate the exact docs-only candidate

**Files:**
- Verify only: branch diff, pull request checks, review state, shared-head freshness.

**Interfaces:**
- Consumes: Tasks 1–2 commits.
- Produces: an exact tested docs-only merge into `agent/combat-effect-taxonomy-rework`.

- [ ] **Step 1: Inspect the exact base-to-head diff**

Require that the final candidate changes only `TASKS.md`, `docs/COMBAT.md`, and this implementation plan. Confirm no temporary workflow/helper file remains in the candidate tree.

- [ ] **Step 2: Run applicable repository validation**

Use the repository’s existing GitHub checks for the exact candidate. Any applicable required workflow must pass; correctly path-filtered workflows may skip.

- [ ] **Step 3: Open a PR to the shared integration branch**

Target `agent/combat-effect-taxonomy-rework`, never `main`, and describe the ticket as documentation-only truth synchronization.

- [ ] **Step 4: Recheck review/comments and branch freshness**

Confirm no unresolved review thread/comment blocks integration and that the shared target head has not moved. If it moved, reconcile before merge rather than overwriting concurrent work.

- [ ] **Step 5: Merge with exact-head protection and verify post-merge shared checks**

Merge only the exact green candidate, verify the merge parents/tree, and confirm the shared branch post-merge checks. Do not deploy or publish clone content.
