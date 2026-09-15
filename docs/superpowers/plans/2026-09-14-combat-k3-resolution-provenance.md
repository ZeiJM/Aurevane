# Combat Kernel K3 Resolution Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete P4.K3 by turning the approved versioned resolution/trigger-safety contract into replay-grade causal metadata on newly created persistent combat effects, while preserving historical snapshots and all current combat behavior.

**Architecture:** K3 remains an additive, behavior-preserving migration. K3-A owns the immutable sixteen-stage v1 pipeline and bounded trigger-guard contract; K3-B attaches exact command provenance/trigger metadata to opted-in authoritative transitions. K3-C/D add one shared `CombatEffectInstanceProvenance` model and annotate newly created status, Poison, Bleed, Burn and scheduled recovery instances after the legacy resolver completes, so combat authority remains single-path and historical rows without provenance remain valid.

**Tech Stack:** TypeScript strict mode, Vitest, Next.js server battle layer, existing deterministic `@aurevane/game-core` combat state, GitHub Actions CI/Skill Engine/Representative Buildcraft/Browser Smoke.

**Spec:** `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md`

## Global Constraints

- Preserve server-authoritative deterministic combat and the current single resolver path.
- Do not change damage numbers, AP/MP costs, targeting, accuracy, defenses, DoT values, durations, stacks, Burn backlash, or published content.
- Historical combat snapshots lacking K3 provenance must remain readable and executable.
- New provenance fields are optional at persisted compatibility boundaries but runtime-validated whenever present.
- Do not introduce unbounded recursion. K3 uses the existing bounded trigger guard contract; K4 will consume it for advanced reactive mechanics.
- Do not introduce `any`, broad unvalidated casts, or authoritative non-null assertions.
- No Vercel Preview or Production deployment.

---

### Task 1: Effect-instance provenance identity and builder

**Files:**
- Modify: `packages/game-core/src/combat/combat-kernel-types.ts`
- Modify: `packages/game-core/src/combat/combat-kernel-types.test.ts`
- Create: `packages/game-core/src/combat/combat-effect-provenance.test.ts`

**Interfaces:**
- Consumes: `CombatActionProvenance`, `CombatantId`, `TriggerChainId`, `ContentVersion`.
- Produces:

```ts
export type CombatEffectInstanceId = string & {
  readonly [combatEffectInstanceIdBrand]: 'CombatEffectInstanceId'
}

export interface CombatEffectInstanceProvenance {
  instanceId: CombatEffectInstanceId
  action: CombatActionProvenance
  targetCombatantId: CombatantId
  effectOrdinal: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: CombatEffectInstanceId
  inheritedFromInstanceId?: CombatEffectInstanceId
}

export interface CreateCombatEffectInstanceProvenanceInput {
  action: CombatActionProvenance
  targetCombatantId: string
  effectOrdinal: number
  createdRound: number
  createdTurn: number
  copiedFromInstanceId?: string
  inheritedFromInstanceId?: string
}

export function createCombatEffectInstanceProvenance(
  input: CreateCombatEffectInstanceProvenanceInput,
): CombatEffectInstanceProvenance

export function validateCombatEffectInstanceProvenance(
  value: unknown,
): readonly string[]
```

- `instanceId` is deterministic from the trigger chain, action definition, effect ordinal and target:

```ts
`effect:${input.action.triggerChainId}:${input.action.actionDefinitionId}:${input.effectOrdinal}:${input.targetCombatantId}`
```

- `effectOrdinal` is a zero-based safe integer.
- `createdRound` and `createdTurn` are positive safe integers.
- copied/inherited IDs, when present, pass the same stable-ID validation as native instance IDs.

- [ ] **Step 1: Write the failing tests**

Add tests that require deterministic provenance creation, reject negative/fractional ordinals, reject invalid round/turn values, reject malformed persisted provenance, and preserve optional copied/inherited links.

```ts
const action = createCombatActionProvenance({
  rulesetVersion: 2,
  sourceKind: 'discipline-skill',
  actionDefinitionId: 'skill.ironfist.rising-fist',
  actionVersion: 3,
  sourceCombatantId: 'actor',
  controllerCombatantId: 'actor',
  triggerChainId: 'chain:command-1',
})

expect(
  createCombatEffectInstanceProvenance({
    action,
    targetCombatantId: 'target',
    effectOrdinal: 1,
    createdRound: 2,
    createdTurn: 4,
  }),
).toMatchObject({
  instanceId: 'effect:chain:command-1:skill.ironfist.rising-fist:1:target',
  action,
  targetCombatantId: 'target',
  effectOrdinal: 1,
  createdRound: 2,
  createdTurn: 4,
})
```

- [ ] **Step 2: Run RED**

Use exact-head CI on the isolated branch. Expected failure: missing K3 effect-provenance exports/tests only; formatting/lint/typecheck must otherwise be clean.

- [ ] **Step 3: Implement the minimal builder and validator**

Add the branded ID, builder and validator to `combat-kernel-types.ts`. Use existing stable identifier/version helpers; do not add a second validation framework.

- [ ] **Step 4: Run GREEN**

Required focused evidence:

```bash
pnpm --filter @aurevane/game-core typecheck
pnpm --filter @aurevane/game-core test
```

And `pnpm check` through CI at the same head.

- [ ] **Step 5: Commit**

```bash
git add packages/game-core/src/combat/combat-kernel-types.ts \
  packages/game-core/src/combat/combat-kernel-types.test.ts \
  packages/game-core/src/combat/combat-effect-provenance.test.ts
git commit -m "feat: add combat effect instance provenance"
```

---

### Task 2: Historical-compatible persistent provenance fields

**Files:**
- Modify: `packages/game-core/src/combat/combat-effect-state.ts`
- Modify: `packages/game-core/src/combat/actions-legacy.ts`
- Modify: `packages/game-core/src/combat/combat-effect-state.test.ts`
- Create: `packages/game-core/src/combat/combat-effect-provenance-state.test.ts`

**Interfaces:**
- Consumes: `CombatEffectInstanceProvenance`, `validateCombatEffectInstanceProvenance()`.
- Produces optional `provenance?: CombatEffectInstanceProvenance` on:
  - `CombatStatusInstance`;
  - `CombatOngoingRecovery`;
  - `CombatPoisonInstance`;
  - `CombatBleedStack`;
  - `CombatBurnInstance`.

Historical rows without `provenance` remain valid.

- [ ] **Step 1: Write the failing compatibility tests**

Construct one historical encounter with status/DoT/recovery rows that omit provenance and assert existing normalization/validation still passes. Construct rows with a malformed present provenance object and assert validation fails closed.

```ts
expect(validateCombatEncounterState(historicalState)).toEqual([])
expect(validateCombatEncounterState(malformedProvenanceState)).toEqual(
  expect.arrayContaining([
    expect.objectContaining({ field: expect.stringMatching(/provenance/) }),
  ]),
)
```

- [ ] **Step 2: Run RED**

Expected failure: present malformed provenance is not yet rejected.

- [ ] **Step 3: Add optional fields and validation**

Add optional provenance fields without changing encounter schema version. Extend status and DoT/recovery validation so omitted provenance is accepted and present provenance is validated through the Task-1 validator.

Do not make `normalizeCombatEffectState()` invent provenance for historical rows.

- [ ] **Step 4: Run GREEN**

Run game-core typecheck/tests and full CI on exact head.

- [ ] **Step 5: Commit**

```bash
git add packages/game-core/src/combat/combat-effect-state.ts \
  packages/game-core/src/combat/actions-legacy.ts \
  packages/game-core/src/combat/combat-effect-state.test.ts \
  packages/game-core/src/combat/combat-effect-provenance-state.test.ts
git commit -m "feat: validate persistent combat effect provenance"
```

---

### Task 3: Annotate new persistent effects after authoritative resolution

**Files:**
- Modify: `packages/game-core/src/combat/actions.ts`
- Create: `packages/game-core/src/combat/combat-effect-provenance.ts`
- Create: `packages/game-core/src/combat/combat-effect-provenance-threading.test.ts`

**Interfaces:**
- Consumes: `CombatResolutionContext`, `CombatEffectInstanceProvenance`, `CombatActionDefinition` and the legacy transition.
- Produces:

```ts
export function attachCombatEffectProvenance(
  before: CombatEncounterState,
  after: CombatEncounterState,
  action: CombatActionDefinition,
  context: CombatResolutionContext,
): CombatEncounterState
```

`executeCombatAction(..., context)` calls this after the legacy resolver and returns the enriched state. The no-context four-argument call returns the historical state shape unchanged.

Annotation rules:

1. Use the action effect's zero-based array index as `effectOrdinal`.
2. Use the pre-command battle round/turn as `createdRound` / `createdTurn`.
3. Use the exact `context.provenance` object as `action` provenance.
4. `apply-status`: annotate the resulting target status instance for that status ID.
5. `poison`: annotate the resulting target Poison instance.
6. `burn`: annotate the resulting target Burn instance.
7. `bleed`: annotate only the newly created/replaced highest-application-order stack attributable to this command/target/effect.
8. multi-tick healing/resource recovery: annotate the resulting scheduled recovery row.
9. Damage, immediate healing, immediate resource changes, displacement, terrain and removals do not create persistent provenance rows in K3-C.
10. Reapplication receives new provenance for the newly committed instance/state, never silently retains stale source-action metadata.

- [ ] **Step 1: Write RED tests for each persistent family**

Use an opted-in context with a known trigger chain and assert status, Poison, Bleed, Burn and scheduled recovery carry deterministic provenance after execution.

Also assert the same actions executed without context produce no new provenance fields.

- [ ] **Step 2: Run RED**

Expected failure: transition-level metadata exists from K3-B, but persistent rows lack provenance.

- [ ] **Step 3: Implement a post-resolution provenance enricher**

Do not fork or duplicate effect resolution. Resolve recipients from the action/evaluation and enrich only the committed persistent rows in the already-resolved next state.

The enricher must not change HP/MP, statuses, DoT values, durations, positions, terrain, cooldowns, AP/action state, RNG, or emitted legacy events.

- [ ] **Step 4: Add immutability assertions**

Tests must assert the input state and `context.provenance` / `context.triggerGuard` objects are unchanged after execution.

- [ ] **Step 5: Run GREEN**

Required exact-head evidence:

```bash
pnpm --filter @aurevane/game-core typecheck
pnpm --filter @aurevane/game-core test
pnpm check
```

- [ ] **Step 6: Commit**

```bash
git add packages/game-core/src/combat/actions.ts \
  packages/game-core/src/combat/combat-effect-provenance.ts \
  packages/game-core/src/combat/combat-effect-provenance-threading.test.ts
git commit -m "feat: persist K3 combat effect provenance"
```

---

### Task 4: Document the K3 boundary and prove compatibility

**Files:**
- Modify: `docs/COMBAT.md`
- Modify: `docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md`
- Modify: `docs/PHASE_4_COMBAT_KERNEL_K0_AUDIT.md`
- Modify: `docs/superpowers/plans/2026-09-14-combat-k3-resolution-provenance.md`

**Interfaces:**
- Documents K3's implemented contract without claiming K4 advanced mechanics exist.

- [ ] **Step 1: Document the versioned v1 stages**

Record the exact sixteen stage IDs exported by `COMBAT_RESOLUTION_STAGES_V1` and state that K3 defines semantic placement for future primitives; it does not yet implement Barrier/Reflect/Lifesteal/etc.

- [ ] **Step 2: Document trigger safety ceilings**

Record current defaults:

```text
max trigger depth: 8
reaction budget: 32 per chain
triggered damage default: non-reactive
same persistent trigger instance: at most once per chain
```

Any future ruleset change requires a versioned contract change, not an untracked constant edit.

- [ ] **Step 3: Document provenance compatibility**

State that historical rows may omit K3 provenance; new opted-in authoritative resolutions can persist source action/ruleset/controller/trigger-chain/target/round/turn/effect-ordinal metadata.

- [ ] **Step 4: Mark task checkboxes completed only after code is verified**

Do not mark K3 complete before all final checks and freshness reconciliation pass.

- [ ] **Step 5: Commit**

```bash
git add docs/COMBAT.md docs/ROADMAP_C4_AUDIT_COMBAT_KERNEL_V2.md \
  docs/PHASE_4_COMBAT_KERNEL_K0_AUDIT.md \
  docs/superpowers/plans/2026-09-14-combat-k3-resolution-provenance.md
git commit -m "docs: record K3 resolution provenance contract"
```

---

### Task 5: Final exact-head verification and integration

**Files:**
- No production source changes unless a failing gate identifies a K3-caused defect.

**Interfaces:**
- Produces one mergeable K3 candidate on top of the live combat branch and current `main` history.

- [ ] **Step 1: Run the full exact-head gate matrix**

Required on one final SHA:

- CI / Quality gates;
- CI / Database foundation;
- Skill Engine;
- Representative Buildcraft;
- Browser Smoke.

Any additional path-triggered buildcraft workflows on the final SHA must also be green.

- [ ] **Step 2: Re-check live branch freshness**

Refresh:

```text
agent/combat-effect-taxonomy-rework
main
```

If either moved, reconcile without force-push/reset and rerun affected exact-head gates.

- [ ] **Step 3: Review the final diff**

Confirm:

- no gameplay coefficient/value changes;
- no duplicate resolver;
- no required provenance on historical rows;
- no Vercel deployment/config unlock;
- K3 trigger guard is bounded and immutable;
- newly added provenance is deterministic and runtime-validated.

- [ ] **Step 4: Merge with expected-head guard**

Merge only after every required workflow is green on the exact final SHA.

---

## Self-Review

- **Spec coverage:** Versioned stage order, trigger-chain safety, source/action/controller/trigger-chain provenance, persistent effect/status provenance, historical compatibility, deterministic semantics and exact-head verification are each assigned to a task.
- **Placeholder scan:** No TBD/TODO/future-implementation placeholders are used. K4-only mechanics are explicitly excluded rather than left vague.
- **Type consistency:** `CombatActionProvenance`, `CombatTriggerGuard`, `CombatEffectInstanceProvenance`, `CombatResolutionContext`, `effectOrdinal`, `createdRound` and `createdTurn` are used consistently across all tasks.
- **Scope boundary:** Barriers, penetration, lifesteal, recoil, reflect, redirect, generic cleanse/immunity categories, tactical entities, AI integration and balance simulation remain K4+ work.