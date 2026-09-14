# Stat-Scaled Potency v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic optional Physical Power / Mystic Power scaling to AUREVANE damage effects while preserving every currently authored unscaled Skill and every historical stat-bridge snapshot.

**Architecture:** Extend the existing stat-driven combat bridge rather than creating a second stat system. New battles use a version-2 stat bridge that carries `physicalPower` and `mysticPower`; historical version-1 bridges remain readable and executable for unscaled content. Damage effects gain an optional typed scaling profile, calculated before the existing Armor/Ward, facing, status and conditional-modifier stages. No published Skill receives scaling in this ticket.

**Tech Stack:** TypeScript 6, Vitest 4, existing `@aurevane/game-core` deterministic combat engine, Next.js server battle services, GitHub Actions CI/browser gates.

**Spec:** `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md` §3 and §19; `docs/PHASE_4_COMBAT_KERNEL_K0_AUDIT.md` K0-R6.

## Global Constraints

- Preserve current combat results for every damage effect that omits `scaling`.
- Preserve historical stat-bridge schema version 1; never rewrite old battle snapshots to the new shape.
- New live battle creation must emit stat-bridge schema version 2.
- Runtime damage order is: authored base + explicit offensive scaling → defense mitigation → facing → per-stack target status modifiers → bounded conditional modifiers.
- Use deterministic integer/fixed-point math only; basis points use denominator `10_000`.
- Scaling sources in this ticket are only `physical-power` and `mystic-power`.
- Maximum authored scaling coefficient in this engine contract is `20_000` basis points (2.0× selected offensive rating). Later tactical/final multipliers remain separate.
- A scaled damage effect executed against a legacy v1 bridge must fail closed instead of silently treating missing offensive power as zero.
- Basic Attack keeps its existing independent derived-damage path in this ticket; do not double-scale it.
- Do not add scaling to the 136 published Discipline Skills in this ticket.
- Do not change AP/MP costs, repeat-use falloff, Accuracy/Evasion, Armor/Ward formulas, facing multipliers, status modifiers, DoTs, or current content balance.
- No database migration or Vercel deployment is part of this plan.

---

## File Map

- `packages/game-core/src/combat/stat-driven-combat.ts` — versioned persisted stat-bridge schemas and offensive ratings.
- `packages/game-core/src/combat/stat-driven-combat.test.ts` — v1 compatibility and v2 stat profile tests.
- `packages/game-core/src/combat/damage-scaling.ts` — pure typed scaling definition/validation/math; no action-state dependency.
- `packages/game-core/src/combat/damage-scaling.test.ts` — deterministic fixed-point scaling tests.
- `packages/game-core/src/combat/actions.ts` — optional damage scaling metadata and integration at the first damage-resolution stage.
- `packages/game-core/src/combat/actions-stat-scaled-damage.test.ts` — end-to-end damage-order and compatibility tests.
- `apps/web/src/server/battle/battle-session-service.ts` — scenario/recruit v2 offensive profile values.
- `apps/web/src/server/battle/pvp-lobby-service.ts` — no bespoke formula; compile/regression proves character-derived v2 profiles flow into PvP.
- `packages/game-core/package.json` — export pure scaling contract if needed by Master Panel/authoring.
- `docs/COMBAT.md` — record the implemented optional raw-potency grammar without claiming published Skills have been rebalanced.

---

### Task 1: Version the stat bridge and carry offensive ratings

**Files:**
- Modify: `packages/game-core/src/combat/stat-driven-combat.ts`
- Modify: `packages/game-core/src/combat/stat-driven-combat.test.ts`

**Interfaces:**
- Produces `StatDrivenCombatProfileV1`, `StatDrivenCombatProfile` (current v2), and a versioned `StatDrivenCombatBridgeState` union.
- Produces `getStatDrivenOffensivePower(state, combatantId, source)` for later damage scaling.
- `createCharacterDerivedCombatProfile()` returns current v2 profiles using existing `DerivedStatSnapshot.stats.physicalPower` and `.mysticPower`.

- [ ] **Step 1: Write the failing compatibility/profile tests**

Add v2 defaults to the current `profile()` fixture and assert character-derived profile construction carries exact existing derived values:

```ts
expect(createCharacterDerivedCombatProfile('actor', 'char-1', derived)).toMatchObject({
  physicalPower: derived.stats.physicalPower.value,
  mysticPower: derived.stats.mysticPower.value,
})
```

Add a historical fixture whose bridge is exactly:

```ts
{
  schemaVersion: 1,
  rulesVersion: 1,
  combatants: [{
    combatantId: 'player',
    provenance: { kind: 'character-derived', sourceId: 'character:test', sourceRulesVersion: 1 },
    accuracy: 10_000,
    evasion: 0,
    armor: 20,
    ward: 20,
    jump: 0,
  }]
}
```

Assert schema v1 remains accepted when otherwise complete, while new `createStatDrivenCombatEncounterState()` emits schema v2.

- [ ] **Step 2: Verify RED**

Run through the PR `Skill Engine` / CI boundary:

```bash
pnpm --filter @aurevane/game-core exec vitest run src/combat/stat-driven-combat.test.ts
pnpm --filter @aurevane/game-core typecheck
```

Expected: fail because current profiles/bridge have no offensive ratings or v2 schema.

- [ ] **Step 3: Implement versioned bridge types**

Use explicit persisted versions:

```ts
export const STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1 = 1 as const
export const STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION = 2 as const
export const STAT_DRIVEN_COMBAT_RULES_VERSION = 2 as const

export interface StatDrivenCombatProfileV1 {
  combatantId: string
  provenance: CombatStatProvenance
  accuracy: number
  evasion: number
  armor: number
  ward: number
  jump: number
}

export interface StatDrivenCombatProfile extends StatDrivenCombatProfileV1 {
  physicalPower: number
  mysticPower: number
}

export type StatDrivenCombatBridgeState =
  | {
      schemaVersion: typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_V1
      rulesVersion: 1
      combatants: readonly StatDrivenCombatProfileV1[]
    }
  | {
      schemaVersion: typeof STAT_DRIVEN_COMBAT_BRIDGE_SCHEMA_VERSION
      rulesVersion: typeof STAT_DRIVEN_COMBAT_RULES_VERSION
      combatants: readonly StatDrivenCombatProfile[]
    }
```

`createStatDrivenCombatEncounterState()` creates v2. `reattachStatDrivenCombatBridge()` preserves the supplied bridge version rather than upgrading historical snapshots. Validation accepts v1/v2 and validates offensive ratings only on v2.

- [ ] **Step 4: Add offensive-power accessor**

```ts
export type CombatOffensivePowerKind = 'physical-power' | 'mystic-power'

export function getStatDrivenOffensivePower(
  state: StatDrivenCombatEncounterState,
  combatantId: string,
  source: CombatOffensivePowerKind,
): number {
  if (state.statBridge.schemaVersion !== 2) {
    throw new TypeError('Scaled damage requires stat-bridge schema version 2.')
  }
  const profile = state.statBridge.combatants.find((row) => row.combatantId === combatantId)
  if (!profile) throw new TypeError(`Missing stat profile for ${combatantId}.`)
  return source === 'physical-power' ? profile.physicalPower : profile.mysticPower
}
```

- [ ] **Step 5: Verify GREEN and commit**

```bash
pnpm --filter @aurevane/game-core exec vitest run src/combat/stat-driven-combat.test.ts
pnpm --filter @aurevane/game-core typecheck
git commit -m "feat: version offensive combat stat bridge"
```

---

### Task 2: Add pure deterministic damage-scaling grammar

**Files:**
- Create: `packages/game-core/src/combat/damage-scaling.ts`
- Create: `packages/game-core/src/combat/damage-scaling.test.ts`
- Modify: `packages/game-core/package.json`

**Interfaces:**
- Consumes `CombatOffensivePowerKind` from `stat-driven-combat.ts` only as a type, or defines the shared source union in this file and re-exports it from stat-driven combat; keep one canonical type.
- Produces `CombatDamageScaling`, `validateCombatDamageScaling()`, and `calculateScaledRawDamage()`.

- [ ] **Step 1: Write failing pure-math tests**

Required cases:

```ts
expect(calculateScaledRawDamage(12, null, null)).toBe(12)
expect(calculateScaledRawDamage(12, { source: 'physical-power', coefficientBasisPoints: 5_000 }, 40)).toBe(32)
expect(calculateScaledRawDamage(12, { source: 'mystic-power', coefficientBasisPoints: 7_500 }, 41)).toBe(42)
```

The third case proves floor semantics: `floor(41 * .75) = 30`, so `12 + 30 = 42`.

Validation must reject non-integer, negative, and >20,000 coefficients.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @aurevane/game-core exec vitest run src/combat/damage-scaling.test.ts
```

Expected: module/function missing.

- [ ] **Step 3: Implement minimal pure module**

```ts
export const COMBAT_SCALING_BASIS_POINTS = 10_000 as const
export const MAX_DAMAGE_SCALING_COEFFICIENT_BASIS_POINTS = 20_000 as const

export interface CombatDamageScaling {
  source: 'physical-power' | 'mystic-power'
  coefficientBasisPoints: number
}

export function calculateScaledRawDamage(
  authoredBasePower: number,
  scaling: CombatDamageScaling | null | undefined,
  offensivePower: number | null,
): number {
  if (!scaling) return authoredBasePower
  if (offensivePower === null) throw new TypeError('Scaled damage requires offensive power.')
  const bonus = Number(
    (BigInt(offensivePower) * BigInt(scaling.coefficientBasisPoints)) /
      BigInt(COMBAT_SCALING_BASIS_POINTS),
  )
  return authoredBasePower + bonus
}
```

Validate all inputs as non-negative safe integers and coefficient range 0–20,000. Throw on unsafe output.

- [ ] **Step 4: Export and verify GREEN**

Add `./combat/damage-scaling` to package exports and run:

```bash
pnpm --filter @aurevane/game-core exec vitest run src/combat/damage-scaling.test.ts
pnpm --filter @aurevane/game-core typecheck
```

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: add deterministic damage scaling grammar"
```

---

### Task 3: Wire optional scaling into the existing damage pipeline

**Files:**
- Modify: `packages/game-core/src/combat/actions.ts`
- Create: `packages/game-core/src/combat/actions-stat-scaled-damage.test.ts`

**Interfaces:**
- `CombatEffectDefinition` damage member gains optional `scaling?: CombatDamageScaling`.
- Existing `amount` remains the authored base power for compatibility.
- `resolveDamageAmount()` computes scaling before every existing mitigation/modifier stage.

- [ ] **Step 1: Write failing end-to-end damage-order tests**

Build a v2 encounter with attacker Physical Power 40 and target Armor 100. Define:

```ts
{
  type: 'damage',
  recipient: 'primary-unit',
  amount: 12,
  scaling: { source: 'physical-power', coefficientBasisPoints: 5_000 },
  defenseKind: 'armor',
}
```

Assert raw `12 + 20 = 32`, then Armor 100 produces `16` before later modifiers.

Add Mystic Power equivalent.

Add a facing test where the same `16` mitigated value receives rear `12_500` and becomes `20`, proving scaling precedes defense and facing.

Add an unscaled control action with identical attacker stats and assert its result remains exactly the authored amount passed through the old pipeline.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @aurevane/game-core exec vitest run src/combat/actions-stat-scaled-damage.test.ts
```

Expected: `scaling` is not part of the effect grammar / expected scaled result fails.

- [ ] **Step 3: Extend the generic encounter stat projection structurally**

The lightweight `CombatEncounterState.statBridge` projection in `actions.ts` should allow offensive values without requiring them for historical snapshots:

```ts
combatants: readonly {
  combatantId: string
  armor: number
  ward: number
  physicalPower?: number
  mysticPower?: number
}[]
```

Do not make them mandatory at this generic persisted compatibility boundary.

- [ ] **Step 4: Add scaling to damage effect validation**

Import the pure scaling validator. For `effect.type === 'damage'`, validate `effect.scaling` when present. Invalid scaling must appear as a normal action-definition validation issue; it must not reach execution.

- [ ] **Step 5: Resolve scaling before defense**

At the start of `resolveDamageAmount()`:

```ts
const offensivePower = effect.scaling
  ? state.statBridge?.combatants.find((unit) => unit.combatantId === actorId)?.[
      effect.scaling.source === 'physical-power' ? 'physicalPower' : 'mysticPower'
    ]
  : null

if (effect.scaling && offensivePower === undefined) {
  throw new TypeError('Scaled Skill damage requires attacker offensive power.')
}

let amount = calculateScaledRawDamage(effect.amount, effect.scaling, offensivePower ?? null)
```

Leave the existing defense, facing, target-status and conditional-modifier code in the same order after this line.

- [ ] **Step 6: Verify GREEN and regression suite**

```bash
pnpm --filter @aurevane/game-core exec vitest run \
  src/combat/actions-stat-scaled-damage.test.ts \
  src/combat/actions.test.ts \
  src/combat/stat-driven-combat.test.ts
pnpm --filter @aurevane/game-core typecheck
```

- [ ] **Step 7: Commit**

```bash
git commit -m "feat: apply explicit offensive damage scaling"
```

---

### Task 4: Populate v2 offensive ratings in live PvE and PvP battle creation

**Files:**
- Modify: `apps/web/src/server/battle/battle-session-service.ts`
- Verify/modify as required: `apps/web/src/server/battle/pvp-lobby-service.ts`
- Modify focused service tests that snapshot stat profiles.

**Interfaces:**
- Character profiles automatically receive Physical/Mystic Power from `createCharacterDerivedCombatProfile()`.
- Recruit scenario profile explicitly carries offensive ratings; it does not derive authority from the client.

- [ ] **Step 1: Add failing battle-session assertions**

In existing session/PvP tests, assert newly created player stat profiles contain the same Physical/Mystic Power as the authoritative server-derived snapshot and that the bridge schema is 2.

For Recruit AI, assert a stable explicit pair of ratings. Use the same canonical level-1/5-in-each-attribute benchmark currently used by the recruit Basic Attack calculation:

```ts
const RECRUIT_BENCHMARK_ATTRIBUTES = {
  might: 5,
  finesse: 5,
  vitality: 5,
  agility: 5,
  intellect: 5,
  resolve: 5,
} as const
```

Calculate its derived snapshot server-side and feed `.physicalPower.value` / `.mysticPower.value` into `recruitScenarioProfile()`; do not duplicate the formula as magic numbers.

- [ ] **Step 2: Verify RED**

Run focused web service tests. Expected: bridge remains v1 / offense fields absent.

- [ ] **Step 3: Implement authoritative profile propagation**

Keep player derivation through the existing `calculateCharacterBuildDerivedStats()` / `calculateDerivedStats()` path. Add the recruit benchmark snapshot once during encounter construction and populate v2 fields.

PvP should continue using `createCharacterDerivedCombatProfile()` for each player; change only tests or typing unless compile proves an actual call-site adjustment is required.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter @aurevane/web test
pnpm --filter @aurevane/web typecheck
```

Then exact-head CI must verify the full server/database/browser surface.

- [ ] **Step 5: Commit**

```bash
git commit -m "feat: snapshot offensive power into battles"
```

---

### Task 5: Prove historical and current unscaled combat remain unchanged

**Files:**
- Modify: `packages/game-core/src/combat/actions-stat-scaled-damage.test.ts`
- Modify: `packages/game-core/src/combat/stat-driven-combat.test.ts`
- Modify: `docs/COMBAT.md`

**Interfaces:**
- Produces the acceptance fixtures that later K10 content migration must preserve.

- [ ] **Step 1: Add historical v1 unscaled execution fixture**

Construct a v1 stat bridge with no Physical/Mystic fields and execute a normal unscaled damage effect. Assert it produces exactly the pre-K2 amount/defense result.

- [ ] **Step 2: Add v1 scaled fail-closed fixture**

Use the same historical bridge with a scaled damage effect and assert execution throws the explicit missing-offensive-power error before mutating state.

- [ ] **Step 3: Add current-content no-migration audit**

Iterate the current published/registered Discipline definitions available to game-core and assert this K2 ticket has not silently authored `scaling` onto them. This is intentionally temporary acceptance evidence until K10 performs the explicit content migration.

- [ ] **Step 4: Document implemented formula boundary**

Add to `docs/COMBAT.md`:

```text
RawDamage = AuthoredBasePower + floor(SelectedOffensivePower * ScalingCoefficientBasisPoints / 10000)
```

Then explicitly state:

- scaling is opt-in per damage effect;
- legacy/unmigrated content remains authored-base-only;
- Armor/Ward and tactical/status/conditional stages still follow afterward;
- broad content coefficient assignment/balance belongs to the later controlled migration and Balance Harness work.

- [ ] **Step 5: Full exact-head verification**

Required before merge:

```bash
pnpm check
```

And PR workflows must pass at the same head SHA:

- CI / Quality gates;
- Skill Engine;
- Representative Buildcraft;
- Browser smoke;
- Profile Skill Build;
- Shared Build Snapshots;
- Essence Build;
- Resonance Build.

No Vercel deployment.

- [ ] **Step 6: Freshness reconciliation and commit**

Refresh both `agent/combat-effect-taxonomy-rework` and `main`. Reconcile any concurrent shared combat changes without force-push/reset, rerun affected exact-head gates, then commit documentation/evidence:

```bash
git commit -m "docs: verify stat-scaled potency v2 compatibility"
```

---

## Self-Review

- **Spec coverage:** Explicit offensive scaling, existing defense curve, deterministic arithmetic, backward compatibility, stat authority reuse and no mass content rebalance are each assigned to a task.
- **No placeholders:** Every task has named files, interfaces, failure expectation, implementation shape and verification command.
- **Type consistency:** `physical-power` / `mystic-power`, `coefficientBasisPoints`, v1/v2 bridge names and `calculateScaledRawDamage()` are used consistently throughout.
- **Scope boundary:** Basic Attack, current content values, AP/MP, Accuracy/Evasion, defenses, DoTs and later advanced scaling sources are explicitly excluded from redesign here.
