# Combat K4 Direct Barrier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first bounded Barrier primitive to the authoritative direct-damage pipeline without redefining periodic, reactive, self-cost, or system-damage interactions prematurely.

**Architecture:** Represent Barrier as first-class encounter effect state with source/action provenance, not as HP or a damage-reduction status. A positive `barrier-change` effect grants a bounded pool; ordinary authored `damage` resolves its existing Armor/Ward, Pierce, facing, elemental, outgoing, incoming, and vulnerability math first, then Barrier absorbs the resolved amount before HP is committed. Existing encounters with no Barrier state remain byte-semantically equivalent, and Pierce does not bypass Barrier because Barrier is a later pipeline stage than defensive mitigation.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm monorepo, existing `packages/game-core` combat engine.

**Spec:** `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md` sections 3, 5, 7, and 9; `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md` sections 4, 10, and 11; `docs/COMBAT.md`; `AGENTS.md`.

## Global Constraints

- Server-authoritative deterministic combat only; no client-authored outcome.
- Preserve historical snapshots: missing Barrier state means no active Barrier.
- Barrier sits after damage modifiers/defense and before committed HP loss.
- Pierce bypasses defensive mitigation only and therefore does not bypass Barrier.
- `damage_applied.amount` continues to mean actual committed HP loss, which is the future reaction/provenance input.
- Aggregate active Barrier on one combatant is capped at that combatant's maximum HP as the initial kernel safety ceiling.
- Barrier instances retain target, source combatant, source action, and deterministic keyed state so provenance is not discarded.
- This first slice changes only authored direct `damage` effects. Periodic DoTs, Burn backlash/self-cost, future Reflect/reactive damage, and system damage keep their current paths until their own K4 tickets define Barrier interaction explicitly.
- No roster/content migration and no deployment.

---

### Task 1: RED Barrier contract

**Files:**
- Create: `packages/game-core/src/combat/combat-barrier.test.ts`

**Interfaces:**
- Consumes: existing `executeCombatAction`, `validateCombatActionDefinition`, `combatActionPresentationTags`.
- Produces: executable contract for `barrier-change`, direct-damage absorption, max-HP cap, Pierce ordering, validation, and presentation.

- [ ] **Step 1: Write the failing contract tests**

Create a focused encounter fixture with actor/recruit at range 1 and zero defense. Author a test-only positive effect by casting through the public type boundary until production types gain the new variant:

```ts
const effect = {
  type: 'barrier-change',
  recipient: 'primary-unit',
  amount,
} as unknown as CombatEffectDefinition
```

Required assertions:

```ts
expect(recruitHp(afterGrantThen20DamageWith8Barrier)).toBe(88)
expect(committedDamage).toBe(12)
expect(barrierAfter).toBe(0)
expect(barrierAfterTwo75PointGrants).toBe(100)
expect(recruitHp(afterPiercing20DamageWith8Barrier)).toBe(88)
expect(() => validateCombatActionDefinition(barrierAction(0), CONTENT)).toThrow(/barrier/i)
expect(combatActionPresentationTags(barrierAction(8))).toContain('Barrier')
```

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter @aurevane/game-core test -- combat-barrier.test.ts
```

Expected: focused failures because `barrier-change` is not yet a supported effect type/runtime mutation; unrelated existing tests remain green.

- [ ] **Step 3: Record the exact RED head and failure scope**

Commit only the plan/test contract. Do not add production Barrier support until the intended RED result is observed.

---

### Task 2: GREEN first-class Barrier state and direct-damage interception

**Files:**
- Create: `packages/game-core/src/combat/combat-barrier.ts`
- Modify: `packages/game-core/src/combat/combat-effect-state.ts`
- Modify: `packages/game-core/src/combat/actions-legacy.ts`
- Modify: `packages/game-core/src/combat/combat-authoring-validation.ts`
- Modify: `packages/game-core/src/combat/gameplay-tags.ts`
- Test: `packages/game-core/src/combat/combat-barrier.test.ts`

**Interfaces:**
- Produces `CombatBarrierInstance` in first-class effect state.
- Produces `currentBarrierAmount(state, combatantId): number`.
- Produces `grantBarrier(state, sourceCombatantId, targetCombatantId, sourceActionId, amount)` returning state plus before/after/applied amount.
- Produces `absorbDirectDamageWithBarrier(state, targetCombatantId, amount)` returning state plus `absorbed`, `remainingDamage`, `before`, and `after`.
- Produces `validateBarrierEffect(effect)` and `validateBarrierState(state)`.

- [ ] **Step 1: Add backward-compatible Barrier state**

Add an optional historical-compatible collection to `CombatEffectState`:

```ts
export interface CombatBarrierInstance {
  targetCombatantId: string
  sourceCombatantId: string
  sourceActionId: string
  amount: number
}

export interface CombatEffectState {
  // existing fields...
  barriers?: CombatBarrierInstance[]
}
```

`normalizeCombatEffectState` must normalize missing/non-array Barrier state to `[]` without changing old snapshot validity.

- [ ] **Step 2: Add the bounded Barrier helper**

Implement `combat-barrier.ts` using the normalized effect state. Barrier grant amount must be a positive safe integer. Multiple source/action keys may coexist, but the aggregate total for a target is capped at `target.maxHp`; same key accumulates only up to the remaining cap. Consume target Barrier deterministically by stable `[sourceCombatantId, sourceActionId]` key ordering and remove zeroed instances.

- [ ] **Step 3: Extend the authored effect union and validation**

Add:

```ts
| { type: 'barrier-change'; recipient: CombatEffectRecipient; amount: number }
```

Wire `validateBarrierEffect` into both the legacy execution validation boundary and exported Master-Panel/content authoring validation. Reject zero, negative, fractional, non-finite, and unsafe integer grants.

- [ ] **Step 4: Apply Barrier after resolved direct damage and before HP commit**

In the existing direct `damage` effect branch:

```ts
const resolvedAmount = resolveDamageAmount(...)
const barrier = absorbDirectDamageWithBarrier(state, recipientId, resolvedAmount)
const hpAfter = Math.max(0, target.hp - barrier.remainingDamage)
```

Preserve the existing modifier/Pierce path. Emit an explicit Barrier absorption event when `absorbed > 0`, and keep `damage_applied.amount` equal to actual HP loss after Barrier.

- [ ] **Step 5: Grant and project Barrier**

Resolve `barrier-change` as first-class state. Emit a deterministic `barrier_changed` event with before/after/applied amount. In preview projections, show aggregate Barrier before/after without mutating authoritative input state.

- [ ] **Step 6: Derive compact presentation**

`combatActionPresentationTags` derives `Barrier` from authoritative `barrier-change` metadata; do not add a hand-authored display flag.

- [ ] **Step 7: Verify GREEN**

Run:

```bash
pnpm --filter @aurevane/game-core test -- combat-barrier.test.ts
pnpm --filter @aurevane/game-core typecheck
```

Expected: focused Barrier contract passes with no type errors.

---

### Task 3: Full verification and safe integration

**Files:**
- Modify this plan only to record evidence if needed.

**Interfaces:**
- Consumes the complete Task-2 implementation.
- Produces a reviewed child-branch candidate suitable for a PR against `agent/combat-effect-taxonomy-rework`.

- [ ] **Step 1: Run repository verification**

```bash
pnpm check
git diff --check
git diff --stat
git diff --name-only agent/combat-effect-taxonomy-rework...HEAD
```

- [ ] **Step 2: Re-fetch volatile branches**

Confirm current `main` and `agent/combat-effect-taxonomy-rework` heads. Inspect any advancement for overlap before integration.

- [ ] **Step 3: Inspect exact diff**

Require only the Barrier plan/test/state/helper/validation/presentation/direct-damage files. No UI, roster, database, deployment, or unrelated cleanup.

- [ ] **Step 4: Require exact-head integration gates**

Open/refresh the PR against the live shared combat branch and require applicable CI, Skill Engine, Representative Buildcraft, and Browser Smoke success before merge.

- [ ] **Step 5: Merge only after freshness and exact-head verification**

Record the resulting shared merge SHA. Do not deploy.
