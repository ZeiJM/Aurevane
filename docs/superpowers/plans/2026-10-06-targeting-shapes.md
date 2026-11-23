# Single, Line, Circle and All Targeting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the Owner's four targeting identities through one authoritative resolver, with complete persistent previews and compatible historical battles.

**Architecture:** Add an explicit geometry version to immutable targeting definitions. Legacy definitions retain their existing resolver; version 2 resolves precision Single, cardinal caster-origin Line, caster-centered Chebyshev Circle and global All. Commands convey a target, direction or activation, while the server derives tiles and effect recipients.

**Tech Stack:** TypeScript combat kernel, Zod request validation, Next.js/React, Vitest, Playwright and audited versioned combat-content publication.

**Spec:** `docs/superpowers/specs/2026-10-06-targeting-shapes-owner-spec.md` (Owner-supplied implementation request).

Status: written for Owner review; product implementation has not started. Recommended execution is Native in this session. Geometry, effect recipients, command validation and version pinning share interfaces. Complete the current verified #844 release first; preserve the earlier percentage DoT task and reconcile whichever feature is merged first before implementing the other.

## Global Constraints

- Single selects exactly one legal target. Basic Attack remains cardinal adjacent Single enemy targeting.
- Line [X] contains X tiles in one cardinal direction from the caster. Occupants never stop propagation.
- Circle [X] includes every on-board tile with Chebyshev distance 1 through X from the caster. Circle [1] has 8 and Circle [2] has 24 external tiles on an unobstructed sufficiently large board.
- All ignores positional range and directional LoS. Team, friendly-fire, effect-recipient and applicable elevation rules remain authoritative.
- Geometry and recipient policies remain separate. Actor effects operate independently; Circle excludes the caster's tile from its external footprint.
- Preview never mutates state, spends AP, consumes RNG, applies effects or advances counters. Empty Line/Circle/All-Ground footprint tiles stay visible.
- Owner follow-up at 20:58 Trinidad: detecting a character must never remove the other potential preview glows. Automatic forecast selection is not a player's direction choice.
- New current Line/Circle parameters use positive integers 1–5, matching the existing current Skill reach limit. Historical definitions retain their original legal parameter values.
- Preserve AP/MP, power, cooldowns, media, effect timing, recipient policy and unrelated balance during geometry conversion. Do not invent an existing All Skill.
- Server reconstructs coverage. Strict request schemas reject arbitrary recipient/tile lists. Preserve PvE/PvP/AI/spectator parity and private information boundaries.
- Standing Owner release permission applies to completed verified tasks. Automatic Git deployment remains disabled. No unrelated P5/Nexus/layout changes or live database migrations.

## Review Focus

- A character enters a lane after an empty-board preview: potential glows remain; only explicit player direction selection changes the focused lane (Task 6).
- An actor-only effect accompanies external Circle damage: actor receives only the authored actor effect, even though the caster tile is excluded (Task 2).
- A wall, elevation difference or board edge interrupts a lane: occupants never block; authored spatial rules and clipping decide coverage consistently (Tasks 1–2).
- A Resonance has a historical primary-unit payoff but the new command has no primary target: preserve setup instead of inventing a recipient or consuming it (Task 3).
- A delayed area effect activates after targets move or reconnect: retain established pending recipient/timing behavior and versioned geometry; never resolve from untrusted current client coverage (Tasks 2–4).

## Audit and file responsibilities

Read-only inventory on verified tree `42463a77d117594d08920399b35ac82742876bb9` found 153 current Skill/Essence definitions: 117 Single, 23 Circle, 13 Line. The adjacent audit document lists the exact 36 area definitions and current parameters. Reinspect latest built-ins and actual published overrides before conversion/release.

- New `packages/game-core/src/combat/combat-targeting-shapes.ts`: deterministic versioned geometry, spatial tile filtering and selection enumeration. No UI, database or random imports.
- `actions-legacy.ts` / `actions.ts`: target selection types, evaluation, effect-recipient resolution, preview/commit and legacy dispatch.
- `combat-authoring-validation.ts`, `mature-skills.ts`, `essence.ts`: structural and current-publication contracts, immutable current conversions and pinned historical lookup.
- `packages/validation/src/combat/battle-session.ts`: strict direction/activation command input.
- `recruit-ai-build.ts`, `summon-ai.ts`, `recruit-ai.ts`: shared selection enumeration, projected utility and stable serialization.
- Battle runtime/preview/selection/range modules: informational display and input; no independent authority.
- Master targeting editor and publication service: shape controls, normalization and contradictory-effect rejection.

### Task 1: Versioned shape and selection contracts

**Files:** Create `combat-targeting-shapes.ts` and `.test.ts`; modify `actions-legacy.ts`, `combat-authoring-validation.ts`, package exports and `packages/validation/src/combat/battle-session.ts` / `.test.ts`.

**Interfaces:** `CombatTargetSpec` gains optional `geometryVersion?: 2`; absent preserves legacy behavior. Extend `CombatTargetShape` with `{ kind: 'all' }`. Extend `CombatTargetSelection` with `{ kind: 'direction'; direction: 'north' | 'east' | 'south' | 'west' }` and `{ kind: 'activate' }`. Export `resolveCombatTargetFootprint(tactical: TacticalBattleState, origin: GridPosition, spec: CombatTargetSpec, selection: CombatTargetSelection): readonly GridPosition[]` and `enumerateCombatTargetSelections(state: CombatEncounterState, actorId: string, spec: CombatTargetSpec): readonly CombatTargetSelection[]`. Retain existing `resolveTargetShapeTiles` as the historical compatibility function.

- [ ] Write failing tests for Single selected tile, four Line [4] lanes, Circle 8/24 and nested rings, global All, clipped corners, no caster Circle tile, occupied lanes, malformed direction and strict rejection of supplied victim/tile lists.
- [ ] Run the new targeting file and battle-session validation tests; confirm failures concern missing contracts.
- [ ] Implement pure geometry and strict command parsing. Version 2 Single accepts the established selections; Line accepts direction; Circle/All accept activation. Reject All without geometry version 2 and mismatched selection kinds. Preserve unknown-field rejection and existing idempotency/version requirements.
- [ ] Verify legacy Circle Euclidean remote coverage and selected-endpoint Line remain byte-equivalent; round-trip legacy/new JSON without rewriting old definitions.
- [ ] Commit `feat: define versioned combat targeting shapes and inputs`.

### Task 2: Authoritative legality, recipients and execution

**Files:** Modify `actions-legacy.ts`, `actions.ts`, `combat-targeting-shapes.ts`; extend `actions.test.ts`, `phase4-interactions.test.ts`, `combat-effect-timing.test.ts` and new `combat-targeting-execution.test.ts`.

**Interfaces:** Add `resolveCombatTargeting(state: CombatEncounterState, actorId: string, spec: CombatTargetSpec, selection: CombatTargetSelection, content: CombatContentCatalog): { primaryCombatantId: string | null; affectedTiles: readonly GridPosition[]; affectedCombatantIds: readonly string[]; issues: readonly CombatActionIssue[] }`. Evaluation and commit use that result; delayed effects retain the existing captured recipients and timing contract.

- [ ] Write failures for three enemies in one Line, near/far All units, allies/anyone/self policy intersections, complete All Ground, mixed actor/external effects, empty tiles, elevation and LoS, preview/commit matching recipients and no state/RNG changes during repeated preview.
- [ ] Run focused targeting, terrain and timing tests; confirm missing version-2 behavior is the cause.
- [ ] Implement geometry then legal tile/occupant filtering. For Line/Circle, test authored LoS from caster to each tile; a blocked lane cannot propagate through the blocking wall. Elevation filters individual eligible tiles; elevation alone is not a wall unless existing terrain/LoS rules make it one. Without required LoS, preserve geometric coverage. Board edges clip. Units never block.
- [ ] Intersect unit team policy with friendly-fire policy; ground geometry stays independent of team, and effects still use authored recipients. All bypasses min/max range and LoS while honoring explicit elevation and effect eligibility. Never silently choose a primary unit for direction/activation.
- [ ] Preserve command legality when no effect recipient exists: potential empty footprints remain visible, but existing effect-target requirements still prevent an empty nonterrain attack from consuming AP. Eligible ground effects may execute without occupants. Tests distinguish informational geometry, an illegal empty attack and a legal empty terrain effect.
- [ ] Test pending multi-target status/damage, ground reactions, zero recipients, source/target defeat, terminal state and reconnect. Preserve invisibility's existing direct-unit versus area distinction; no private occupant data enters previews.
- [ ] Commit `feat: resolve shared targeting coverage and recipients`.

### Task 3: Requirements, Resonance and AI parity

**Files:** Modify `recruit-ai-build.ts`, `recruit-ai.ts`, `summon-ai.ts`, `resonance.ts`, `pv1f-action-economy.ts`, `covert-sensory-revealed.ts` and existing tests where selections are copied/keyed.

**Interfaces:** AI uses Task 1 enumeration. Single enumerates legal candidate decisions, Line enumerates four directions, Circle/All enumerate one activation. Existing `projectedCombatEffectUtility` scores all authoritative projections. Stable keys include `direction:north` and `activate`.

- [ ] Write failing AI tests choosing a lane with two enemies over one, avoiding friendly fire, caster-centered Circle positioning, distant All recipients and no-effect activations not wasting AP. Add no-primary requirement/Resonance tests.
- [ ] Run Recruit/build/summon AI and Resonance files; isolate failures to new selections.
- [ ] Update keys/copy/execution consumers. Reject new current area effects/requirements that require an unspecified primary-unit target; actor and affected-unit effects remain valid. When an appended historical Resonance requires primary-unit selection, retain the armed setup on an area activation rather than substituting the actor or first enemy. Current compatible multi-recipient payoffs follow the same authoritative affected set.
- [ ] Verify hit/resistance/cost/cooldown forecasting, no-effect AI suppression, historical unit/tile commands and replay identity. Do not alter current Resonance potency or invent payoff targets.
- [ ] Commit `feat: evaluate new targeting decisions across AI and Resonance`.

### Task 4: Immutable current catalog conversion

**Files:** Create `combat-targeting-roster.ts` and `.test.ts`; modify `mature-skills.ts`, `essence.ts`, `skill-balance-v5-1.ts` and current content resolver tests.

**Interfaces:** Export `createCurrentTargetingSkillVersion(definition: MatureSkillDefinition): MatureSkillDefinition | null` and `createCurrentTargetingEssenceVersion(definition: EssenceDefinition): EssenceDefinition | null`. Append versions only for legacy current Line/Circle definitions; preserve every unrelated field. Geometry version 2 is pinned in the new immutable target spec.

- [ ] Write failing assertions for all 36 audited conversions and unchanged 117 Single definitions, preserved authored X/costs/power/timing/recipient policy, exact old-version lookup and new/resumed battle snapshots.
- [ ] Run roster/resolver/build-snapshot regressions before changing registries.
- [ ] Append latest versions after Cleanse and any merged percentage DoT conversions. For Line use X as length and canonical range 0..X; for Circle use X as radius and canonical range 0..X. Preserve team, friendly fire, authored elevation/LoS and effects. Do not rerun balance scaling to change power merely because geometry moved.
- [ ] Adjust version-2 validation/valuation so All is supported without fake range and current shape parameters remain 1–5. No existing Skill becomes All automatically. Preserve historical V5/V5.1 validation contracts.
- [ ] Verify training/PvE/PvP/multi-participant loadout pinning and actual published override precedence; stale custom conversions must fail rather than overwrite Owner edits.
- [ ] Commit `feat: version current Line and Circle skill geometry`.

### Task 5: Master Panel authoring and shared reader contract

**Files:** Modify `skill-targeting-editor.tsx` / `.test.ts`, `combat-content-authoring-service.ts` / `.test.ts`, `combat-content-preview.ts`, `gameplay-tags.ts`, `skill-detail-presentation.ts`, `technique-magnitudes.ts` and tests.

**Interfaces:** Current drafts use `geometryVersion: 2`. Single exposes min/max range. Line/Circle expose one positive X control, normalize stored range 0..X and hide redundant destination range. All stores range 0..0 and `requiresLineOfSight: false`, with no X control. Explicit elevation remains a separately authored recipient restriction. Tags derive from shape.

- [ ] Write failing UI/server tests for four methods, X 1–5, All without X/range/LoS, independent kind/team/friendly-fire controls, actor versus external recipients, malformed/contradictory combinations and preview/save/publish/rollback historical compatibility.
- [ ] Run editor, authoring and reader regressions.
- [ ] Implement current authoring normalization and server rejection of noncanonical range/LoS, nonpositive/oversized X and unsupported area primary-unit effects/requirements. Self-only targeting uses Single; separate actor effects may accompany area coverage. Multi-tile summon is rejected; preserve existing Single Empty Tile summon semantics. Keep authorization, audit reasons and expected versions.
- [ ] Display Single, Line [X], Circle [X], All from authoritative metadata; All Range and LoS display N/A. Explain caster origin and external Circle footprint in shared descriptions. Keep the required Skill Information row order and HP/MP/element/Cleanse copy.
- [ ] Commit `feat: author and explain targeting methods consistently`.

### Task 6: Full persistent previews and directional battle controls

**Files:** Modify `battle-runtime.ts`, `battle-preview-selection.ts`, `battle-range-previews.ts`, `use-battle-range-previews.ts`, `battle-attack-path.ts`, `battle-experience.tsx`, `battle-preview-service.ts` and component/service tests.

**Interfaces:** Forecast presentation carries the immutable `CombatTargetSpec` needed by the shared geometry adapter. Track `aimSource: 'implicit' | 'player'` and optional selected cardinal direction separately from auto-selected forecast recipient. Task 1 resolver supplies potential geometry; server Task 2 evaluation supplies authoritative legality and outcomes.

- [ ] Write failing tests for Single's candidate set surviving automatic target detection, all four Line lanes with/without occupants, selecting one lane explicitly, Circle immediate 8/24 tiles, All remote units/complete ground, and stale/error forecasts preserving informational coverage.
- [ ] Run preview/selection/range/path/component tests and reproduce the Owner's two images: full lanes before detection, same potential lanes after detecting Recruit.
- [ ] Make implicit recipient forecasts informational only: they cannot replace the potential glow set. An explicit Line direction may focus its complete lane, including empty tiles; changing/canceling restores potential lanes. Single retains all candidates while indicating the chosen one. Circle/All arm with immediate full preview and require deliberate confirmation, not automatic execution.
- [ ] Map Up/Down/Left/Right and existing WASD bindings to cardinal Line decisions; mouse/touch lane gestures derive one direction. Reject diagonal Line clicks clearly. Preserve movement, final facing, cancellation, keyboard accessibility, command lock and confirm/version handling.
- [ ] Preserve red damage priority and shared blue nonattack/green Heal-or-Recovery fills outside portraits/rings. Apply footprint rendering to previewable buffs/debuffs/terrain as well as damaging Skills; no victim-dependent path disappearance.
- [ ] Verify every recipient's forecast, auto versus player aim, empty boards, friendly/hostile mixed effects, board edges and no commit/RNG/state changes from hover or arming.
- [ ] Commit `feat: preview complete targeting footprints across battle controls`.

### Task 7: Browser parity, publication audit and authorized release

**Files:** Add `apps/web/e2e/battle-targeting-shapes.pw.ts`; extend the existing shared ally/targeting harness and spectator/privacy checks; update `docs/COMBAT.md`, `docs/MASTER_PANEL.md`, `docs/SKILL_INFORMATION_CONTRACT.md`, current Manual and `TASKS.md`.

**Interfaces:** Exact verified Git tree, immutable published definitions, strict command intents and existing audited publication service. No new arbitrary list endpoint or schema migration.

- [ ] Write browser flows for Single, four Line directions/multiple occupants, Circle 1/2, All enemies/allies/anyone/ground on desktop/mobile PvE/PvP; spectator sees only permitted coverage/outcomes. Include the target-detection glow regression and old pinned battle fixture.
- [ ] Run focused geometry, execution, AI, authoring, reader and browser suites; inspect actual screenshots and authoritative receipts. Test stale version, failed command, source defeat, reconnect, no effects and terminal-state boundaries.
- [ ] Refresh Main and actual Production publications read-only. Convert any overrides through the existing expected-version audited authority while preserving Owner fields/history; prepare exact changes first. If there are none, perform no database mutation.
- [ ] Reconcile stale remote-Circle/endpoint-Line documentation and record exact catalog conversions. Refresh/reconcile overlapping DoT work; run `pnpm check` on frozen final source and inspect the complete diff.
- [ ] Push the exact tree, require all applicable exact-head CI, review, expected-head merge and standing-authorized Production deployment from the verified merged SHA. Verify READY, alias, public responses and deployment-scoped runtime diagnostics. Record actual evidence and limitations without claiming an authenticated Production playtest.
- [ ] Commit factual release documentation without introducing unrelated product changes.
