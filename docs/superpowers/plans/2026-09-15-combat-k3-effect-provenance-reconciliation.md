# Combat K3 Effect Provenance Reconciliation Plan

> **For agentic workers:** Use the approved Superpowers/TDD workflow. Do not revive obsolete K3-A/K3-B staging history; PR #478 is the authoritative merged K3 foundation.

**Goal:** Finish the genuinely outstanding K3-C effect-instance/persistent provenance work on top of the live shared combat branch before continuing new persistent/reactive K4 primitives.

**Live base at reconciliation:** `agent/combat-effect-taxonomy-rework` @ `25f8514a9cc7c459380abaa3648bfac583d6b488`.

## Reconciled authority

- PR #478 already merged K3-A/K3-B: versioned 16-stage pipeline, trigger safety, optional command provenance, and the current E2E compatibility fixes.
- PR #471 and PR #480 are obsolete staging PRs and are closed as superseded.
- PR #474 was already closed as superseded by #478.
- PR #481 was superseded and closed after its unique K3-C work was reconciled onto this live-base branch.
- This branch carries forward only K3-C's unique effect provenance work against the current live base.

## Global constraints

- No combat number, AP/MP, targeting, accuracy, DoT, duration, roster, or UX changes.
- Historical persistent effect/status rows may omit K3 provenance.
- Present provenance must fail closed when malformed.
- New opted-in K3 resolution contexts should annotate newly created persistent effect rows without forking the legacy resolver.
- Preserve K3 trigger-chain safety and immutable command provenance.
- No deployment.

### Task 1 — Reconcile verified effect-instance identity foundation

- [x] Port the previously GREEN `CombatEffectInstanceProvenance` branded identity, deterministic builder, and validator into the live K3 kernel types.
- [x] Port the dedicated four-test effect-instance provenance contract.
- [x] Reverify on the current live base together with Task 2 RED.

### Task 2 — Persistent provenance compatibility and validation

- [x] Port and strengthen the historical-compatibility RED contract across status, recovery, Poison, Bleed, and Burn.
- [x] Verify RED: historical rows without provenance remained valid while exactly five malformed-present-provenance cases failed; 1,228 existing game-core tests passed and format/lint/typecheck were green.
- [x] Add optional `provenance?: CombatEffectInstanceProvenance` to persistent status/recovery/Poison/Bleed/Burn rows.
- [x] Validate provenance whenever present without changing the encounter schema version.
- [x] Run focused tests, game-core typecheck, surgical diff validation, and complete `pnpm check`.

**Task-2 GREEN:** `5be765c0f9afe09f73db9c6bbf1a14316aabf670`. Production delta is exactly `actions-legacy.ts` and `combat-effect-state.ts`.

### Task 3 — Thread provenance into newly created persistent effects

- [ ] Verify the staged RED contract for apply-status, Poison, Bleed, Burn, and scheduled recovery under an explicit `CombatResolutionContext`.
- [ ] Assert legacy four-argument execution still produces historical state without new provenance fields.
- [ ] Add one post-resolution provenance enricher; do not duplicate effect resolution.
- [ ] Use action effect index as `effectOrdinal` and the pre-command round/turn for creation coordinates.
- [ ] Reapplication receives fresh provenance; copied/inherited lineage fields remain reserved for later Copy/Mirror mechanics.
- [ ] Verify immutability of input state, command provenance, and trigger guard.

The Task-3 test contract is staged and repository-formatted at `534f53a90e3593063eacaa5c5e6f202d3920031b`; production threading remains intentionally absent until behavior-only RED is observed.

### Task 4 — K3 documentation and final integration

- [ ] Document persistent provenance compatibility and the K3 boundary without claiming K4 mechanics exist.
- [ ] Re-fetch `main` and the shared combat branch immediately before integration.
- [ ] Require exact-head CI / Database foundation / Skill Engine / Representative Buildcraft / Browser Smoke.
- [ ] Review final diff for behavior preservation and historical compatibility.
- [ ] Merge to `agent/combat-effect-taxonomy-rework` only after all exact-head gates are green.

### Task 5 — Resume K4 from the integrated K3-C head

- [ ] Rebase/reconcile PR #487 Barrier onto the K3-C shared merge so Barrier instances can participate in the same provenance model rather than inventing a competing one.
- [ ] Reconcile existing concurrent K4 PRs (#483 damage history, #486 Absorb HP, #488 Absorb MP) against the final shared ordering before merging any of them.
- [ ] Continue remaining K4 primitives in small TDD tickets; no deployment.
