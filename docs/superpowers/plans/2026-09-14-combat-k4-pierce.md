# Combat K4 Pierce Implementation Plan

> **For agentic workers:** use TDD and verification-before-completion for every task.

**Goal:** Add the approved `Pierce` damage primitive as an additive, authored property on individual damage effects.

**Architecture:** Keep Pierce inside the existing authoritative damage pipeline. A piercing damage block bypasses recipient defensive mitigation only: Armor/Ward, legacy incoming reductions, and bounded incoming reduction modifiers. It still applies attacker outgoing modifiers, facing/elemental modifiers, target vulnerabilities, accuracy, and later reactive effects. Historical damage blocks without `piercing` keep identical behavior.

**Spec:** `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md` §11 and `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md` P4.K4.

## Constraints

- `piercing` is optional and boolean; omitted means historical non-piercing behavior.
- Pierce bypasses Armor/Ward and incoming damage multipliers below 100%.
- Pierce preserves incoming vulnerabilities above 100% and all attacker outgoing modifiers/penalties.
- Pierce does not change accuracy, targeting, immunity, status presence, elemental interactions, or reactions.
- Compact presentation already derives `Pierce` from `effect.piercing === true`; keep that source authoritative.
- No deployment.

### Task 1 — RED contract

**Files:**
- Create `packages/game-core/src/combat/combat-pierce.test.ts`

- [x] Prove non-piercing Armor + Guard mitigation remains unchanged.
- [x] Prove piercing damage bypasses Armor and Guard-style incoming reduction.
- [x] Prove piercing damage still receives target vulnerability.
- [x] Prove piercing damage preserves attacker outgoing penalties while bypassing target incoming protection.
- [x] Prove authoring rejects non-boolean `piercing`.
- [x] Run focused test and record intended RED failures.

RED evidence: exact PR head `5f8070fa03c638d0470f9c17633a310843fb7905` failed only the four unimplemented Pierce behavior/validation assertions while the historical mitigation test, Pierce presentation tag, and 1,217 other game-core tests passed.

### Task 2 — GREEN implementation

**Files:**
- Modify `packages/game-core/src/combat/actions-legacy.ts`
- Modify `packages/game-core/src/combat/damage-modifiers.ts`
- Modify `packages/game-core/src/combat/gameplay-tags.ts` only if validation needs to live beside existing derived Pierce presentation.

- [x] Add optional `piercing?: boolean` to the damage effect contract.
- [x] Validate authored Pierce as boolean when present.
- [x] Skip defense rating mitigation for piercing damage.
- [x] Skip recipient legacy damage multipliers below 100% for piercing damage; preserve vulnerabilities.
- [x] Allow the shared conditional modifier function to ignore recipient incoming reductions below 100% while preserving attacker outgoing modifiers and incoming vulnerabilities.
- [x] Run focused Pierce tests and game-core typecheck.

GREEN evidence: isolated verification workflow `34916375287` passed the focused six-test Pierce contract, game-core typecheck, full `pnpm check`, and diff hygiene before publishing clean source commit `c68abd5a5eb23fb1d83d7e64442d05e253b81c49`.

### Task 3 — verification/integration

- [x] Run full `pnpm check`.
- [x] Verify diff hygiene.
- [ ] Reconcile against the live shared combat head after the K4 category foundation lands.
- [ ] Run exact integration gates before merging to the shared combat branch.
- [ ] Do not deploy.
