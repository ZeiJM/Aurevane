# Combat v5.1 Summons Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace new-current passive Summoned status usage with a real server-authoritative temporary allied combatant that lasts up to five of its own turns and uses at most one of up to two authored abilities per turn.

**Architecture:** Introduce a versioned summon profile owned by the parent Mature Skill and a dedicated mature-layer `summon` effect. Runtime summon instances live in normalized combat effect state and atomically add/remove battle combatant, placement, stat profile, and summon metadata. Summon AI reuses the build-aware Recruit AI scoring path with the summon profile's explicit abilities.

**Tech Stack:** TypeScript combat kernel, existing tactical battle state/stat bridge, Recruit AI, Next.js battle UI, Master Panel authoring, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-28-combat-v5-1-targeting-summons-resonance-design.md`

## Global Constraints

- Summoning Skill target kind is `empty-tile`.
- Spawned unit joins the summoner's team.
- Summon receives no turn in the spawn round; it becomes eligible at the next round boundary.
- Lifetime is exactly 5 completed summon turns unless defeated earlier.
- Summon has 1–2 authored abilities and can execute at most one authored ability per summon turn.
- Summon has its own HP and can be defeated.
- Summon gets no normal player/recruit side rail; information is available through Inspect.
- New summon profiles are versioned inside the parent Skill definition.
- Historical `summoned` status behavior remains valid for pinned old content.
- Summons are auxiliary: if a team has no living non-summon combatant, the battle may end even if one of its summons is still alive; terminal cleanup removes those summons.
- Do not merge or deploy as part of this plan.

## Review Focus

- Spawn on an occupied/invalid tile must fail closed without partially adding runtime state.
- Adding/removing a summon must keep battle combatants, placements, initiative order, stat bridge, status/effect state, and validation in sync.
- A summon spawned late in a round must not receive an immediate turn or cause initiative-index corruption.
- Current-round initiative must remain frozen: newly spawned summon IDs live in an explicit deferred-initiative set until the next round rebuild.
- Defeat/expiration must not leave future recovery/DOT/cooldown state referencing the removed summon.
- AI must never use both authored abilities in one turn even when enough AP remains.

---

### Task 1: Define summon content schema and parent-Skill validation

**Files:**
- Create: `packages/game-core/src/combat/summon-content.ts`
- Create: `packages/game-core/src/combat/summon-content.test.ts`
- Modify: `packages/game-core/src/combat/actions.ts`
- Modify: `packages/game-core/src/combat/mature-skills.ts`
- Modify: `packages/game-core/package.json`

**Interfaces:**
- Produces: `SUMMON_PROFILE_SCHEMA_VERSION = 1`.
- Produces: `SummonAbilityDefinition` with stable id/name/description, AP/MP, tags, target, requirements, effects, AI metadata, and media.
- Produces: `SummonProfileDefinition` with id/name/flavor/artwork/tags/stats/initiative/movement/lifetimeTurns/abilities.
- Produces: `validateSummonProfileDefinition(profile): readonly string[]`.
- Extends current `CombatEffectDefinition` with mature-layer-only `{ type: 'summon'; recipient: 'selected-tile'; durationTurns?: 0 }`.
- Extends `MatureSkillDefinition` with optional `summonProfile`.
- v5.1 validation requires exactly one summon profile when a summon effect exists, exactly 1–2 abilities, and `lifetimeTurns === 5`.

- [ ] **Step 1: Write failing schema tests**
  - valid profile with one/two abilities passes;
  - 0 or 3 abilities fails;
  - lifetime other than 5 fails for current v5.1;
  - summon effect without profile fails;
  - profile without summon effect fails;
  - summon Skill target must be `empty-tile`.

- [ ] **Step 2: Run tests and verify RED**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/summon-content.test.ts src/combat/mature-skills.test.ts`

- [ ] **Step 3: Implement schema and validation.**
- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: define versioned summon content`

---

### Task 2: Add atomic summon runtime state

**Files:**
- Create: `packages/game-core/src/combat/combat-summons.ts`
- Create: `packages/game-core/src/combat/combat-summons.test.ts`
- Modify: `packages/game-core/src/combat/combat-effect-state.ts`
- Modify: `packages/game-core/src/combat/combat-runtime-state.ts`
- Modify: `packages/game-core/src/combat/battle-state.ts`
- Modify: `packages/game-core/src/combat/board.ts`
- Modify: `packages/game-core/src/combat/stat-driven-combat.ts`

**Interfaces:**
- Produces: `CombatSummonInstance` with combatantId, ownerCombatantId, sourceSkillId/version, pinned `SummonProfileDefinition`, spawnedRound, turnsCompleted.
- `CombatEffectState` gains `summons: CombatSummonInstance[]`.
- `BattleCombatant` gains backward-compatible `kind?: 'standard' | 'summon'` (omitted historical rows are standard).
- `BattleState` gains backward-compatible `deferredInitiativeCombatantIds?: readonly string[]`.
- Produces: `spawnCombatSummon(state, input): { state; events }`.
- Produces: `removeCombatSummon(state, combatantId, reason): { state; events }`.
- Produces: `advanceCombatSummonOwnerTurn(...)` to increment completed turns and expire at 5.
- Produces summon events `summon_spawned`, `summon_expired`, `summon_defeated`.

- [ ] **Step 1: Write failing atomicity/invariant tests**
  - legal empty tile adds combatant, placement, stat profile, summon state;
  - occupied/blocked/out-of-range tile changes nothing;
  - spawned summon is absent from current-round initiative order and present in `deferredInitiativeCombatantIds`;
  - current turn index/order is unchanged by spawn;
  - next round order includes it deterministically and clears its deferred marker;
  - removing summon clears placement/stat/effect references;
  - team terminal calculation ignores summons as sole team anchors.

- [ ] **Step 2: Run tests and verify RED**

Run:
`pnpm --filter @aurevane/game-core exec vitest run src/combat/combat-summons.test.ts src/combat/battle-state.test.ts`

- [ ] **Step 3: Implement atomic spawn/removal helpers**
  - Derive stable combatant id from battle id + owner + source skill/version + deterministic summon ordinal.
  - Mark spawned BattleCombatant as `kind: 'summon'`.
  - Update all parallel state collections in one returned immutable state.
  - Keep the current initiative array/index frozen and add the new id to `deferredInitiativeCombatantIds`.
  - On the existing round-wrap path, rebuild initiative from living combatants and clear deferred ids that become eligible.
  - Battle terminal-team calculation counts living `standard` combatants as team anchors; summons remain combat-capable while their team has an anchor but cannot keep a defeated team alive by themselves.
  - Validate resulting runtime state before returning.

- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: add temporary summon runtime state`

---

### Task 3: Execute summon effects and lifecycle

**Files:**
- Modify: `packages/game-core/src/combat/pv1f-action-economy.ts`
- Modify: `packages/game-core/src/combat/actions.ts`
- Modify: `packages/game-core/src/combat/actions-legacy.ts`
- Create: `packages/game-core/src/combat/combat-summon-action.test.ts`

**Interfaces:**
- Mature Skill evaluation recognizes summon as a supported mature-layer effect but generic legacy `executeCombatAction` rejects unmaterialized summon blocks.
- `executePv1fMatureSkill` materializes the summon only after ordinary legality/cost/accuracy processing succeeds.
- Owner-turn preparation calls summon lifetime advancement for the active summon.

- [ ] **Step 1: Write failing tests**
  - summon action spends cost once and spawns once;
  - failed legality does not spawn;
  - no same-round turn;
  - turnsCompleted increments only on the summon's own turn;
  - after turn 5, expiration happens before another turn is granted;
  - defeat before turn 5 removes summon immediately.

- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement mature-layer summon execution/lifecycle hooks.**
- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: execute summon Skills in battle`

---

### Task 4: Summon AI with one authored ability per turn

**Files:**
- Create: `packages/game-core/src/combat/summon-ai.ts`
- Create: `packages/game-core/src/combat/summon-ai.test.ts`
- Modify: `packages/game-core/src/combat/recruit-ai-build.ts`
- Modify: `apps/web/src/server/battle/battle-recruit-ai-service.ts`
- Modify: `apps/web/src/server/battle/battle-recruit-ai-service.test.ts`

**Interfaces:**
- Produces: `chooseSummonAiDecision({ state, summon, tieBreakSeed }): RecruitAiDecision`.
- Produces: `summonSkillOptions(summon): BuildAwareRecruitAiSkillOptions`.
- Service identifies summon-controlled turns separately from recruit-controlled turns.
- A per-turn `authoredAbilityUsed` guard prevents a second summon ability in the same turn; movement/facing/end-turn remain legal.

- [ ] **Step 1: Write failing AI tests**
  - chooses heal/support when ally context makes it more useful than damage;
  - chooses damage when legal/valuable;
  - deterministic tie picks one of two equally useful abilities;
  - after one authored ability resolves, next AI decision cannot select another authored ability;
  - can still move/face/end after ability use.

- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement the wrapper/guard using existing build-aware AI utility.**
- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: add summon battle AI`

---

### Task 5: Inspect-only summon presentation

**Files:**
- Modify: `apps/web/src/components/battle/desktop-battle-combatant-inspect.tsx`
- Modify: `apps/web/src/components/battle/pvp-battle-inspect-popup.tsx`
- Modify: `apps/web/src/components/battle/desktop-battle-combatant-inspect.module.css`
- Create: `apps/web/src/components/battle/battle-summon-inspect.test.tsx`
- Modify relevant battle rail components only to explicitly exclude summon combatants.

**Interfaces:**
- Produces: `readSummonInspectMetadata(snapshot, combatantId)` returning name, artwork, owner, remaining turns, tags, and abilities.
- Inspect uses this metadata when combatant id belongs to a summon.
- Side rails filter summon ids; board Inspect remains selectable.

- [ ] **Step 1: Write failing UI/source tests**
  - summon name/artwork/owner/remaining turns/abilities appear in Inspect;
  - normal recruit/player rail filters exclude summon;
  - ordinary combatants remain unchanged.

- [ ] **Step 2: Run tests and verify RED.**
- [ ] **Step 3: Implement Inspect metadata/presentation.**
- [ ] **Step 4: Run tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: expose summons through battle Inspect`

---

### Task 6: Master Panel summon authoring

**Files:**
- Create: `apps/web/src/components/master/combat-content/summon-profile-editor.tsx`
- Create: `apps/web/src/components/master/combat-content/summon-profile-editor.test.tsx`
- Modify: `apps/web/src/components/master/combat-content/combat-content-editor.tsx`
- Modify: `apps/web/src/components/master/combat-content/skill-effect-editor.tsx`
- Modify: `apps/web/src/server/master/combat-content-authoring-service.ts`
- Modify: `apps/web/src/server/master/combat-content-authoring-service.test.ts`
- Modify: `apps/web/src/server/master/combat-content-preview.ts`
- Modify: `apps/web/src/server/master/combat-content-preview.test.ts`

**Interfaces:**
- `SummonProfileEditor` edits all approved profile fields and 1–2 abilities.
- Validation/diff/preview treat `summonProfile` as authoritative mechanics, not presentation-only metadata.
- Preview reports spawn tile, unit stats, lifetime, and ability summaries without mutating battle RNG.

- [ ] **Step 1: Write failing editor/service tests**
  - summon effect reveals a Summon Profile editor;
  - editor exposes name, flavor/description, artwork hook, tags, HP/MP/stats, initiative, movement, AI profile, lifetime, and 1–2 abilities;
  - a third ability is rejected/disabled;
  - semantic diff reports nested summon-profile changes;
  - validation rejects missing/invalid profile data;
  - preview returns spawn target, profile stats, lifetime 5, ability summaries, and `rngConsumed: false`.
- [ ] **Step 2: Implement summon effect/profile controls and validation.**
- [ ] **Step 3: Implement deterministic preview output.**
- [ ] **Step 4: Run Master Panel tests and verify GREEN.**
- [ ] **Step 5: Commit**

Commit message: `feat: author summon profiles in Master Panel`

---

### Task 7: Convert current Summoned Skill content and verify persistence

**Files:**
- Modify: `packages/game-core/src/combat/mature-skills.ts`
- Modify: `packages/game-core/src/combat/skill-balance-v5-1.test.ts`
- Modify: `packages/game-core/src/combat/representative-buildcraft.test.ts`
- Modify: battle persistence tests that snapshot current combat effect state.
- Modify: `docs/COMBAT.md`
- Modify: `apps/web/src/content/techniques-manual.ts`

**Interfaces:**
- Current v5.1 `wildwarden.renewing-herbs` (and any other selected current summoning Skill) uses the new summon effect/profile.
- Historical versions continue using historical `summoned` status.

- [ ] **Step 1: Add failing current-vs-historical version tests**
  - historical v5 Renewing Herbs resolves its original `apply-status: summoned` effect;
  - current v5.1 Renewing Herbs resolves `target.kind === 'empty-tile'` plus the new summon effect/profile;
  - current profile has lifetime 5 and 1–2 authored abilities;
  - serializing/reloading an active summon preserves owner, source Skill/version, turns completed, pinned profile, placement, and stat profile.
- [ ] **Step 2: Author thematic summon profile(s) with 1–2 abilities and 5-turn lifetime.**
- [ ] **Step 3: Add persistence/reload test with an active summon and pinned profile.**
- [ ] **Step 4: Update docs/manual.**
- [ ] **Step 5: Run game-core/web focused suites and verify GREEN.**
- [ ] **Step 6: Commit**

Commit message: `feat: publish current summon-based Technique content`
