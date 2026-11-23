# Combat Corrections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Native implementation is the Owner's preserved choice.

**Goal:** Complete and publish the approved thirteen-screenshot correction batch with continuous effect readers, honest targeting, persistent ground areas and bounded percentage triggers.

**Architecture:** Reuse canonical viewer projection, targeting geometry, damage receipts and versioned Master publication. Add narrow typed ground-area and per-character turn-use modules; integrate them at cast, turn-boundary and movement-step authority. Shared components own visual changes across modes.

**Tech Stack:** Node 24, pnpm 11.17.0, TypeScript, React/Next, Vitest, Playwright, existing Supabase persistence and Vercel release tooling.

**Spec:** `docs/superpowers/specs/2026-10-07-combat-corrections-design.md`, approved 2026-10-07 with concise `Chronist Skills` setup wording.

## Global Constraints

- Burn uses actual outgoing hostile HP damage; default backlash 10%, floor arithmetic, once per affected character's turn cycle.
- Poison movement retains its authored percentage, five-tile threshold, one extra tick per character's cycle and no banked excess triggers.
- Ground uses orange actual-footprint preview, authored duration, registered visual, pinned tiles and one entry pulse per area/character/cycle.
- Preserve saved historical mechanics through explicit new encounter policy markers; no live battle/content rewrite.
- Chronist setup wording and eligibility agree: any Chronist Skill qualifies for those setups; append immutable Resonance revisions.
- Share applicable desktop/mobile PvE/PvP/spectator presentation and preserve artwork, costs, privacy and server authority.
- Complete the already authorized native work and final release without repeated handoff menus. No unrelated Phase 5 or login work.

## Review Focus

- Forced movement before an affected unit's first turn must use a stable initial cycle, with reapplication/Copy unable to reset caps (Tasks 4/6).
- Ground effects surviving source defeat must use pinned caster values without issuing commands or revealing concealed provenance (Tasks 5/6/7).
- A multi-hit/area attack ending the battle must settle one legal Burn receipt and no duplicate defeat/reward transition (Task 4).
- Actual AI-response projection must retain typed DoT rows without trusting browser reconstruction or an obsolete previous snapshot (Task 1).
- Content publication/reload and spectator projection must reject malformed ground/trigger state and preserve historical contracts (Tasks 5/7/8).

### Task 1: Continuous participant projection

**Files:** `apps/web/src/server/battle/battle-session-service.ts`, `battle-recruit-ai-service.ts`, `battle-recruit-ai-service.test.ts`, `battle-live-viewer-projection.test.ts`; shared effect identity readers only if actual mounted tests require it.
**Interfaces:** Consume `deriveParticipantBattleViewerEntitlement` and current public projectors. Produce exported `projectBattleSnapshot(state, viewer): BattleSessionProjection` reused by Recruit responses.

- [ ] Add actual Recruit service regressions: three-tick Burn/Poison active rows persist after the first tick; pending rows become active in the same returned snapshot; reload parity and concealed-source privacy hold.
- [ ] Run web Vitest for Recruit/viewer/lifecycle files. Expected: new Recruit projection assertions fail with missing persistent/pending rows.
- [ ] Replace the raw Recruit projector with canonical entitled projection; remove duplicate projection types/implementation.
- [ ] Run focused tests. Expected: all pass, with persisted lifetime and privacy unchanged.
- [ ] Commit and complete with `corepack pnpm test`. Expected: complete repository test suite passes.

### Task 2: Shared battlefield, focus and completed-log presentation

**Files:** shared `battle-experience.tsx`, `battle-facing-indicator*`, `battlefield-presentation-bundle*`, `battle-map-token-polish.tsx`, `battle-keyboard-scope*`, `battle-completion-panel*`, `pvp-battle-completion-panel.tsx`, browser targeting/result fixtures.
**Interfaces:** Consume current `potentialPath` and target spec. Produce footprint-bound `data-ground-path`, caster-excluded Circle paint and neutral focus restoration shared by cancel/dismiss.

- [ ] Add mounted/readable regressions: Circle caster gets no fill; off-footprint occupants get no candidate glow; Ground Circle 1 paints exactly eight orange tiles; Escape then another shortcut dispatches without clicking; result reader reserves its dominant viewport area.
- [ ] Run focused web tests. Expected: reported attribute/focus/result assertions fail against current rendering.
- [ ] Implement footprint-bound cues, remove out-of-footprint red styling authority, add attractive identity-colored compass backing, restore neutral focus on cancellation, and use compact result summary while log is open.
- [ ] Run focused tests and actual browser cases at final gate. Expected: no legality/AP/RNG/artwork change; reading/dialog guards remain.
- [ ] Commit and complete with `corepack pnpm test`. Expected: all pass.

### Task 3: Honest target labels and concise Resonance setups

**Files:** `skill-detail-presentation.ts`, `gameplay-tags.ts`, `resonance.ts`, `resonance-v2.ts`, `resonance-balance-v5.ts`, current Resonance roster publication, corresponding tests and shared Resonance readers/editor.
**Interfaces:** Produce one self/ally eligibility description and explicit `any-skill` matcher semantics for Chronist setup revisions. Other tagged matchers remain unchanged.

- [ ] Add tests: self-capable Single ally shows Self/Ally; caster-excluded Circle shows Ally; Chronist attack and non-attack Skills both arm the revised setup; other Disciplines cannot; historical tempo matchers remain limited.
- [ ] Run focused web/core tests. Expected: label and new setup assertions fail.
- [ ] Implement common target description and append concise `Chronist Skills` revisions with matching explicit trigger grammar; all remaining Resonance descriptions use canonical matcher explanations.
- [ ] Run focused tests. Expected: setup/payoff consumption and historical content remain correct.
- [ ] Commit and complete with `corepack pnpm test`. Expected: all pass.

### Task 4: Percentage reactive triggers and per-character caps

**Files:** new `packages/game-core/src/combat/combat-turn-trigger-state.ts`; `actions-legacy.ts`, `stat-driven-combat.ts`, `combat-dots.ts`, `combat-effect-state.ts`, `combat-percentage-dots.ts`, encounter constructors/persistence validators, shared tag readers and Burn percentage editor.
**Interfaces:** Produce `combatTurnCycle(state, combatantId): number`, `claimCombatTurnTrigger(state, combatantId, key): { state, allowed }`, and outgoing-damage Burn settlement. Pin `dotTriggerPolicyVersion: 1` separately from existing percentage policy.

- [ ] Add tests: 23 hostile HP loss causes 2 Burn backlash at 10%; repeated attacks in same cycle cause zero extra; miss then hit still triggers; hostile multi-hit sum excludes friendly/reactive output; reapply/Copy/reload preserve cap; Poison five/further-five tiles triggers once and new cycle resets allowance without banking excess.
- [ ] Run focused core tests. Expected: current fixed/backlash and uncapped trigger assertions fail.
- [ ] Implement validated immutable turn-use state, command-start Burn eligibility with outgoing receipt basis, Poison cap/carry, new encounter pinning, precise authoring and shared descriptions. Preserve old policy behavior.
- [ ] Run adjacent damage/DoT/Copy/terminal tests. Expected: all pass including current final-battle receipt ordering.
- [ ] Commit and complete with `corepack pnpm test`. Expected: all pass.

### Task 5: Typed ground-area definitions and state

**Files:** new `combat-ground-areas.ts`, `combat-ground-visuals.ts`; action/Skill/Essence grammar, current roster converters, authoring and persisted state validators; test files beside modules.
**Interfaces:** Produce `CombatGroundAreaDefinition`, `CombatGroundAreaInstance`, `createCombatGroundArea`, `advanceCombatGroundAreas`, `validateCombatGroundAreas`, finite `GroundVisualPresetId` registry. New encounters pin `groundEffectPolicyVersion: 1`.

- [ ] Add tests: Ground Circle retains exact eight pinned tiles/duration; empty cast creates area; invalid lifetime/preset/payload rejected; default next-round and explicit Instant boundaries expire once; source movement and reload never move/reroll area; old encounters retain no-area behavior.
- [ ] Run focused core/authoring tests. Expected: missing ground definitions/state behavior fails.
- [ ] Add typed ground metadata, exact expiry and persisted validation; append current eligible Ground revisions with explicit repeated lifetime (otherwise two rounds), leaving summons/pure terrain and historical revisions intact.
- [ ] Run tests. Expected: all accepted current definitions remain valid and unsupported entry operations reject.
- [ ] Commit and complete with `corepack pnpm test`. Expected: all pass.

### Task 6: Canonical ground cast and movement resolution

**Files:** `actions-legacy.ts`, `stat-driven-combat.ts`, `pv1f-action-economy.ts`, ground module, build bridge, Recruit/AI evaluation and server projection as required.
**Interfaces:** Consume Task 4 cycle claims and Task 5 instances. Produce `resolveCombatGroundEntry(state, combatantId, position, resolver)` and canonical entry pulse with zero command cost and viewer-safe receipts.

- [ ] Add cast/movement tests: empty placement; current occupant hit; active entry; two moves/re-entry/displacement in one area trigger once; different areas remain independent; teleport checks landing only; frozen caster values survive defeat; mitigation and zero-HP basis correct; end-of-battle stops movement and clears future triggers.
- [ ] Run focused core tests. Expected: no persistent entry pulse occurs in existing implementation.
- [ ] Integrate creation once per cast, explicit entry payload once per area/cycle at each committed step/landing, lifetime boundary and terminal cleanup. Entry never repeats caster effects, costs, cooldown, summons, Copy or Resonance. Ground pulse DoTs bind their own positive hostile damage receipt.
- [ ] Run movement/AI/kernel/bridge/persistence tests. Expected: normal movement/Poison and historical behavior remain green; previews are read-only.
- [ ] Commit and complete with `corepack pnpm test`. Expected: all pass.

### Task 7: Master ground controls and shared animated areas

**Files:** Ground/Burn/Skill media editors, Master content schema/service/preview, battle snapshot public ground projection, battlefield presentation bundle and shared terrain/area renderer, package exports.
**Interfaces:** Consume pinned ground duration/preset metadata. Produce authorized registered-preset editing/preview and public `groundAreas` render data without executable or private payloads.

- [ ] Add tests: precise duration/Burn %/visual editing and publication, invalid/stale/unauthorized rejection, immutable old/new pinning, spectator source privacy, pending marker/active animation/static reduced motion/exact disappearance.
- [ ] Run focused web/core validation tests. Expected: new editor/runtime paths absent.
- [ ] Implement controls within existing publication/audit flow, finite visual registry and shared read-only layers below portraits without blocking input. Keep private frozen payloads out of viewer responses.
- [ ] Run tests. Expected: preview/publish/reload/rollback and rendered lifetimes agree.
- [ ] Commit and complete with `corepack pnpm test`. Expected: all pass.

### Task 8: Rendered acceptance and current documentation

**Files:** actual Playwright targeting/percentage/Master/result suites; relevant `docs/COMBAT.md`, `AGENTS.md`, Manual/tag readers, `TASKS.md`, release verification record.
**Interfaces:** Consume Tasks 1–7 final source. Produce exact-source regression evidence across desktop/mobile PvE/PvP/spectators and current authoritative copy.

- [ ] Add real browser scenarios for all thirteen screenshot concerns and once-per-turn cap clarification; preserve existing full-suite checks and fixture authority cleanup.
- [ ] Run focused tests and `corepack pnpm check`. Expected: formatting/lint/types/all tests/build pass; browser/DB requirements remain explicit until actual CI completes.
- [ ] Reconcile stale authority with implemented pinned rules; document exact initial values and Owner clarification, with no fabricated human acceptance.
- [ ] Commit and complete with `corepack pnpm check`. Expected: full quality gate passes.

### Task 9: Review, verified release and Owner checklist

**Files:** release receipt, `TASKS.md`, `apps/web/DEPLOYMENT.md`; product files only for reproduced Important/Critical final findings.
**Interfaces:** Consume frozen reviewed candidate and exact-head CI. Produce matching merged tree/READY deployment, bounded production smoke and complete Owner test checklist.

- [ ] Run one fresh-context whole-branch review using the plan/spec/ledger and focus cases. Regrade findings; fix Important/Critical once with reproducing tests and green suite; record every ruling/deferred minor.
- [ ] Refresh Main, reconcile overlapping changes and run final `corepack pnpm check`; push exact-tree candidate with branch lease. Expected: source identity preserved and all required CI/browser/DB checks pass.
- [ ] Inspect actual desktop/mobile/reader/Master screenshots. Expected: no hidden fields, unreadable log or missing effect/footprint layer.
- [ ] Expected-head merge and Owner-authorized production release; apply only any specifically required additive migration. Expected: READY metadata/alias identifies verified merged source, public smoke passes and bounded runtime scan has no new errors.
- [ ] Preserve all ledger rulings and complete testing checklist in merged receipt; native task completion and clean workspace. Expected: every requested correction has actual evidence and accurate release status.
- [ ] Complete with `corepack pnpm check`, then provide the Owner the requested self-contained checklist and release link.
