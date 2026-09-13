# Combat Runtime, Effects, and Discipline Skill Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the approved combat taxonomy, variable displacement, movement-tempo rules, scheduled recovery, new DoT identities, Copy, reactive effects, generalized accuracy, effect cloning, and a full regular Discipline Skill rebalance while preserving historical battle snapshots.

**Architecture:** Keep game rules pure and server-authoritative in `packages/game-core`; extend encounter state through explicit versioned structures instead of dynamic ad-hoc statuses. Server battle services continue to snapshot pinned Skill definitions and use the same pure evaluators for preview and commit. Web components consume derived tags/effect summaries and never recreate combat rules.

**Tech Stack:** TypeScript 6, Vitest 4, Next.js 16/React 19, pnpm workspaces, Supabase-backed battle persistence.

**Spec:** `docs/superpowers/specs/2026-09-12-combat-effect-taxonomy-rework-design.md`, `docs/superpowers/specs/2026-09-12-combat-authoring-dots-copy-revision-design.md`, `docs/superpowers/specs/2026-09-12-reactive-effects-accuracy-discipline-rebalance-design.md`

## Global Constraints

- All combat state changes, RNG, costs, targeting, damage, recovery, Copy selection, and effect cloning remain server-authoritative.
- Historical pinned Skill/status versions must retain their original behavior; never reinterpret old `burn`, `bleed`, `poison`, `hastened`, `delayed`, `borrowed-hour`, or `regeneration` instances.
- Preview may expose probabilities and eligible pools but must not consume or reveal future RNG results.
- Current Heal/MP Rec total tick count is 1–4, including the immediate tick.
- Current Bleed supports 1–4 end-turn ticks and at most 3 concurrent independent stacks.
- Current Poison is non-stacking, 2 damage at each target end-turn, persists until battle end/Cleanse, and triggers one extra tick per 5 qualifying traversed tiles.
- Current Burn is non-stacking and resolves 4 → 3 → 2 end-turn damage plus 2 backlash after each damaging command while Burned.
- Current Haste changes movement AP by -10 per entered tile; Slow changes it by +10; legal movement AP has a 10 AP floor. Current authored Haste/Slow duration is two owner-turn-start boundaries unless a newly versioned Skill explicitly authors another allowed duration.
- Push/Pull resolve stepwise; Pull may never enter or pass through the source/caster tile.
- Copy may select only committed regular battle Skills, never Essence/Resonance/system commands/copied temporary Skills; copied AP is `ceil(original / 2)` and other costs/mechanics remain pinned.
- Reactive damage/recovery does not recursively trigger other reactive effects.
- Mark is source-specific +15 percentage points accuracy against the marked target for current baseline content; Blind baseline is -15 percentage points accuracy.
- Pierce bypasses defensive mitigation only; it does not suppress vulnerabilities, targeting rules, Reflect, or Absorb.
- Blanket rebalance authority applies to regular Discipline Skill rosters across all 17 Disciplines; preserve Discipline identity and do not redesign unrelated progression/stat systems.
- Production deployment is not part of this plan.

---

### Task 1: Versioned Combat Effect State and Validation Contracts

**Files:**
- Create: `packages/game-core/src/combat/combat-effect-state.ts`
- Modify: `packages/game-core/src/combat/actions.ts`
- Modify: `packages/game-core/src/combat/status-content.ts`
- Modify: `packages/game-core/src/combat/gameplay-tags.ts`
- Modify: `packages/game-core/package.json`
- Create/Test: `packages/game-core/src/combat/combat-effect-state.test.ts`
- Modify/Test: `packages/game-core/src/combat/actions.test.ts`
- Modify/Test: `packages/game-core/src/combat/gameplay-tags.test.ts`

**Interfaces:**
- Consumes: existing `CombatEncounterState`, `CombatActionDefinition`, `CombatStatusDefinition`, `CombatContentCatalog`.
- Produces:
  - `EffectPolarity = 'positive' | 'negative' | 'neutral' | 'mixed'`
  - `ReactionClass = 'ordinary' | 'periodic' | 'reactive' | 'self-cost' | 'system'`
  - `DamageProvenance`
  - `CombatOngoingRecovery`
  - `CombatPoisonInstance`
  - `CombatBleedStack`
  - `CombatBurnInstance`
  - `CombatTemporarySkillGrant`
  - `CombatDamageHistoryEntry`
  - `normalizeCombatEffectState(state)`
  - exported pure `validateCombatActionDefinition(...)` and `validateCombatStatusDefinition(...)` contracts used later by Master Panel publishing.

- [ ] **Step 1: Write failing schema/normalization tests**

```ts
import { describe, expect, it } from 'vitest'
import {
  normalizeCombatEffectState,
  type CombatEffectState,
} from './combat-effect-state'

describe('normalizeCombatEffectState', () => {
  it('normalizes historical snapshots without current effect collections', () => {
    expect(normalizeCombatEffectState({})).toEqual({
      ongoingRecovery: [],
      poison: [],
      bleed: [],
      burn: [],
      temporarySkills: [],
      damageHistory: [],
    } satisfies CombatEffectState)
  })
})
```

Add validator tests that reject Heal/MP Rec tick counts outside 1–4, Bleed totals above 10, non-positive displacement distance, and malformed `accuracyMode`.

- [ ] **Step 2: Run the focused tests and confirm RED**

```bash
pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-effect-state.test.ts src/combat/actions.test.ts src/combat/gameplay-tags.test.ts
```

Expected: FAIL because the current effect-state module/types and new validation branches do not exist.

- [ ] **Step 3: Implement the typed state and compatibility defaults**

```ts
export interface CombatEffectState {
  ongoingRecovery: CombatOngoingRecovery[]
  poison: CombatPoisonInstance[]
  bleed: CombatBleedStack[]
  burn: CombatBurnInstance[]
  temporarySkills: CombatTemporarySkillGrant[]
  damageHistory: CombatDamageHistoryEntry[]
}

export function normalizeCombatEffectState(value: unknown): CombatEffectState {
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<CombatEffectState>
    : {}
  return {
    ongoingRecovery: Array.isArray(input.ongoingRecovery) ? input.ongoingRecovery : [],
    poison: Array.isArray(input.poison) ? input.poison : [],
    bleed: Array.isArray(input.bleed) ? input.bleed : [],
    burn: Array.isArray(input.burn) ? input.burn : [],
    temporarySkills: Array.isArray(input.temporarySkills) ? input.temporarySkills : [],
    damageHistory: Array.isArray(input.damageHistory) ? input.damageHistory : [],
  }
}
```

Extend current status metadata with `polarity`, `amplifyCopyable`, `curseCopyable`, and `reactionClass`, with compatibility defaults for historical definitions.

- [ ] **Step 4: Add the compact player-facing tags**

Add exact derived labels: `Self/Ally`, `Anyone`, `Ground`, `Empty Tile`, `Single`, `Circle X`, `Line X`, `Dmg`, `Water Dmg`, `Storm Dmg`, `Fire Dmg`, `Heal X`, `MP Rec X`, `Push X`, `Pull X`, `Guard`, `Expose`, `Inspire`, `Hex`, `Ghost`, `Summon`, `Haste`, `Slow`, `Off-guard`, `Copy`, `Absorb HP`, `Absorb MP`, `Reflect`, `Pierce`, `Blind`, `Vengeance`, `Amplify`, `Curse`.

Keep `Burn (Scorched)`, `Bleed (Bleeding)`, `Poison (Poisoned)`, `Displaced`, and `Root` exact.

- [ ] **Step 5: Run focused tests and confirm GREEN**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/game-core/src/combat/combat-effect-state.ts packages/game-core/src/combat/combat-effect-state.test.ts packages/game-core/src/combat/actions.ts packages/game-core/src/combat/actions.test.ts packages/game-core/src/combat/status-content.ts packages/game-core/src/combat/gameplay-tags.ts packages/game-core/src/combat/gameplay-tags.test.ts packages/game-core/package.json
git commit -m "feat: add versioned combat effect state"
```

---

### Task 2: Variable Push/Pull and Movement AP Tempo

**Files:** `actions.ts`, `board.ts`, `status-content.ts`, `pv1f-action-economy.ts` and focused tests.

- [ ] Add failing displacement tests for historical Push 1, Push/Pull >1, partial stop, no caster pass-through, Root/edge/occupancy/elevation, Displaced only after movement, deterministic multi-recipient occupancy updates.
- [ ] Add failing Haste/Slow movement AP matrix tests: normal Haste 10, normal Slow 30, both 20, rough Haste 30, Frozen+Slow 40, Airborne Frozen+Haste 10; movement allowance unchanged; Root blocks.
- [ ] Run focused game-core tests and confirm RED.
- [ ] Implement stepwise displacement with `direction?: 'push'|'pull'`, positive `distance`, dominant axis + horizontal tie-break, stop before first illegal tile.
- [ ] Implement signed movement AP delta and 10 AP floor; current `haste`, historical `hastened`/`delayed` pinned.
- [ ] Run GREEN and commit `feat: add push pull and movement tempo`.

### Task 3: Heal X and MP Rec X Scheduled Recovery

**Files:** `combat-effect-state.ts`, `actions.ts`, `pv1f-action-economy.ts` and tests.

- [ ] Failing tests for 1–4 ticks, immediate first tick, caps, Hex each HP tick, no revive, defeat clears future recovery, same-action refresh, different-action coexist, repeat-use falloff on amount only.
- [ ] Implement `CombatOngoingRecovery { kind, sourceCombatantId, targetCombatantId, sourceActionId, amountPerTick, remainingFutureTicks }` and target-end-turn resolution.
- [ ] Keep historical Regeneration pinned; current Skills stop applying it.
- [ ] Run GREEN and commit `feat: add scheduled hp and mp recovery`.

### Task 4: Poison, Bleed, and Burn Runtime

**Files:** `combat-effect-state.ts`, `actions.ts`, `pv1f-action-economy.ts`, `status-content.ts` and tests.

- [ ] Poison tests: 2 end-turn; battle-long; no stack; preserve movement remainder; tick per 5 traversed; Push/Pull count; Revert no; lethal traversal stops movement.
- [ ] Bleed tests: independent max-3 stacks; independent expiry; fewest-remaining/oldest replacement; Cleanse-all; raw-total <=10.
- [ ] Burn tests: 4→3→2; restart/no stack; one 2 backlash per damaging command including miss/AoE/multi-hit; support no; lethal self-backlash.
- [ ] Implement current DoTs outside legacy fixed status-tick limitation; preserve historical versions.
- [ ] Resolve ordinary terminal state after Burn backlash including mutual draw.
- [ ] Run GREEN and commit `feat: implement distinct poison bleed and burn`.

### Task 5: Generalized Accuracy, Mark, Blind, and Pierce

**Files:** `actions.ts`, `stat-driven-combat.ts`, `status-content.ts`, `damage-modifiers.ts` and tests.

- [ ] Hit tests: Basic; single Skill; stable independent multi-target rolls; Automatic Hit; source-specific Mark; Blind; preview-safe chance.
- [ ] Pierce tests: bypass Armor/Ward/positive mitigation; retain Expose/Off-guard/outgoing modifiers/accuracy/target legality/Reflect/Absorb.
- [ ] Implement `combatActionHitChance(...)` with `Accuracy - Evasion + Skill modifier + source Mark - Blind`, clamp 0–100%; Automatic returns null.
- [ ] Implement per-damage-block `piercing?: boolean` that skips mitigation only.
- [ ] Run GREEN and commit `feat: generalize skill accuracy and pierce`.

### Task 6: Damage Provenance, Absorb HP/MP, and Reflect

**Files:** `combat-effect-state.ts`, `actions.ts`, `status-content.ts`, tests.

- [ ] Reaction tests: direct hostile qualifies; periodic/reactive/self-cost/system excluded; Absorb cannot rescue lethal; caps; Reflect once per attacker→defender command; AoE multi-reflector; no recursion; mutual KO.
- [ ] Add `DamageProvenance { kind, sourceCombatantId, sourceActionId, commandExecutionId }`.
- [ ] Resolve HP loss → defeat → if alive Absorb; aggregate actual damage and Reflect after ordinary effects; mark reaction events reactive.
- [ ] Run GREEN and commit `feat: add absorb and reflect reactions`.

### Task 7: Vengeance Three-Round Damage History

**Files:** `combat-effect-state.ts`, `actions.ts`, tests.

- [ ] Ledger tests count actual hostile direct + periodic; exclude overkill/Reflect/self-cost/system; healing does not erase; current + previous two rounds only.
- [ ] Implement conversion `min(max, max(min, floor(recent * basisPoints / 10000)))`; trim older ledger entries on round change.
- [ ] Run GREEN and commit `feat: add vengeance damage history`.

### Task 8: Amplify and Curse Active-Effect Cloning

**Files:** `combat-effect-state.ts`, `actions.ts`, `status-content.ts`, tests.

- [ ] Amplify tests preserve positive state while target keeps it; exclude build/cooldown/resources/copied Skills/terrain/mixed/system/noncopyable.
- [ ] Curse tests copy Poison counter, Burn stage, independent Bleeds, Blind/Slow/Hex/Expose; exclude timeout Off-guard/system/noncopyable.
- [ ] Implement metadata-driven cloning with explicit dynamic-state clone branches rather than one status-name switch.
- [ ] Run GREEN and commit `feat: add amplify and curse effect cloning`.

### Task 9: Copy Temporary Skills and Deterministic RNG

**Files:** `combat-effect-state.ts`, `actions.ts`, `build-snapshot.ts`, `pv1f-action-economy.ts`, `recruit-ai.ts` and tests.

- [ ] Pool tests: committed regular Skills only; exclude Basic/Guard/Recover/Essence/Resonance/system/copied temporary/effective duplicates.
- [ ] RNG tests: commit deterministic; preview pool/count only, no RNG consumption/result leak.
- [ ] Copied-command tests: battle-long; survives source defeat; ceil(AP/2); original MP/target/effects/requirements/cooldown/repeat; clean copied history; no post-battle mutation.
- [ ] Resolve copied commands through pinned mature Skill + AP override, not cloned effect data; AI evaluates actual copied Skill but not future Copy outcome.
- [ ] Run GREEN and commit `feat: add battle skill copy`.

### Task 10: New Current Content Versions and Full Discipline Skill Rebalance

**Files:** `advanced-discipline-content.ts`, `mature-skills.ts`, `status-content.ts`, `essence.ts`, `recruit-ai.ts` and tests.

- [ ] Roster audit test: all enabled regular Discipline Skills validate/tags derive/current requirements only; no current `hastened`, `delayed`, `borrowed-hour`, `regeneration` application/requirement.
- [ ] Required migration assertions: Chronist Haste/Slow/Delay/Time Lock/Temporal Ward/Stolen Moment/Borrowed Hour; Tidecaller Undertow/Springwater; Wildwarden Venom Shot/Renewing Herbs; Edgedancer Severing Cut; Cinderweaver Flame Burst; Dawnshield Renewal with approved values.
- [ ] Audit all 17 regular Discipline rosters for AP/MP/cooldown/potency/accuracy/shape/effects/duration/utility/AI.
- [ ] Distribute new mechanics by identity, not evenly; price battle-long Poison/Copy/reactions/cloning properly.
- [ ] Create new immutable versions only.
- [ ] Run GREEN and commit `feat: rebalance discipline skill roster`.

### Task 11: Server Battle Snapshot, Preview, Commit, and AI Integration

**Files:** battle build authority, preview/session/AI/PvP services and tests.

- [ ] Snapshot pins exact new versions; old snapshots normalize.
- [ ] Preview per-target accuracy/resolved AP/recovery/displacement/Vengeance/Copy pool without RNG consumption.
- [ ] Commit rejects arbitrary untagged Skills but accepts actor-owned temporary copies; AI uses same definitions.
- [ ] Run focused web server tests; update server resolution; re-run GREEN.
- [ ] Commit `feat: integrate expanded combat effects with battle authority`.

### Task 12: Shared Battle/Profile Presentation and Copied Skill Picker

**Files:** `skill-detail-presentation.ts`, combat interaction/effect summary/combatant effects/skill command/preview/action preview/experience; create `battle-copied-skill-picker.tsx`; tests.

- [ ] Exact compact tag tests.
- [ ] Active effect summaries for Poison/Bleed/Burn/recovery/Mark/Blind/reactions.
- [ ] Copied Skills group tests: one compact picker, existing target/forecast, copied AP + original MP/effects.
- [ ] Implement from derived/server data only; no React combat math/RNG.
- [ ] Run GREEN and commit `feat: present expanded combat effects and copied skills`.

### Task 13: Runtime Verification and Combat Documentation

- [ ] `pnpm --filter @aurevane/game-core test`
- [ ] focused web battle Vitest
- [ ] `pnpm check`
- [ ] representative browser regression: `battle-experience`, `battle-cockpit-skill-slots`, `phase4-ground-targeting`
- [ ] Update `docs/COMBAT.md`; `TASKS.md` only if current convention requires it.
- [ ] Commit `docs: record expanded combat effect runtime`.
