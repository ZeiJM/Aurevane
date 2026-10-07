# Attack-based percentage DoTs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Burn, Poison and Bleed scale from their attack's actual hostile HP loss, with consistent stacking rules and editable Master Panel percentages.

**Architecture:** Extend the existing typed DoT effects and state rather than replacing status resolution. Persist each application's damage basis and percentage profile; hold attack-dependent applications until their command's direct damage settles. Append current content versions and retain historical definitions and encounter policies.

**Tech Stack:** TypeScript, the existing combat kernel and JSON state, Next.js/React, Vitest, Playwright, existing audited combat-content authoring.

**Spec:** `docs/superpowers/specs/2026-10-06-attack-percentage-dots-design.md`

Status: written for Owner review. Product implementation has not started. Recommended execution: Native, in this session, because damage receipts, deferred effects and pinned state share interfaces that should be implemented and verified together.

## Global Constraints

- Actual hostile HP loss from direct effects in the same command is the basis; exclude self/friendly, periodic, backlash and reflected receipts. Capture before Absorb/Reflect output.
- Tick arithmetic is `floor(capturedDamage × tickPercentageBasisPoints / 10000)` with checked integer/BigInt arithmetic; no implicit minimum 1 HP.
- Burn/Poison have one active application per recipient; valid reapplication replaces and refreshes. Bleed has no artificial stack or 80-HP-total cap.
- Burn backlash stays 2 HP once per damaging command, including a miss. Poison has an extra tick every five traversed tiles, with movement remainder reset on replacement.
- Valid scheduled percentages are 0.01%–100%, duration 1–4 ticks. Burn decay is a nonnegative percentage-point decrement and every scheduled tick remains positive.
- Copy Debuffs preserves the captured basis/profile and remaining lifetime; Cleanse removes all qualifying applications.
- Historical battles/definitions retain their contract. New battles pin percentage policy and immutable current content. Preserve authority, resistance, timing, terminal-state and privacy rules.
- Use the nine exact roster proposals in the spec. No unrelated P5, migration, layout or deployment-configuration changes.
- Master Panel save/publish preserves authored percentages, authorization, reasons, audit and expected versions. Automatic Git deployment remains disabled; standing release permission covers completed verified work.

## Review Focus

- Same Skill cast twice in one round: delayed receipts must never share a damage basis; Task 3 tests separate persisted command identities.
- DoT appears before Damage in the authored array: capture the complete command basis without changing non-DoT effect order; Task 3 tests reordered effects and multiple hits.
- Percentage produces 0 HP: consume scheduled lifetime normally without substituting 1 or creating a reaction; Tasks 1–2 test 1 HP at 0.01% and cleanup.
- Owner custom published definition: conversion must preserve unrelated edits and fail on a stale base; Task 7 tests expected-version conversion and unchanged historical rows.
- Deferred source/recipient is defeated or battle becomes terminal: no orphan dependency, extra roll, duplicate tick or reward; Task 3 tests settlement and serialized reconnect boundaries.

## File responsibilities

- New `packages/game-core/src/combat/combat-percentage-dots.ts`: percentage profiles, arithmetic, eligibility and per-command dependency metadata; no UI or database imports.
- Existing `combat-dots.ts`, `combat-effect-state.ts`, `combat-status-copy.ts`: application lifetime, replacement, movement, decay, copy and persisted-state validation.
- Existing `actions.ts` / `actions-legacy.ts` / `combat-effect-timing.ts`: accuracy-approved recipients, original receipts, command dependencies, pending projection/activation and terminal cleanup.
- Existing roster/Essence registries plus new `combat-percentage-dot-roster.ts`: immutable current content versions and conversion using the spec's table.
- Existing Master Panel effect editors and authoring service: percentage inputs and current-publication validation.
- Existing shared effect/Skill/status readers: percentage brackets, descriptions and viewer-safe actual tick inspection.
- Existing battle creation services: new-policy pinning across PvE, PvP, quality/multi-participant and training.

### Task 1: Typed percentage profiles and exact arithmetic

**Files:** Create `packages/game-core/src/combat/combat-percentage-dots.ts` and `.test.ts`; modify `actions-legacy.ts`, `combat-dots.ts`, `combat-effect-state.ts`, `combat-authoring-validation.ts` and package exports.

**Interfaces:** Export `AttackPercentageDotProfile = { kind: 'attack-percentage'; basisPoints: number; decayBasisPointsPerTick?: number }`, `CapturedPercentageDotDamage = { capturedDamage: number; profile: AttackPercentageDotProfile }`, `percentageDotTickDamage(basis: number, profile: AttackPercentageDotProfile, stage?: number): number`, and `validatePercentageDotProfile(profile: AttackPercentageDotProfile, ticks: number, type: 'burn' | 'poison' | 'bleed'): void`. Authored DoTs gain `damageProfile`; new Bleed is a discriminated union of a percentage profile or legacy `damagePerTick`. Persisted instances gain optional `percentageDamage`; absent means historical fixed damage. Add `percentageDotPolicyVersion?: 1` to encounter state.

- [ ] Write failing tests: basis 40 at 2500/2000/1500 yields 10/8/6; 1 at 1 basis point yields 0; basis `Number.MAX_SAFE_INTEGER` at 10000 stays exact. Reject negative/unsafe bases, NaN/infinity, percentages 0 or 10001, fractional basis points, ticks outside 1–4, and nonpositive later Burn stages. Reject decay on Poison/Bleed.
- [ ] Run `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-percentage-dots.test.ts`; confirm failures target missing profiles/arithmetic.
- [ ] Implement the interfaces above using checked integers and BigInt multiplication/division. Percentage effects cannot also author a legacy power/damage field. Generic historical validators continue accepting historical effects; current authoring requires the new profile.
- [ ] Rerun the focused file and existing authoring/DoT validation tests; all must pass with unchanged historical fixtures.
- [ ] Commit `feat: define attack-percentage DoT profiles and arithmetic`.

### Task 2: Application, ticks, copy and cleanup

**Files:** Modify `combat-dots.ts`, `combat-effect-state.ts`, `combat-status-copy.ts`, `actions-legacy.ts`; extend existing Poison/Burn/Bleed movement/copy/end-turn tests and `combat-percentage-dots.test.ts`.

**Interfaces:** Add a final optional `percentageDamage?: CapturedPercentageDotDamage` argument to the existing `applyCurrentPoisonState`, `applyCurrentBurnState` and `applyCurrentBleedState` functions. Existing callers remain valid. All periodic readers use Task 1 arithmetic when that field exists; legacy paths retain their fixed-field behavior.

- [ ] Write failing tests: two sources leave one Burn and one Poison; replacement basis 20 replaces basis 40, stage resets to 0 and Poison movement remainder to 0. Five Bleeds with different bases/durations all survive reload and tick independently. A zero-HP tick advances duration. Copy retains basis/profile/lifetime, leaves donor unchanged and enforces recipient nonstacking. Cleanse/defeat clears every application.
- [ ] Run the focused percentage, movement and copy files; confirm failures concern new semantics rather than invalid fixtures.
- [ ] Implement percentage-policy replacement and unlimited Bleed while leaving `effectStackingPolicyVersion` behavior for other effects intact. Retain current skip-owner-turn-end semantics, Burn's 2-HP backlash and five-tile Poison movement rules. Copy the percentage metadata intentionally and validate it after serialization.
- [ ] Verify Burn decay 25→20→15 at basis 40 yields 10/8/6; Poison movement ticks do not consume owner-turn ticks; displacement counts, instantaneous relocation does not. Run historical DoT and backlash tests too.
- [ ] Commit `feat: resolve percentage DoT lifetimes and replacement`.

### Task 3: Bind immediate and delayed applications to their attack

**Files:** Modify `actions.ts`, `actions-legacy.ts`, `combat-effect-timing.ts`, `combat-percentage-dots.ts`; create `combat-percentage-dot-command.test.ts`; extend `combat-effect-timing.test.ts` and pending-state validation tests.

**Interfaces:** Persist monotonic `nextPercentageDotCommandId?: number` and `percentageDotCommands?: readonly PercentageDotCommand[]`. A command stores its identity, actor/action IDs, accumulated per-recipient original HP receipts and outstanding direct-damage effect ordinals. `PendingCombatEffect` gains optional `percentageDotCommandId` and `percentageDotDamageEffectOrdinal`. Percentage DoTs remain canonical pending entries until both their activation round and dependent command settlement permit application. Export `allocatePercentageDotCommand(state, action): { state: CombatEncounterState; commandId: number }` and `recordPercentageDotCommandDamage(state, commandId, events, resolvedEffectOrdinals): CombatEncounterState`; reuse `collectCommittedHostileCommandDamage` for receipt selection.

- [ ] Write failing command tests for all four instant/next-round Damage×DoT combinations, DoT-before-Damage order, multiple hits, unequal AoE mitigation, Barrier, criticals, overkill, miss/resistance/zero damage, and two same-Skill casts in one round with distinct serialized command IDs.
- [ ] Run `pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-percentage-dot-command.test.ts`; ensure each failure identifies the missing basis/dependency behavior.
- [ ] Allocate only for commands with percentage effects. Resolve non-DoT effects in their established order, accumulate original direct receipts per command, and materialize eligible percentage applications after all originating direct effects settle. Do not reroll accuracy/resistance. Pending activation filters must retain unresolved entries instead of dropping them. Latest valid queued Burn/Poison replaces only that recipient's superseded entry; preserve other AoE recipients.
- [ ] Verify actual post-mitigation HP basis, reactive exclusion, target-turn skip, reconnect, source/recipient defeat and terminal cleanup. Test malformed/orphan dependency metadata fails closed; no counter overflow or identity reuse. Existing forecast, reaction, timing, AI and terminal tests pass.
- [ ] Commit `feat: bind percentage DoTs to committed attack receipts`.

### Task 4: Current immutable roster and encounter policy

**Files:** Create `combat-percentage-dot-roster.ts` and `.test.ts`; modify `mature-skills.ts`, `essence.ts`, `skill-balance-v5.ts`, `skill-balance-v5-1.ts`, `apps/web/src/server/battle/battle-session-service.ts`, `pvp-lobby-service.ts`, `pvp-lobby-quality-service.ts` and their existing training/scenario creation branches.

**Interfaces:** Export `createPercentageDotSkillVersion(definition: MatureSkillDefinition): MatureSkillDefinition | null` and `createPercentageDotEssenceVersion(definition: EssenceDefinition): EssenceDefinition | null`. They append a version only for the nine spec entries and preserve all unrelated Owner fields. Existing current/pinned resolvers remain the public interface. Every newly created encounter pins policy 1; absence preserves historical behavior.

- [ ] Write roster assertions: Gash 2000, Severing Cut 1500, Venom Shot 1500; Burn first/decay Cinder Bolt 2500/500, Flame Burst 2000/500, Ember Line 2000/500, Blistering Heat 1500/500, Phoenix Wake 2500/500; Red Tempest Bleed 2000. Durations remain 3 except Poison 4. Blistering Heat adds Fire Dmg 6, AP50/MP3 and attack/Mystic tags; retain Slow2, range, elevation and cooldown2. Exact historical lookups remain equal.
- [ ] Run the roster and battle-creation regression files; capture failures before changing registries.
- [ ] Append converted latest versions after existing registries. Update balance valuation to understand percentages without rewriting authored profiles. Pin new encounter policy in every current creation path, including training. Never reinterpret old policy snapshots.
- [ ] Verify current Skill/Essence resolution, saved loadout/new-battle version pinning, PvE/PvP/multi-participant/training creation and Owner-edited profile preservation.
- [ ] Commit `feat: publish versioned percentage DoT roster and policy`.

### Task 5: Master Panel percentage authoring

**Files:** Modify `apps/web/src/components/master/combat-content/skill-effect-editor.tsx`, `skill-effect-list-editor.tsx`, their tests and `apps/web/src/server/master/combat-content-authoring-service.ts` / `.test.ts`.

**Interfaces:** Master controls consume `damageProfile` from Task 1. Poison/Bleed show `Damage per tick (% of attack damage)`; Burn shows `First tick (% of attack damage)` and `Decay per tick (percentage points)`, plus the existing duration. Inputs display percentages with 0.01-point precision and save integer basis points. Use an exact decimal parser, not floating-point truncation or silent clamping.

- [ ] Write failing component/service tests for all three controls, 12.34%→1234 round-trip, 25/5/3→25%→20%→15% preview, invalid/nonfinite/extra precision input, standalone DoT without attack/Damage, incompatible recipient coverage, permission denial, stale base/draft and published values surviving a new battle.
- [ ] Run the Master editor and authoring service test files; confirm the existing fixed-only controls/publication fail these assertions.
- [ ] Implement controls and current-publication validation. Require attack tag and direct hostile damage covering the DoT's recipient set. Reject generic `apply-status` Burn/Poison/Bleed and fixed-only profiles in new current publication so they cannot bypass typed percentage semantics. Preserve exact percentage values in save/validate/preview/publish and keep reasons/audit/expected-version checks. New defaults use percentage profiles; historical reports remain readable.
- [ ] Verify Skill and Essence draft/publication paths, old-battle immutable versions, and frontend invalid-input feedback. Review changed TSX with the React checklist.
- [ ] Commit `feat: author DoT percentages in Master Panel`.

### Task 6: Shared brackets, descriptions and rail inspection

**Files:** Modify `packages/game-core/src/combat/gameplay-tags.ts`, `apps/web/src/components/character/skill-effect-preview.ts`, `skill-detail-presentation.ts`, `apps/web/src/components/battle/battle-combatant-effects.tsx`, `battle-effect-identity.ts`, `battle-effect-summary.ts` and `apps/web/src/lib/battle/battle-elevation-effects.ts`, and the corresponding tests. Update Manual/Combat documentation when behavior is implemented.

**Interfaces:** All reports consume the same immutable `damageProfile`. Brackets are `Poison [15%] [4 turns]`, `Bleed [20%] [3 turns]`, `Burn [25% → 20% → 15%] [3 turns]`. Existing timing and effect-name prefixes remain. Rail inspection consumes only viewer-safe `percentageDamage` metadata; reveal actual basis/tick HP without private build/command fields.

- [ ] Write failing assertions for exact brackets, attack-HP basis wording, nonstacking Burn/Poison, unlimited Bleed, backlash/movement explanations, effect labels and historical fixed descriptions. Cover Skill, Essence, Master preview and copied-effect inspection.
- [ ] Run shared reader/status/rail tests; confirm fixed-power descriptions fail only for new profiles.
- [ ] Implement through existing shared adapters. Do not repeat numeric power prose already displayed in damage tags or infer percentage state from old fixed fields.
- [ ] Run desktop/mobile PvE/PvP/spectator browser reader checks and privacy tests. Verify no fixed `1/1/1` claim remains for new profiles and no private source disclosure is introduced.
- [ ] Commit `feat: explain percentage DoTs consistently across readers`.

### Task 7: Published content reconciliation and measured balance

**Files:** Extend existing combat-content resolver/authoring integration tests, legal-build balance harness and its evidence report. Add a conversion utility only if actual published overrides require it; do not create a new publication API or migration.

**Interfaces:** The existing `CombatContentAuthoringService` remains the write authority. Conversion uses Task 4 helpers, the actual published current definition and its expected base/draft version. Missing current publications use built-in new versions directly.

- [ ] Write an integration regression with a custom published DoT definition: preserve media/cost/description/target/custom profile fields, append conversion, fail stale base, preserve historical rows and pin the newly published version only on new battles. Include a no-override case that performs no database mutation.
- [ ] Run content-authoring/resolver integration tests; confirm baseline behavior without weakening authorization.
- [ ] Reinspect Production publications read-only before release. The 2026-10-06 preflight found no Skill/Essence publications with DoT/remove-status effects; do not assume this remains true. If overrides exist, prepare exact converted definitions via the existing audited path before writing them.
- [ ] Measure the nine proposed profiles with legal four-Skill builds, seeded hit/resistance/critical behavior, cooldown/AP economy, low/high HP bases and AoE. Record observations; bring any proposed percentage change back to Owner before changing the spec table.
- [ ] Commit `test: verify percentage DoT publication and balance`.

### Task 8: Combined verification and authorized release

**Files:** Update `docs/COMBAT.md`, `docs/MASTER_PANEL.md`, current Manual copy, `TASKS.md` and a dated verification receipt. No deployment configuration or unrelated migrations.

**Interfaces:** Exact final Git tree, exact-head passing workflows, expected-head merge and Production deployment from the verified merged SHA.

- [ ] Refresh Main; inspect and reconcile overlapping current battle/Cleanse/Chronicle work. Run focused regressions after reconciliation.
- [ ] Run `pnpm check` on frozen source; require formatting, lint, types, all tests and builds to pass. Inspect the entire diff and both historical/new-policy boundaries.
- [ ] Push exact source and verify every applicable exact-head workflow, including disposable-database browser flows, completes successfully. Review blockers before merge.
- [ ] Merge with expected head and perform the authorized Production release. Verify READY state, exact merged commit/tree, primary alias, public response checks and bounded deployment-scoped runtime logs. No fabricated authenticated Production or human playtest claim.
- [ ] Record actual counts, release receipts and limitations, then commit the factual closeout.
