# Combat K3 Effect Provenance Reconciliation Plan

> **For agentic workers:** Use the approved Superpowers/TDD workflow. Do not revive obsolete K3-A/K3-B staging history; PR #478 is the authoritative merged K3 foundation.

**Goal:** Finish the genuinely outstanding K3-C effect-instance/persistent provenance work on top of the live shared combat branch before continuing new persistent/reactive K4 primitives.

**Live base at reconciliation:** `agent/combat-effect-taxonomy-rework` @ `25f8514a9cc7c459380abaa3648bfac583d6b488`.

## Reconciled authority

- PR #478 already merged K3-A/K3-B: versioned 16-stage pipeline, trigger safety, optional command provenance, and the current E2E compatibility fixes.
- PR #471 and PR #480 are obsolete staging PRs and are closed as superseded.
- PR #474 was already closed as superseded by #478.
- PR #481 contains unique K3-C work but is stacked on obsolete history and is not safe to merge directly.
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
- [ ] Reverify on the current live base together with Task 2 RED.

### Task 2 — Persistent provenance compatibility and validation

- [x] Port the historical-compatibility RED contract.
- [ ] Verify RED: historical rows without provenance remain valid; malformed present provenance fails because persistent validation is not implemented yet.
- [ ] Add optional `provenance?: CombatEffectInstanceProvenance` to persistent status/recovery/Poison/Bleed/Burn rows.
- [ ] Validate provenance whenever present without changing the encounter schema version.
- [ ] Run focused tests, game-core typecheck, and complete `pnpm check`.

### Task 3 — Thread provenance into newly created persistent effects

- [ ] RED tests for apply-status, Poison, Bleed, Burn, and scheduled recovery under an explicit `CombatResolutionContext`.
- [ ] Assert legacy four-argument execution still produces historical state without new provenance fields.
- [ ] Add one post-resolution provenance enricher; do not duplicate effect resolution.
- [ ] Use action effect index as `effectOrdinal` and the pre-command round/turn for creation coordinates.
- [ ] Reapplication receives fresh provenance; copied/inherited lineage fields remain reserved for later Copy/Mirror mechanics.
- [ ] Verify immutability of input state, command provenance, and trigger guard.

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
