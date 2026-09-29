# Combat v5.1 Resonance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce varied current Resonances with optional Setup, 1–2 tag Trigger matchers, 1–2 Result effects, and compact Setup/Trigger/Result presentation while preserving historical v1 sequence behavior.

**Architecture:** Add Resonance schema v2 alongside the existing schema v1. A normalization/compatibility layer projects v1 `setup/payoff/payoffEffects` into the new runtime view without rewriting stored history. New v2 runtime supports sequence and immediate trigger modes, and the current 136-pair catalog is re-versioned through a deterministic thematic rebalance.

**Tech Stack:** TypeScript, versioned Resonance registry/runtime, React/Next.js Nexus, Master Panel, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-28-combat-v5-1-targeting-summons-resonance-design.md`

## Global Constraints

- Historical Resonance schema v1 and pinned versions retain exact behavior.
- Current v2 matchers use at most 2 required tags per existing stage.
- Current v2 Result effects count is 1–2.
- Sequence mode has Setup + Trigger; immediate mode has no Setup.
- Immediate mode receives a smaller Result budget than an otherwise comparable sequence mode.
- Player-facing terms are Setup / Trigger / Result; `Payoff` disappears from current UI.
- Result explanations render below the compact Resonance table.
- Do not merge or deploy as part of this plan.

## Review Focus

- Immediate Resonance must not leave or require stale armed state.
- Ground-target Trigger Skills must retain existing single-unit payoff legality constraints.
- Historical v1 serialized definitions must still validate/resolve without v2 fields.
- Two-tag matcher specificity must use AND semantics, not OR.
- Current catalog variation must be mechanical, not only renamed flavor text.

---

### Task 1: Add Resonance schema v2 compatibility model

**Files:**
- Modify: `packages/game-core/src/combat/resonance.ts`
- Modify: `packages/game-core/src/combat/resonance.test.ts`

**Interfaces:**
- Produces: `RESONANCE_SCHEMA_VERSION_V2 = 2`.
- Produces: `ResonanceTriggerV2`:
  - `kind: 'skill-trigger'`
  - `setup: ResonanceSkillMatcher | null`
  - `trigger: ResonanceSkillMatcher`
  - `resultEffects: readonly CombatEffectDefinition[]`
  - AI utility fields.
- Produces: `NormalizedResonanceTrigger` and `normalizeResonanceTrigger(definition)` so runtime code handles v1 and v2 uniformly.
- v2 validation: setup/trigger tag count 1–2; result count 1–2.

- [ ] **Step 1: Write failing compatibility tests**
  - v1 definition normalizes to sequence semantics;
  - v2 sequence validates;
  - v2 immediate validates with setup null;
  - 3 tags fails;
  - 3 results fails;
  - empty trigger tags fails.

- [ ] **Step 2: Run tests and verify RED**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/resonance.test.ts`

- [ ] **Step 3: Implement schema/normalization without mutating v1 types.**
- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: add Resonance v2 trigger schema`

---

### Task 2: Implement immediate and sequence runtime semantics

**Files:**
- Modify: `packages/game-core/src/combat/resonance.ts`
- Modify: `packages/game-core/src/combat/pv1f-resonance.ts`
- Modify: `packages/game-core/src/combat/resonance.test.ts`
- Modify: `packages/game-core/src/combat/pv1f-resonance.test.ts`

**Interfaces:**
- `forecastResonanceForSkill` uses normalized trigger.
- Immediate mode activates whenever Trigger matches and never arms/expires setup state.
- Sequence mode preserves arm → consume/expire semantics.
- Existing target-constraining behavior applies to Result effects.

- [ ] **Step 1: Write failing runtime tests**
  - immediate Trigger activates from unarmed state;
  - immediate nonmatch does nothing and does not arm;
  - sequence behavior remains unchanged;
  - two-tag Trigger requires both tags;
  - v1 historical fixture produces the same events/effects as before.

- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement normalized runtime path.**
- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: support immediate Resonance triggers`

---

### Task 3: Rebalance current Resonance catalog for variation

**Files:**
- Create: `packages/game-core/src/combat/resonance-balance-v5-1.ts`
- Create: `packages/game-core/src/combat/resonance-balance-v5-1.test.ts`
- Modify: `packages/game-core/src/combat/resonance.ts`
- Modify: `packages/game-core/src/combat/resonance.test.ts`

**Interfaces:**
- Produces: `rebalanceResonanceDefinitionV51(definition): ResonanceDefinition`.
- Current v2 catalog contains deterministic mixtures of immediate/sequence modes, 1/2 tag matchers, and 1/2 Result effects.
- Balance score weights setup existence, tag specificity, effect magnitude, duration, recipient, and utility.

- [ ] **Step 1: Write failing full-catalog contracts**
  - all 136 current pairs validate;
  - all current definitions use schema v2/`owner-rebalance-v5-1`;
  - both immediate and sequence modes exist;
  - both one-tag and two-tag matchers exist;
  - both one-result and two-result definitions exist;
  - semantic Result families include damage, recovery/resource, status/control, and cleanse/utility;
  - changing only opaque Resonance id does not alter mechanics;
  - historical v1/v5 versions resolve unchanged.

- [ ] **Step 2: Implement deterministic thematic rebalance**
  - Use Discipline identities/tags, not Resonance id hash, to choose mode/matchers/results.
  - Immediate mode applies a lower magnitude/result-weight cap.
  - Sequence two-tag setups can receive stronger Result budget than one-tag immediate triggers.

- [ ] **Step 3: Run catalog tests and verify GREEN.**
- [ ] **Step 4: Commit**

Commit message: `feat: diversify current Resonance mechanics`

---

### Task 4: Update Nexus Resonance preview

**Files:**
- Modify: `apps/web/src/components/character/character-arsenal-shell.tsx`
- Modify: `apps/web/src/components/character/character-arsenal-shell.module.css`
- Reuse: `apps/web/src/components/character/compact-skill-effect-summary.tsx`
- Create: `apps/web/src/components/character/resonance-preview-presentation.test.ts`

**Interfaces:**
- Produces compact rows:
  - `Setup: <discipline · tags>` or `Setup: None`
  - `Trigger: <discipline · tags>`
  - one `Result: <compact effect>` row per Result effect.
- Produces explanation list using the same effect explanation vocabulary as Techniques.

- [ ] **Step 1: Write failing presentation/source tests**
  - no current `Payoff` label;
  - immediate shows `Setup: None`;
  - Result effect explanations present;
  - excessive top whitespace removed;
  - compact effect magnitude/duration renderer reused.

- [ ] **Step 2: Run test and verify RED.**
- [ ] **Step 3: Implement compact preview layout.**
- [ ] **Step 4: Run test and Nexus browser proof.**
- [ ] **Step 5: Commit**

Commit message: `feat: streamline Resonance preview`

---

### Task 5: Update Master Panel Resonance authoring

**Files:**
- Modify: `apps/web/src/components/master/combat-content/resonance-content-editor.tsx`
- Create or modify: `apps/web/src/components/master/combat-content/resonance-content-editor.test.tsx`
- Modify: `apps/web/src/server/master/combat-content-authoring-service.ts`
- Modify: `apps/web/src/server/master/combat-content-authoring-service.test.ts`
- Modify: `apps/web/src/components/master/combat-content/combat-content-review-panel.tsx`

**Interfaces:**
- Editor exposes mode `Sequence` / `Immediate`.
- Sequence mode exposes Setup Discipline + 1–2 tags.
- Both expose Trigger Discipline + 1–2 tags.
- Effect editor labeled `Result`, limited to 1–2 entries.
- Validation/diff/history support both schema versions but new drafts publish v2.

- [ ] **Step 1: Write failing editor/service tests**
  - current editor labels are Setup / Trigger / Result and contain no Payoff label;
  - Immediate mode serializes `setup: null` and hides/disables Setup matcher controls;
  - Sequence mode requires a Setup matcher;
  - Setup/Trigger tag inputs accept 1–2 canonical tags and reject a third;
  - Result editor accepts 1–2 effects and rejects a third;
  - service accepts historical v1 definitions for history/rollback while new current drafts validate/publish as schema v2;
  - semantic diff reports mode, matcher, and Result changes.
- [ ] **Step 2: Implement current v2 authoring controls and compatibility readout for v1 history.**
- [ ] **Step 3: Run tests and verify GREEN.**
- [ ] **Step 4: Commit**

Commit message: `feat: author Resonance v2 mechanics`

---

### Task 6: Resonance documentation and verification

**Files:**
- Modify: `apps/web/src/content/techniques-manual.ts`
- Modify: `apps/web/src/content/current-manual.test.ts`
- Modify: `docs/COMBAT.md`

- [ ] **Step 1: Update player-facing Resonance terminology to Setup / Trigger / Result and describe immediate variants.**
- [ ] **Step 2: Run Resonance + Manual suites.**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/resonance.test.ts src/combat/pv1f-resonance.test.ts src/combat/resonance-balance-v5-1.test.ts`

Run:
`pnpm --filter @aurevane/web exec vitest run src/content/current-manual.test.ts`

- [ ] **Step 3: Run `pnpm format:check`.**
- [ ] **Step 4: Commit**

Commit message: `docs: document Resonance v5.1 rules`
