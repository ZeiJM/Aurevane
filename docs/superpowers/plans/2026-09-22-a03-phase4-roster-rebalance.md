# A03 Phase 4 Roster Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Correct the systemic Phase-4 combat balance defects, activate authoritative Critical Chance, normalize AP/MP efficiency, and add a deterministic 17-Discipline balance harness without rewriting historical battle semantics.

**Architecture:** Introduce a new current stat-bridge/combat-rules version for Critical Chance while preserving old v1-v3 snapshots. Centralize current-rules direct-damage scaling policy so Basic Attack and mature Skills share one AP-aware coefficient source, migrate current mystic content through versioned definitions, then measure the resulting 17-Discipline roster through deterministic scenario fixtures rather than a single class score.

**Tech Stack:** TypeScript, Vitest, existing `@aurevane/game-core` combat/character packages, existing versioned combat-content authority, pnpm/Turborepo, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-22-a03-phase4-roster-rebalance-design.md`

## Global Constraints

- Current direct-damage Skill Power budget is `AP cost × 50` basis points.
- Basic Attack remains 30 AP and uses 15% Physical Power under the new current combat rules.
- Multi-hit/multi-block commands split one command-level Power budget; hit count never multiplies the total coefficient.
- Current published mystic regular Skills and Essence Skills use `max(2, floor(AP / 15))` MP unless a separately versioned explicit exception exists.
- Current authoritative Critical Chance uses committed Finesse-derived `criticalChance` and deals 150% qualifying direct damage.
- One critical roll occurs per affected target per command after a successful hostile hit; all qualifying direct-damage packets for that target share it.
- Periodic, reactive, fixed/system, DoT and non-direct damage do not crit.
- Preview exposes probability only and never advances RNG.
- Historical battle-pinned Skill/Essence definitions and stat-bridge/combat-rules v1-v3 semantics remain readable and unchanged.
- Phase-4 class roles remain asymmetric; the harness reports dimensions rather than a hidden single “power score.”
- A04, A07 and A10 remain open and are not closed by this work.
- No Production deployment, Production DB mutation, or Vercel release toggle is authorized by this plan.

## Review Focus

- A v3 historical battle must not suddenly gain crits or AP-weighted scaling after current-rule constants change.
- Multi-target/multi-hit commands must consume RNG in stable target order and at most one crit draw per successfully hit target.
- Missed hostile targets must not consume a crit draw, while automatic-hit/self/allied commands must not invent hostile crit semantics.
- Mystic MP migration must preserve exact historical versions and avoid charging non-mystic Skills merely because they deal damage.
- Basic Attack and mature Skill scaling must remain deterministic under Level modifiers, Armor/Ward, facing, repeat-use and status multipliers.

---

### Task 1: Current combat stat bridge v4 with Critical Chance

**Files:**
- Modify: `packages/game-core/src/combat/stat-driven-combat.ts`
- Modify: `packages/game-core/src/combat/stat-driven-combat.test.ts`
- Modify: `packages/game-core/src/combat/combat-level-scaling.test.ts` only if current-version guards need an explicit v4 regression
- Test: `packages/game-core/src/combat/stat-driven-combat.test.ts`

**Interfaces:**
- Consumes: `DerivedStatSnapshot.stats.criticalChance.value`
- Produces: current `StatDrivenCombatProfileV4` carrying `criticalChance: number`, with v1-v3 compatibility preserved.

- [ ] **Step 1: Write failing tests**
  - Current character-derived profiles include the derived Critical Chance.
  - Current stat bridge rejects malformed/missing Critical Chance.
  - Historical v1/v2/v3 snapshots remain valid without Critical Chance.

- [ ] **Step 2: Run focused tests and confirm RED**
  - Run `pnpm --filter @aurevane/game-core test -- stat-driven-combat.test.ts`.

- [ ] **Step 3: Implement stat-bridge v4**
  - Add explicit v4 schema/rules constants.
  - Keep named v1/v2/v3 interfaces for historical parsing.
  - Add `StatDrivenCombatProfileV4 extends StatDrivenCombatProfileV3 { criticalChance: number }`.
  - Make new character-derived/current encounters emit v4.
  - Validate Critical Chance as basis points from 0..10000.
  - Keep v3 rows accepted unchanged.

- [ ] **Step 4: Run focused tests and confirm GREEN**

- [ ] **Step 5: Commit**
  - Commit message: `feat: carry critical chance into current combat profiles`

### Task 2: AP-weighted current damage scaling and Basic Attack normalization

**Files:**
- Modify: `packages/game-core/src/combat/damage-scaling.ts`
- Modify: `packages/game-core/src/combat/damage-scaling.test.ts`
- Modify: `packages/game-core/src/combat/pv1f-action-economy.ts`
- Modify: `packages/game-core/src/combat/pv1f-action-economy.test.ts`
- Modify: `packages/game-core/src/combat/actions-stat-scaled-damage.test.ts`

**Interfaces:**
- Produces:
  - `currentSkillDamageScaling(source, damageEffectCount, apCost)`
  - command-level coefficient `apCost * 50` basis points split deterministically across damage blocks.
  - `PV1F_BASIC_ATTACK_POWER_SCALING_BASIS_POINTS = 1500`.

- [ ] **Step 1: Write failing tests**
  - 25/30/35/40/45/50/55/60/65 AP map exactly to 1250/1500/1750/2000/2250/2500/2750/3000/3250 bp.
  - Two/three/seven damage blocks conserve the command-level coefficient within deterministic integer rounding.
  - Basic Attack is 1500 bp at 30 AP.
  - Historical rules do not acquire the new current scaling.

- [ ] **Step 2: Run focused tests and confirm RED**

- [ ] **Step 3: Implement AP-aware scaling**
  - Replace the fixed current Skill coefficient helper with AP-aware command budget math.
  - Pass resolved authoritative AP cost into the mature-Skill materializer.
  - Keep explicit authored scaling/vengeance untouched.
  - Change current Basic Attack coefficient to 1500.

- [ ] **Step 4: Run focused tests and confirm GREEN**

- [ ] **Step 5: Commit**
  - Commit message: `balance: weight direct damage scaling by action cost`

### Task 3: Authoritative Critical Chance resolution

**Files:**
- Create: `packages/game-core/src/combat/combat-critical.ts`
- Create: `packages/game-core/src/combat/combat-critical.test.ts`
- Modify: `packages/game-core/src/combat/actions.ts`
- Modify: `packages/game-core/src/combat/actions-legacy.ts` only for the deterministic critical multiplier insertion point/metadata surface if required
- Modify: `packages/game-core/src/combat/combat-kernel-types.ts` if versioned critical receipts belong in shared kernel event typing
- Modify: `packages/game-core/src/combat/pv1f-action-economy.ts`

**Interfaces:**
- Produces:
  - `COMBAT_CRITICAL_DAMAGE_BASIS_POINTS = 15000`
  - deterministic preview probability from attacker `criticalChance`
  - one commit roll per qualifying successfully hit hostile target in stable target ID order
  - versioned `combat_critical_resolved` event carrying actor, target, chance, roll and critical result.

- [ ] **Step 1: Write failing critical tests**
  - 0% never crits and consumes no unnecessary draw.
  - Intermediate chance uses deterministic RNG.
  - 100% always crits.
  - Multi-hit command gets one target-level roll and one shared result.
  - Multi-target command rolls once per successfully hit target in stable order.
  - Missed target does not consume a crit roll.
  - DoT/reactive/fixed damage does not crit.
  - Preview is RNG-pure.

- [ ] **Step 2: Run focused tests and confirm RED**

- [ ] **Step 3: Implement critical materialization**
  - Keep accuracy resolution first.
  - Build the qualifying target list after misses are known.
  - Advance battle RNG only for qualifying targets whose chance is between endpoints when necessary.
  - Apply the same 150% multiplier to every qualifying direct damage packet for that target.
  - Emit deterministic receipts before ordinary committed damage events.
  - No v1-v3 bridge gains critical behavior.

- [ ] **Step 4: Run critical + accuracy + action tests and confirm GREEN**

- [ ] **Step 5: Commit**
  - Commit message: `feat: resolve authoritative critical hits`

### Task 4: Normalize current mystic MP costs through versioned content

**Files:**
- Modify: `packages/game-core/src/combat/mature-skills.ts`
- Modify: `packages/game-core/src/combat/essence.ts`
- Modify: `packages/game-core/src/combat/mature-skills.test.ts`
- Modify: `packages/game-core/src/combat/essence.test.ts`
- Modify: `packages/game-core/src/combat/phase4-discipline-rebalance.test.ts`
- Modify: versioned combat-content DB migration/tests only if current DB publication lineage requires explicit new immutable rows.

**Interfaces:**
- Produces:
  - `currentMysticMpCost(apCost) = max(2, floor(apCost / 15))`
  - new current content versions for any definition whose historical MP cost differs.

- [ ] **Step 1: Write failing catalog tests**
  - Every current regular/Essence Skill tagged `mystic` matches the formula.
  - Current non-mystic Skills do not gain MP cost.
  - Historical Foundation versions still resolve with their old MP values.
  - Current advanced versions that already match the formula remain semantically unchanged except version lineage when required.

- [ ] **Step 2: Run catalog tests and confirm RED**

- [ ] **Step 3: Implement versioned MP normalization**
  - Add one shared helper.
  - Append current versions; never mutate historical entries.
  - Apply the same rule to Essence Skills.
  - Preserve battle-snapshot resolution by exact content version.

- [ ] **Step 4: Run mature Skill/Essence/publication tests and confirm GREEN**

- [ ] **Step 5: Commit**
  - Commit message: `balance: normalize mystic skill resource costs`

### Task 5: 17-Discipline deterministic balance harness

**Files:**
- Create: `packages/game-core/src/combat/phase4-balance-harness.ts`
- Create: `packages/game-core/src/combat/phase4-balance-harness.test.ts`
- Modify: `content/balance/README.md`
- Optionally create generated checked-in CSV/JSON only if the existing project convention requires a durable report; do not make generated output authoritative.

**Interfaces:**
- Produces per-Discipline dimension records for representative scenarios:
  - direct damage/AP
  - setup→payoff damage/AP
  - Essence damage/support
  - heal/recovery/AP
  - mitigation/protection projection
  - control/movement AP denial
  - MP spent/restored
  - range/area metadata
  - repeat-use outcome
  - representative Resonance bonus.

- [ ] **Step 1: Write failing harness tests**
  - Exactly 17 published Disciplines are represented.
  - Level 25/50/100 representative fixtures are deterministic.
  - All numeric outputs are finite/nonnegative where applicable.
  - No single aggregate “power score” field exists.
  - Role dimensions distinguish damage, support and control.

- [ ] **Step 2: Run harness tests and confirm RED**

- [ ] **Step 3: Implement harness using authoritative calculators**
  - Reuse derived stats, current Skill/Essence definitions and combat scaling functions.
  - Do not duplicate combat formulas.
  - Make target Armor/Ward/range assumptions explicit constants.

- [ ] **Step 4: Run harness tests and inspect output for obvious systemic outliers**

- [ ] **Step 5: Commit**
  - Commit message: `test: add Phase 4 roster balance harness`

### Task 6: Class-specific A03 tuning from harness evidence

**Files:**
- Modify only the Skill/Essence definitions whose harness evidence justifies a change.
- Modify corresponding focused tests.
- Add versioned DB publication/migration records if current published semantics change.

**Interfaces:**
- Consumes: Task 5 dimension output.
- Produces: smallest justified class-specific current-version changes; no blanket all-class retune.

- [ ] **Step 1: Record the evidence-backed outliers**
  - Compare each class only against relevant role peers and its intended compensation (range, control, healing, protection, conditions, risk).
  - Explicitly inspect Vanguard, Farstrider, Shadehand, Ironfist, Aetherist, Lifebinder, Bastion, Ravager, Edgedancer, Wildwarden, Runeblade, Dawnshield, Cinderweaver, Frostweaver, Stormsinger, Tidecaller and Chronist.

- [ ] **Step 2: Add failing tests for each actual tuning change**
  - Each test states the exact old/current mismatch and the intended new AP/base/status/resource value.

- [ ] **Step 3: Append minimal new content versions**
  - Do not rewrite old versions.
  - Avoid changes where the systemic fixes already put the class in its intended envelope.

- [ ] **Step 4: Rerun harness and focused class tests**

- [ ] **Step 5: Commit**
  - Commit message: `balance: tune Phase 4 discipline outliers`

### Task 7: Canonical docs and exact-head verification

**Files:**
- Modify: `docs/COMBAT.md`
- Modify: `docs/PHASE_4_TICKETS.md`
- Modify: `content/balance/README.md`

**Interfaces:**
- Documents the exact rules implemented by Tasks 1-6 and leaves A04/A07/A10 open.

- [ ] **Step 1: Update COMBAT**
  - Remove stale Basic Attack Level/Might/Finesse equation.
  - Document 15% Basic Attack Physical Power scaling.
  - Document AP-weighted mature-Skill scaling.
  - Document normalized mystic MP costs.
  - Document authoritative Critical Chance and resolution order.
  - Keep relative Character Level as a separate multiplier.

- [ ] **Step 2: Update Phase-4 closeout ledger**
  - Record A03 engineering rebalance as complete only after exact-head verification.
  - Explicitly keep A04, A07 and A10 open.

- [ ] **Step 3: Run focused suite**
  - `pnpm --filter @aurevane/game-core test`

- [ ] **Step 4: Run repository verification**
  - `pnpm check`
  - applicable database/publication security tests
  - applicable Representative Buildcraft / Browser Smoke workflows after push.

- [ ] **Step 5: Inspect exact-head CI**
  - No completion claim unless all applicable exact-head checks are green.
  - If any check fails, fix on the branch and repeat exact-head verification.

- [ ] **Step 6: Commit docs**
  - Commit message: `docs: record A03 roster rebalance rules`
