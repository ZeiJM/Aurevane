# Combat K4 Effect Category Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one versioned, typed combat-effect category vocabulary and legacy-compatible status category metadata that later P4.K4 primitives can reuse for immunity, cleanse, prevention, and interaction rules.

**Architecture:** Add a focused `combat-effect-categories.ts` domain module rather than expanding `actions-legacy.ts`. Status definitions opt into categories through additive module augmentation in `combat-effect-state.ts`; historical definitions remain valid when categories are omitted. Publication validation rejects unknown, duplicate, or oversized category metadata before content reaches runtime.

**Tech Stack:** TypeScript 6, Vitest 4, pnpm workspace, existing `@aurevane/game-core` combat authoring validators.

**Spec:** `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md` (P4.K4 generic categories and capability-first interactions), extended by `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md`.

## Global Constraints

- Preserve historical snapshots and published content; category metadata is additive and optional for old definitions.
- Canonical categories are exactly: `Damage`, `Healing`, `Control`, `Movement`, `ForcedMovement`, `Buff`, `Debuff`, `DamageOverTime`, `HealingOverTime`, `Barrier`, `Summon`, `Resource`, `Stealth`, `Mark`, `Terrain`, `Transformation`.
- Do not implement Barrier, Reflect, Absorb, Pierce, immunity, cleanse, prevention, or other advanced behavior in this slice.
- Reject arbitrary category strings at the authoring boundary.
- Keep runtime behavior unchanged; this ticket establishes contracts only.
- No deployment.

---

### Task 1: Canonical effect-category contract

**Files:**
- Create: `packages/game-core/src/combat/combat-effect-categories.ts`
- Create: `packages/game-core/src/combat/combat-effect-categories.test.ts`
- Modify: `packages/game-core/package.json`

**Interfaces:**
- Produces: `COMBAT_EFFECT_CATEGORIES`, `CombatEffectCategory`, `validateCombatEffectCategory(value)`.
- Later tasks consume the exact category union for status metadata and capability predicates.

- [ ] **Step 1: Write the failing contract test**

```ts
import { describe, expect, it } from 'vitest'
import {
  COMBAT_EFFECT_CATEGORIES,
  validateCombatEffectCategory,
} from './combat-effect-categories'

const EXPECTED = [
  'Damage', 'Healing', 'Control', 'Movement', 'ForcedMovement', 'Buff', 'Debuff',
  'DamageOverTime', 'HealingOverTime', 'Barrier', 'Summon', 'Resource', 'Stealth',
  'Mark', 'Terrain', 'Transformation',
] as const

describe('P4.K4 combat effect categories', () => {
  it('publishes the approved immutable category vocabulary', () => {
    expect(COMBAT_EFFECT_CATEGORIES).toEqual(EXPECTED)
    expect(Object.isFrozen(COMBAT_EFFECT_CATEGORIES)).toBe(true)
  })

  it('accepts only canonical categories', () => {
    expect(() => validateCombatEffectCategory('Damage')).not.toThrow()
    expect(() => validateCombatEffectCategory('damage')).toThrow(/effect category/i)
    expect(() => validateCombatEffectCategory('Scripted')).toThrow(/effect category/i)
  })
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-effect-categories.test.ts`

Expected: FAIL because `./combat-effect-categories` does not exist.

- [ ] **Step 3: Implement the minimal category module**

```ts
export const COMBAT_EFFECT_CATEGORIES = Object.freeze([
  'Damage', 'Healing', 'Control', 'Movement', 'ForcedMovement', 'Buff', 'Debuff',
  'DamageOverTime', 'HealingOverTime', 'Barrier', 'Summon', 'Resource', 'Stealth',
  'Mark', 'Terrain', 'Transformation',
] as const)

export type CombatEffectCategory = (typeof COMBAT_EFFECT_CATEGORIES)[number]

export function validateCombatEffectCategory(value: unknown): asserts value is CombatEffectCategory {
  if (
    typeof value !== 'string' ||
    !COMBAT_EFFECT_CATEGORIES.includes(value as CombatEffectCategory)
  ) {
    throw new TypeError('Unknown combat effect category.')
  }
}
```

Add package export:

```json
"./combat/combat-effect-categories": "./src/combat/combat-effect-categories.ts"
```

- [ ] **Step 4: Run the focused test and typecheck**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-effect-categories.test.ts && pnpm --filter @aurevane/game-core typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/game-core/package.json packages/game-core/src/combat/combat-effect-categories.ts packages/game-core/src/combat/combat-effect-categories.test.ts
git commit -m "feat: add combat effect category contract"
```

### Task 2: Legacy-compatible status category metadata

**Files:**
- Modify: `packages/game-core/src/combat/combat-effect-state.ts`
- Modify: `packages/game-core/src/combat/combat-authoring-validation.ts`
- Modify: `packages/game-core/src/combat/combat-authoring-validation.test.ts`
- Test: `packages/game-core/src/combat/combat-effect-categories.test.ts`

**Interfaces:**
- Consumes: `CombatEffectCategory`, `validateCombatEffectCategory`.
- Produces: optional `CombatStatusDefinition.effectCategories` and `combatStatusEffectCategories(status)` returning a canonical immutable-compatible readonly list with `[]` as the historical default.

- [ ] **Step 1: Add failing metadata/validation tests**

```ts
it('keeps historical statuses category-empty by default', () => {
  expect(combatStatusEffectCategories(P2_3_GUARDED_STATUS)).toEqual([])
})

it('accepts distinct canonical status categories', () => {
  const status = {
    ...P2_3_GUARDED_STATUS,
    effectCategories: ['Buff', 'Barrier'],
  } as CombatStatusDefinition
  expect(combatStatusEffectCategories(status)).toEqual(['Buff', 'Barrier'])
  expect(() => validateCombatStatusDefinition(status)).not.toThrow()
})

it('rejects unknown and duplicate status categories', () => {
  expect(() => validateCombatStatusDefinition({
    ...P2_3_GUARDED_STATUS,
    effectCategories: ['Buff', 'Buff'],
  } as unknown as CombatStatusDefinition)).toThrow(/effect categories/i)

  expect(() => validateCombatStatusDefinition({
    ...P2_3_GUARDED_STATUS,
    effectCategories: ['Scripted'],
  } as unknown as CombatStatusDefinition)).toThrow(/effect category/i)
})
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-effect-categories.test.ts src/combat/combat-authoring-validation.test.ts`

Expected: FAIL because status category metadata/helper are not implemented.

- [ ] **Step 3: Add optional metadata and strict validation**

In `combat-effect-state.ts`:

```ts
import type { CombatEffectCategory } from './combat-effect-categories'

declare module './actions' {
  interface CombatStatusDefinition {
    effectCategories?: readonly CombatEffectCategory[]
  }
}

export function combatStatusEffectCategories(
  status: CombatStatusDefinition,
): readonly CombatEffectCategory[] {
  return status.effectCategories ?? []
}
```

In `combat-authoring-validation.ts`, for an authored `effectCategories` array:
- require an array;
- require 1–16 entries when present;
- reject duplicates;
- validate every entry with `validateCombatEffectCategory`.

- [ ] **Step 4: Run focused tests and game-core typecheck**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-effect-categories.test.ts src/combat/combat-authoring-validation.test.ts && pnpm --filter @aurevane/game-core typecheck`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/game-core/src/combat/combat-effect-state.ts packages/game-core/src/combat/combat-authoring-validation.ts packages/game-core/src/combat/combat-authoring-validation.test.ts
git commit -m "feat: validate status effect categories"
```

### Task 3: Full regression gate and K4 checkpoint

**Files:**
- Review all Task 1–2 changes; no unrelated source edits.

**Interfaces:**
- Produces a verified K4 category foundation ready for capability predicates and advanced primitives in later child tickets.

- [ ] **Step 1: Run focused K4 contract tests**

Run: `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-effect-categories.test.ts src/combat/combat-authoring-validation.test.ts`

Expected: PASS with zero failures.

- [ ] **Step 2: Run full repository quality gate**

Run: `pnpm check`

Expected: format, lint, typecheck, tests, and build all exit 0.

- [ ] **Step 3: Verify diff hygiene**

Run: `git diff --check`

Expected: no output and exit 0.

- [ ] **Step 4: Freshness-check shared combat and main before integration**

Confirm the K3 parent is still the shared combat head or reconcile any newer shared/main work on an isolated branch before writing shared history.

- [ ] **Step 5: Integrate only after exact-head gates pass**

Use a merge commit or fast-forward compatible with current shared history; never force-push. Do not deploy.
