# Stat Balance and Battle Reader Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Implement the Owner's stat/elevation/resistance rules and shared compact readers without changing historical battles or approved artwork.

**Architecture:** Extend existing derived rules with a versioned piecewise curve. Pin an independent encounter policy while keeping combat bridge4. Reuse canonical action/effect materialization, pure forecast/resolve helpers and shared viewer projection; presentation consumes these authorities.

**Tech Stack:** TypeScript, existing Vitest/React/Vite/Playwright, Next.js server services, existing GitHub CI and Vercel release pipeline.

**Spec:** `docs/superpowers/plans/2026-10-05-stat-balance-spec.md`

## Global Constraints

- Preserve rulesets1–3 and encounters without statBalancePolicyVersion1.
- Physical Defense/Mystic Defense keep internal armor/ward identifiers.
- Accuracy140% subtracts Evasion before probability clamping; Core caps60/40 remain.
- No artwork resize, duplicate combat authority, new dependencies, or unrelated work.
- One combined verified Production release is already authorized.

## Review Focus

- Old pinned battles with queued effects retain resolution/RNG (tasks2/3 compatibility tests).
- High Accuracy+terrain+Mark/Blind modifiers remain forecast/commit identical (task2).
- Partial-area hit/resistance and mixed Resonance origins filter only intended ordinals (task3).
- Raised tile descent/rewind/displacement never traps or permits illegal entry (task3).
- Short/mobile result readers and parchment parameter contrast retain complete contents (task4 browser matrices).

### Task 1: Derived curves and current labels

**Files:** `packages/game-core/src/character/{derived-stats,discipline-build,profile-stat-content}.ts` and adjacent tests.
**Interfaces:** Produce `DERIVED_STAT_RULESET_V4`, current default calculation and effective Primary build values. Preserve explicit older ruleset APIs.

- [x] Add anchor tests for all base/40/60 values, intermediate40 breakpoint, Level invariance, cap enforcement and every Primary offset policy.
- [x] Observe targeted failures with `pnpm --filter @aurevane/game-core test -- src/character/derived-stats.test.ts src/character/discipline-build.test.ts`.
- [x] Implement piecewise integer contributions, defaultV4 and current labels; retain equipment modifiers and historicalV3 explicitly.
- [x] Verify targeted tests/typecheck and current content explanations.

### Task 2: Combat bridge and dynamic accuracy/defense

**Files:** `packages/game-core/src/combat/{stat-driven-combat,combat-skill-accuracy}.ts`, shared `combat-stat-balance.ts`, encounter server constructors and tests.
**Interfaces:** `CombatEncounterState.statBalancePolicyVersion?:1`, `StatDrivenCombatProfile.statusResistance?:number`; constructor `createStatBalancedCombatEncounterState(base,profiles)` opts new completeV4 profiles into policy1. Shared terrain helpers return Evasion bonus and adjusted defense from committed placement.

- [x] Add tests:14000−5500=8500, terrain1500/2000/2500, onlyterrain bypass,80%both defenses, oldpolicy unchanged, invalidpin/profile rejection and exact forecast/commit.
- [x] Run focusedtests to observe red.
- [x] Extend profile copies/validation, add policy constructor and shared terrain helpers, wire hit/BasicAttack/damage adapters and new PvE/PvP/previews.
- [x] Verify targeted tests and server constructor persistence/summons/rollback/reattach coverage.

### Task 3: Absolute movement and resistance

**Files:** `packages/game-core/src/combat/{board,actions,actions-legacy,combat-status-resistance,recruit-ai-build}.ts` and tests; web viewer projection and rail tests.
**Interfaces:** Consume task2policy/profile/helper contracts. Preserve per-effect origins and add Ascension/Severance families. Use recorded cast resistance recipient/ordinal filtering before scheduling.

- [x] Add tests for Jump0flat/access,Jump1cannotclimbto2,sidewaysraisedentry,descent,push/pull/rewind; negative debuffs/DoTs/Curse resistance retainingdamage,zerochance/noeligible/nohit noRNG, mixed specialorigins bypass, pendingactivation no reroll and legacycompatibility.
- [x] Observe red then implement smallest shared checks/filtering.
- [x] Add viewer-derived height icons/privacy/leaving tests and AI conditional-debuff expectation.
- [x] Run targeted actions/movement/resistance/AI/viewer tests and coretypecheck.

### Task 4: Battle/input/result and standardized readers

**Files:** shared battlefield bundleCSS,completion panels/sharedCSS,new completion browser fixture/script; shared Skill/Resonance parameter adapters/CSS/tests and palette browser script.
**Interfaces:** Existing canonical ability metadata, shared CompactSkillEffectSummary and parameter rows; production renderers in Vite fixtures.

- [x] Keyboard red: existing browser regression observes unwanted solid mapoutline.
- [x] Completion36-case matrix observes outeroverflow before repair; expand final matrix to54 including mobile landscape.
- [x] Implement shared scoped outline suppression and bounded open-log summary/log layout without artresize.
- [x] Observe parameter unitred then implementAttackfamilycolors,bare canonicalheads,Resonance type/palette.
- [ ] Verify browser computedstyles/completecontent,14commandinputcases,54completioncases and all modes/fullsuite.

### Task 5: Integration, catalog audit and release

**Files:** current domain docs,AGENTS,TASKS,Manual and release evidence; relevant authoring/balance regression fixtures.

- [x] Audit current77Attackskills forcanonicalfamily and authored20/16guidance/rareexceptions; document shared formula/resource tempo intent and run balance harness.
- [ ] Run `pnpm check`, fullbuild and allrequiredCI/browser checks on frozen candidate.
- [ ] Independent spec/correctness review exactdiff, reconcile freshMain and rerun ifneeded.
- [ ] Publish coherent applicationcandidate,merge verified exacthead and perform one Production release with exactsource/alias/HTTP/log checks.
- [ ] Restore deployment lock and record factual receipts; report only verified live outcomes.
