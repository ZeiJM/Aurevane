# Combat v5.1 Technique Balance & Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish new current regular Technique versions with the approved AP bands and explicit range/elevation/LOS tradeoffs while preserving Combat v5 historical versions.

**Architecture:** Add a new v5.1 rebalance layer after the existing v5 registry rather than mutating v5. The scorer uses multiplicative targeting factors anchored at range 3 and explicit elevation/LOS premiums, while cooldown/value scoring includes the same dimensions. Master Panel validation recognizes v5.1 bounds by validation tag.

**Tech Stack:** TypeScript, Vitest, existing versioned Mature Skill registry, Next.js Master Panel.

**Spec:** `docs/superpowers/specs/2026-09-28-combat-v5-1-targeting-summons-resonance-design.md`

## Global Constraints

- Current regular Attack Techniques: 45–60 AP.
- Current regular Utility/MP-only recovery Techniques: 35–50 AP.
- Current HP-healing Recovery Techniques: 45–60 AP.
- Non-self maximum range is 1–5, with range 3 the common/median reach.
- Most Techniques use elevation 0; elevation 1 is sparse; elevation 2 is rarer.
- Non-self LOS bypass consumes balance budget.
- Historical `owner-rebalance-v5` content remains byte/semantic stable and resolvable.
- New definitions use `owner-rebalance-v5-1`.
- Essence retains its separate higher/signature band.
- Do not merge or deploy as part of this plan.

## Review Focus

- Mixed damage+healing Skills must classify consistently and not fall into an unintended cheap band.
- Self-target Skills must not be penalized for no LOS or range 0.
- Requirement-gated Skills must still receive no cooldown.
- Explicit historical minimum ranges must remain runtime-authoritative even though Preview displays only max range.
- PvP overrides must stay within compatible AP bounds and must not silently resurrect v5 values.

---

### Task 1: Add v5.1 role and targeting budget primitives

**Files:**
- Create: `packages/game-core/src/combat/skill-balance-v5-1.ts`
- Create: `packages/game-core/src/combat/skill-balance-v5-1.test.ts`

**Interfaces:**
- Produces: `type V51SkillRole = 'attack' | 'utility' | 'recovery'`.
- Produces: `classifyV51SkillRole(definition: MatureSkillDefinition): V51SkillRole`.
- Produces: `v51TargetingMagnitudeFactor(definition: MatureSkillDefinition): number`.
- Produces: `v51TargetingValueWeight(definition: MatureSkillDefinition): number`.
- Produces: `rebalanceMatureSkillDefinitionV51(definition: MatureSkillDefinition, kind?: RebalanceSkillKind): MatureSkillDefinition`.

- [ ] **Step 1: Write failing unit tests**
  - attack role clamps AP to 45–60;
  - HP healing role clamps AP to 45–60;
  - MP-only recovery classifies as utility and clamps to 35–50;
  - range factors are ordered `r1 > r2 > r3 > r4 > r5` with r3 baseline;
  - otherwise-equal elevation 1 < elevation 0 magnitude, elevation 2 < elevation 1;
  - otherwise-equal no-LOS non-self Skill < LOS-required magnitude;
  - self target ignores LOS penalty.

- [ ] **Step 2: Run test and verify RED**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/skill-balance-v5-1.test.ts`

- [ ] **Step 3: Implement the primitives**
  - AP rounding remains 5-point increments.
  - Target factor is anchored at range 3 and multiplies range, elevation, and LOS factors.
  - Requirement factor and existing area/multi-effect/duration logic remain compatible with v5.
  - Cooldown scoring adds the same targeting advantages rather than only maximum range.

- [ ] **Step 4: Run test and verify GREEN**

- [ ] **Step 5: Commit**

Commit message: `feat: add Combat v5.1 targeting budget`

---

### Task 2: Publish new regular Technique versions

**Files:**
- Modify: `packages/game-core/src/combat/mature-skills.ts`
- Modify: `packages/game-core/src/combat/mature-skills.test.ts`
- Modify: `packages/game-core/src/combat/skill-balance-v5-1.test.ts`
- Modify: `packages/game-core/src/combat/representative-buildcraft.test.ts`

**Interfaces:**
- Consumes: `rebalanceMatureSkillDefinitionV51`.
- Produces: `V51_REBALANCED_DISCIPLINE_SKILLS` appended after v5 definitions in the current registry.
- Historical `P33_REPRESENTATIVE_DISCIPLINE_SKILLS` and v5 versions remain unchanged.

- [ ] **Step 1: Write failing full-catalog contracts**
  - exactly 136 latest enabled regular Techniques;
  - every latest definition contains `owner-rebalance-v5-1`;
  - AP band matches role;
  - every non-self max range is 1–5;
  - median max range is 3;
  - elevation counts satisfy `count(0) > count(1) > count(2) > 0`;
  - no current regular Technique exceeds elevation 2;
  - historical v5 versions resolve to their pre-v5.1 values.

- [ ] **Step 2: Define the sparse elevation policy in `skill-balance-v5-1.ts`**
  - Use explicit stable-ID allowlists for elevation 1 and elevation 2.
  - Elevation 2 list must be a strict subset in count, not in membership, of elevation-privileged Skills.
  - All other non-self Skills become elevation 0.
  - Preserve self target `null`.

- [ ] **Step 3: Generate v5.1 versions and run catalog tests**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/skill-balance-v5-1.test.ts src/combat/mature-skills.test.ts src/combat/representative-buildcraft.test.ts`

Expected: pass with no historical mutation.

- [ ] **Step 4: Commit**

Commit message: `feat: rebalance current Technique targeting`

---

### Task 3: Apply v5.1 bounds in authoring

**Files:**
- Modify: `packages/game-core/src/combat/mature-skills.ts`
- Modify: `apps/web/src/components/master/combat-content/skill-targeting-editor.tsx`
- Modify: `apps/web/src/components/master/combat-content/skill-targeting-editor.test.tsx`
- Modify: `apps/web/src/components/master/combat-content/skill-economy-editor.tsx`
- Modify: `apps/web/src/components/master/combat-content/skill-economy-editor.test.tsx`
- Modify: `apps/web/src/server/master/combat-content-authoring-service.test.ts`

**Interfaces:**
- Validation branches on `owner-rebalance-v5-1`.
- For current v5.1 regular Techniques: non-self max range 1–5; elevation 0–2; role AP band enforced.
- Historical tags keep historical validation acceptance.

- [ ] **Step 1: Write failing validation/editor tests**
  - reject v5.1 max range 6;
  - reject v5.1 elevation 3;
  - reject role AP outside its band;
  - allow historical content with old values;
  - editor input attributes expose max=5 for current non-self range and max=2 for current elevation.

- [ ] **Step 2: Run tests and verify RED**

Run:
`pnpm --filter @aurevane/web exec vitest run src/components/master/combat-content/skill-targeting-editor.test.tsx src/components/master/combat-content/skill-economy-editor.test.tsx src/server/master/combat-content-authoring-service.test.ts`

- [ ] **Step 3: Implement validation/editor bounds**
  - Keep line length/circle radius separate from max range.
  - Add concise hints that elevation and LOS bypass spend balance budget.

- [ ] **Step 4: Re-run tests and verify GREEN**

- [ ] **Step 5: Commit**

Commit message: `feat: enforce v5.1 targeting authoring bounds`

---

### Task 4: Re-evaluate Essence and documentation against the new targeting budget

**Files:**
- Modify: `packages/game-core/src/combat/essence.ts`
- Modify: `packages/game-core/src/combat/essence.test.ts`
- Modify: `apps/web/src/content/techniques-manual.ts`
- Modify: `apps/web/src/content/current-manual.test.ts`
- Modify: `docs/COMBAT.md`

**Interfaces:**
- Essence remains signature/high-cost but uses the v5.1 range/elevation/LOS factor where targetable.
- Manual documents maximum-range display and elevation/LOS tradeoffs.

- [ ] **Step 1: Add failing Essence balance contracts for range/elevation/LOS tradeoffs.**
- [ ] **Step 2: Rebalance only current Essence versions if required; preserve historical versions.**
- [ ] **Step 3: Update Manual/docs and tests.**
- [ ] **Step 4: Run game-core/web tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `docs: document Combat v5.1 targeting balance`

---

### Task 5: Balance verification gate

**Files:**
- No production files unless verification exposes a defect.
- Test: `packages/game-core/src/combat/representative-buildcraft.test.ts`
- Test: `apps/web/e2e/p3-8-representative-buildcraft.pw.ts`

- [ ] **Step 1: Run full game-core suite**

Run:
`pnpm --filter @aurevane/game-core test && pnpm --filter @aurevane/game-core typecheck`

- [ ] **Step 2: Run representative browser buildcraft**

Run:
`pnpm --filter @aurevane/web exec playwright test e2e/p3-8-representative-buildcraft.pw.ts --project=desktop-chromium`

- [ ] **Step 3: Run root format check**

Run:
`pnpm format:check`

- [ ] **Step 4: Commit only if verification required a corrective code change.**
